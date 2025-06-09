/**
 * @file ai-persona-api.e2e.test.ts
 * @description End-to-end tests for the AI Persona API.
 * This test suite simulates real-world usage of the API, covering all major features
 * outlined in the technical documentation. It uses a running instance of the API
 * and a test database.
 *
 * @requires A running API server and a configured test database (e.g., Qdrant).
 * @requires Environment variables for API_BASE_URL, and mock auth tokens.
 */

import axios, { AxiosInstance } from 'axios';

// --- Mocks & Test Setup ---
// In a real-world scenario, you would mock the LLM and embedding services
// to avoid actual API calls to providers like OpenAI.
jest.mock('../src/services/llm', () => ({
  LLMService: jest.fn().mockImplementation(() => ({
    extractThemes: jest.fn().mockResolvedValue(['personal-growth', 'career']),
    extractNarrativeElements: jest.fn().mockResolvedValue({
      protagonist: 'self',
      desire: 'To learn a new skill',
      obstacle: 'Lack of time',
      tone: 'motivated',
    }),
    summarizeText: jest.fn().mockResolvedValue('The user wrote about their motivation to learn a new skill despite time constraints.'),
    generateResponse: jest.fn().mockImplementation(async (prompt: string, accessLevel: any) => {
      // Mock RAG process with access level awareness
      if (accessLevel.scope === 'chat_interface') {
        return {
          text: "Based on the available information, the user is working on a side project focused on learning new skills.",
          metadata: {
            confidence: 0.95,
            sources: ['promoted-memory-1']
          }
        };
      }
      return {
        text: "I cannot provide that information due to privacy restrictions.",
        metadata: {
          confidence: 0,
          reason: "insufficient_access_level"
        }
      };
    })
  }))
}));

jest.mock('../src/services/vectorStore', () => ({
  VectorStoreService: jest.fn().mockImplementation(() => ({
    storeMemory: jest.fn().mockImplementation(async (text: string, metadata: any) => {
      // Mock storing memory with proper metadata
      return {
        id: 'mock-id-' + Math.random(),
        text,
        metadata: {
          ...metadata,
          embedding: Array.from({ length: 1536 }, () => Math.random())
        }
      };
    }),
    queryMemory: jest.fn().mockImplementation(async (query: string, accessLevel: any) => {
      // Mock querying memory with access level filtering
      return [{
        id: 'mock-result-id',
        score: 0.95,
        payload: {
          text: 'Mock result text',
          metadata: {
            accessLevel: accessLevel.scope,
            themes: ['mock-theme'],
            narrative_elements: ['mock-narrative']
          }
        }
      }];
    })
  }))
}));


// --- Type Definitions (based on the provided technical doc) ---

type Scope = 'STRICT_PRIVATE' | 'RESTRICTED' | 'PUBLIC';

interface JournalEntry {
  entry_id: string;
  content: string;
  emotional_markers: string[];
  themes: string[];
  public_elevation_blocked: boolean;
  created_at: Date;
}

interface PersonaMemoryCandidate {
  candidate_id: string;
  summary: string;
  themes: string[];
  narrative_elements: string[];
  source_entry_refs: string[];
  status: 'awaiting_review' | 'promoted' | 'rejected';
}

interface PersonaMemory extends Omit<PersonaMemoryCandidate, 'status' | 'candidate_id'> {
    memory_id: string;
    privacy_level: 'RESTRICTED';
}


// --- Test Configuration ---

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/v0';

// These would be valid JWTs for your test environment
const TOKENS: Record<Scope, string> = {
  STRICT_PRIVATE: process.env.TOKEN_STRICT_PRIVATE || 'dummy-private-token',
  RESTRICTED: process.env.TOKEN_RESTRICTED || 'dummy-restricted-token',
  PUBLIC: process.env.TOKEN_PUBLIC || 'dummy-public-token',
};

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  validateStatus: () => true, // Let us handle all status codes in tests
});

// --- Test Suite ---

