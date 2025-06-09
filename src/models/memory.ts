import type { AccessLevel } from './permissions';
import { ACCESS_LEVELS } from './permissions';

// Base interface for common fields
interface BaseMemory {
  id: string;
  embedding: number[]; // 1536-dim OpenAI embeddings
  createdAt: Date;
  updatedAt: Date;
}

// Journal Entry - Raw private journaling data
export interface JournalEntry extends BaseMemory {
  content: string;
  emotionalMarkers: string[];
  themes: string[]; // User-selected themes (1-5) from existing theme list
  publicElevationBlocked: boolean;
  accessLevel: typeof ACCESS_LEVELS.STRICT_PRIVATE;
}

// Persona Memory - Curated themed memory chunks
export interface PersonaMemory extends BaseMemory {
  themes: string[]; // AI-classified themes (1-5) from existing theme list
  narrativeElements: string[];
  summary: string;
  sourceEntryRefs: string[]; // References to source journal entries
  privacyLevel: typeof ACCESS_LEVELS.RESTRICTED;
  status: 'active' | 'archived';
}

// Public Knowledge - Approved public-facing content
export interface PublicKnowledge extends BaseMemory {
  topic: string;
  approvedContent: string;
  contextRules: {
    allowedThemes: string[];
    disallowedThemes: string[];
    contextBoundaries: string[];
  };
  guardrailRules: {
    responseTemplates: string[];
    fallbackResponses: string[];
  };
  accessLevel: typeof ACCESS_LEVELS.PUBLIC;
}

// Type for memory candidates awaiting review
export interface PersonaMemoryCandidate extends Omit<PersonaMemory, 'status'> {
  status: 'awaiting_review' | 'promoted' | 'rejected';
  reviewNotes?: string;
}

// Union type for all memory types
export type Memory = JournalEntry | PersonaMemory | PublicKnowledge | PersonaMemoryCandidate;