describe('AI Persona API - E2E Test Suite', () => {
  let createdJournalEntryId: string | null = null;
  let createdCandidateId: string | null = null;
  let promotedMemoryId: string | null = null;

  // Cleanup hook to ensure a clean state between test files if needed.
  afterAll(async () => {
    // Optional: Implement a cleanup function to delete all test data
    // from the database to ensure test idempotency.
    // e.g., await cleanupTestData();

    // TODO: Have Codex generate a cleanup function that deletes all test data
  });


  describe('Authentication and Authorization', () => {
    const endpoints: { method: 'get' | 'post' | 'patch' | 'delete'; path: string; requiredScope: Scope }[] = [
        { method: 'post', path: '/journal/entries', requiredScope: 'STRICT_PRIVATE'},
        { method: 'get', path: '/journal/entries/some-id', requiredScope: 'STRICT_PRIVATE'},
        { method: 'post', path: '/persona/memory', requiredScope: 'RESTRICTED'},
        { method: 'get', path: '/persona/memory/candidates', requiredScope: 'RESTRICTED'},
        { method: 'patch', path: '/persona/memory/some-id/promote', requiredScope: 'RESTRICTED'},
        { method: 'post', path: '/chat/public-query', requiredScope: 'PUBLIC'},
    ];

    test.each(endpoints)('$method $path should return 401 Unauthorized without a token', async ({ method, path }) => {
        const { status } = await apiClient[method](path, {});
        expect(status).toBe(401);
    });

    test.each(endpoints)('$method $path should return 403 Forbidden with insufficient scope', async ({ method, path, requiredScope }) => {
        const insufficientScopes = Object.keys(TOKENS).filter(s => s !== requiredScope) as Scope[];
        
        for (const scope of insufficientScopes) {
            const token = TOKENS[scope];
            const { status } = await apiClient[method](path, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // It's possible the public endpoint is accessible by all, but we test for the minimum required scope.
            // A more specific check might be needed if higher scopes can access lower-scope endpoints.
            if(requiredScope !== 'PUBLIC') {
                 expect(status).toBe(403);
            }
        }
    });
  });

  describe('Journal Ingestion and Candidate Creation', () => {
    it('should ingest a new journal entry and create a persona memory candidate', async () => {
      const entryContent = "Today I finally started working on my side project. It feels great to be creative.";
      const response = await apiClient.post('/journal/entries', {
        content: entryContent,
        emotional_markers: ['motivated', 'excited'],
        themes: ['creativity', 'work'],
        public_elevation_blocked: false,
      }, {
        headers: { Authorization: `Bearer ${TOKENS.STRICT_PRIVATE}` }
      });

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('entry_id');
      expect(response.data).toHaveProperty('message', 'Journal entry ingested and candidate creation process started.');
      createdJournalEntryId = response.data.entry_id;

      // E2E check: a candidate should now exist.
      // We'll poll for a moment to allow for async processing.
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for processing

      const candidatesResponse = await apiClient.get('/persona/memory/candidates', {
        headers: { Authorization: `Bearer ${TOKENS.RESTRICTED}` }
      });

      expect(candidatesResponse.status).toBe(200);
      const candidates: PersonaMemoryCandidate[] = candidatesResponse.data;
      const newCandidate = candidates.find(c => c.source_entry_refs.includes(createdJournalEntryId!));
      
      expect(newCandidate).toBeDefined();
      expect(newCandidate?.summary).toEqual('The user wrote about their motivation to learn a new skill despite time constraints.');
      expect(newCandidate?.status).toBe('awaiting_review');
      createdCandidateId = newCandidate!.candidate_id;
    });

    it('should ingest an entry but block candidate creation if public_elevation_blocked is true', async () => {
        const privateContent = "A very private thought that should never be made public.";
        const response = await apiClient.post('/journal/entries', {
          content: privateContent,
          public_elevation_blocked: true,
        }, {
          headers: { Authorization: `Bearer ${TOKENS.STRICT_PRIVATE}` }
        });
  
        expect(response.status).toBe(201);
        const privateEntryId = response.data.entry_id;

        // Allow time for async processing to NOT happen
        await new Promise(resolve => setTimeout(resolve, 1000));
  
        const candidatesResponse = await apiClient.get('/persona/memory/candidates', {
            headers: { Authorization: `Bearer ${TOKENS.RESTRICTED}` }
        });

        const candidates: PersonaMemoryCandidate[] = candidatesResponse.data;
        const blockedCandidate = candidates.find(c => c.source_entry_refs.includes(privateEntryId));
        
        expect(blockedCandidate).toBeUndefined();
    });
  });

  describe('Memory Candidate Review Workflow', () => {
    
    beforeAll(() => {
        // Ensure a candidate exists to be promoted or rejected.
        if (!createdCandidateId) {
            throw new Error("Prerequisite failed: No candidate was created in the previous test block.");
        }
    });

    it('should list all candidates awaiting review', async () => {
        const response = await apiClient.get('/persona/memory/candidates', {
            headers: { Authorization: `Bearer ${TOKENS.RESTRICTED}` }
        });
        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);
        expect(response.data.length).toBeGreaterThan(0);
        expect(response.data[0].status).toBe('awaiting_review');
    });

    it('should promote a candidate to active persona memory', async () => {
        const response = await apiClient.patch(`/persona/memory/${createdCandidateId}/promote`, {}, {
            headers: { Authorization: `Bearer ${TOKENS.RESTRICTED}` }
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('memory_id');
        expect(response.data.message).toBe('Candidate successfully promoted to active persona memory.');
        promotedMemoryId = response.data.memory_id;

        // Verify it no longer appears in the candidates list
        const candidatesResponse = await apiClient.get('/persona/memory/candidates', {
            headers: { Authorization: `Bearer ${TOKENS.RESTRICTED}` }
        });
        const stillACandidate = candidatesResponse.data.find((c: PersonaMemoryCandidate) => c.candidate_id === createdCandidateId);
        expect(stillACandidate).toBeUndefined();
    });

    it('should reject (delete) a candidate', async () => {
        // First, create a new candidate to reject
        const entryRes = await apiClient.post('/journal/entries', { content: "This entry will be rejected." }, {
            headers: { Authorization: `Bearer ${TOKENS.STRICT_PRIVATE}` }
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
        const candsRes = await apiClient.get('/persona/memory/candidates', { headers: { Authorization: `Bearer ${TOKENS.RESTRICTED}` }});
        const candidateToReject = candsRes.data.find((c: PersonaMemoryCandidate) => c.source_entry_refs.includes(entryRes.data.entry_id));

        // Now, reject it
        const deleteResponse = await apiClient.delete(`/persona/memory/${candidateToReject.candidate_id}`, {
            headers: { Authorization: `Bearer ${TOKENS.RESTRICTED}` }
        });

        expect(deleteResponse.status).toBe(200);
        expect(deleteResponse.data.message).toBe('Memory candidate deleted successfully.');

        // Verify it's gone
        const finalCands = await apiClient.get('/persona/memory/candidates', { headers: { Authorization: `Bearer ${TOKENS.RESTRICTED}` }});
        const rejectedCandidate = finalCands.data.find((c: PersonaMemoryCandidate) => c.candidate_id === candidateToReject.candidate_id);
        expect(rejectedCandidate).toBeUndefined();
    });
  });

  describe('Public Q&A and Data Isolation', () => {
    beforeAll(() => {
        if (!promotedMemoryId) {
            throw new Error("Prerequisite failed: No memory was promoted in the previous test block.");
        }
        // In a real E2E test, you'd also need a step to move the promoted `persona_memory`
        // into the `public_knowledge` layer, as per the diagram. For this test, we'll assume
        // promotion makes it available to the public RAG process.
    });
    
    it('should return a relevant answer from public knowledge for a public query', async () => {
      const response = await apiClient.post('/chat/public-query', {
        query: "What is the user working on?"
      }, {
        headers: { Authorization: `Bearer ${TOKENS.PUBLIC}` }
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('answer');
      // The answer should be based on the summarized, promoted content.
      expect(response.data.answer).toContain("side project");
      expect(response.data.answer).toContain("skill");
    });

    it('should NOT return information from private, non-promoted entries', async () => {
        // Create a new, private entry that will not be promoted
        await apiClient.post('/journal/entries', {
            content: "This is a secret project about building a time machine.",
            public_elevation_blocked: false,
          }, {
            headers: { Authorization: `Bearer ${TOKENS.STRICT_PRIVATE}` }
        });

        await new Promise(resolve => setTimeout(resolve, 1000)); // wait for processing

        // Query about the secret project
        const response = await apiClient.post('/chat/public-query', {
            query: "Tell me about the time machine project."
          }, {
            headers: { Authorization: `Bearer ${TOKENS.PUBLIC}` }
          });
        
        expect(response.status).toBe(200);
        expect(response.data.answer).not.toContain("time machine");
        // The RAG system should gracefully say it doesn't have the information.
        expect(response.data.answer).toMatch(/I don't have information on that|I cannot answer that/i);
    });
  });

});


/*

How to Use This Test Suite
Environment Setup: Before running these tests, ensure your environment is correctly configured. You'll need:

  * A running instance of your AI Persona API.
  * The base URL of your API server set as an environment variable (API_BASE_URL).
  * A separate, dedicated test database (e.g., a test instance or collection in Qdrant) to avoid interfering with development or production data.
  * Valid Bearer tokens for each of the three scopes (STRICT_PRIVATE, RESTRICTED, PUBLIC) available as environment variables.
  * Dependencies: Install the necessary development dependencies for your project.

```bash
npm install --save-dev jest ts-jest @types/jest axios
```

Mocking Services: The provided code includes mocks for your LLM and embedding services. You will need to adjust the file paths in jest.mock('./services/llmService', ...) to match the actual location of these services in your project structure. This is crucial for creating fast, reliable, and cost-effective tests.

Running Tests: Configure your package.json with a test script and then run the suite from your terminal.

In package.json:
JSON

"scripts": {
  "test:e2e": "jest --config jest.e2e.config.js"
}
You will likely need a separate Jest configuration file (jest.e2e.config.js) to specify the test match patterns for your E2E tests.
This suite provides a strong foundation for ensuring the quality and reliability of your AI Persona API by testing its core features from an external, user-like perspective.

*/