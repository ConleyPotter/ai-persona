# AI Persona Project – Technical Documentation (v0.2.1)

---

## 1. Purpose & Scope
This living document gives **Codex**—our AI coding agent—a full picture of the *AI Persona* initiative so it can scaffold code, tests, and infrastructure with minimal additional context. It covers architecture, API surface, memory design, privacy constraints, SDK integration patterns, and the forward roadmap. The document mirrors the canonical Notion workspace and will evolve alongside the product.

---

## 2. System Overview
We operate a **single AI Persona API** that feeds two client applications:

1. **The Companion** – private journaling UI with full‑trust access.  
2. **Portfolio Q&A Chat** – public RAG chatbot with guard‑railed access.

A layered memory architecture (Raw Journal → Persona Memory → Public Knowledge) enforces progressive disclosure.

### 2.1 Conceptual Data‑Flow Diagram
```
Private Journal  ─▶  Vector DB (Journal layer) ─▶ Persona API ─▶ Companion UI
                                │
                                └─▶ Vector DB (Persona layer) ─▶ Public Guardrails ─▶ Q&A Chat
```
Key guarantee: **no raw journal tokens ever surface to the public tier**.

---

## 3. API Reference (v0)
All endpoints are served over `https://api.<domain>/v0/` and accept/return JSON. Authentication uses **Bearer** tokens with scopes that map to privacy tiers (`STRICT_PRIVATE`, `RESTRICTED`, `PUBLIC`).

| Group | Method & Path | Description | Required Scope |
|-------|--------------|-------------|---------------|
| Journal | POST `/journal/entries` | Ingest raw journal text & markers | STRICT_PRIVATE |
| Journal | GET `/journal/entries/:id` | Fetch private entry | STRICT_PRIVATE |
| Persona | POST `/persona/memory` | Create curated themed memory chunk | RESTRICTED |
| Persona | GET `/persona/memory/search` | Semantic search over persona memory | RESTRICTED |
| Persona | GET `/persona/memory/candidates` | List memory chunks awaiting manual review | RESTRICTED |
| Persona | PATCH `/persona/memory/:id/promote` | Elevate candidate to active persona memory | RESTRICTED |
| Persona | DELETE `/persona/memory/:id` | Delete candidate or active persona memory | RESTRICTED |
| Public | POST `/chat/public-query` | Submit a question for portfolio bot | PUBLIC |

*(See Appendix A for complete request/response examples.)*

---

## 4. Memory Schema
We persist three vector‑indexed tables (1536‑dim OpenAI embeddings):

| Layer | Primary Key | Core Fields | Access |
|-------|------------|------------|--------|
| `journal_entries` | `entry_id` | `content`, `emotional_markers`, `themes`, `embedding`, `public_elevation_blocked` (bool) | STRICT_PRIVATE |
| `persona_memory` | `memory_id` | `themes`, `narrative_elements`, `summary`, `source_entry_refs[]`, `embedding`, `privacy_level` | RESTRICTED |
| `persona_memory_candidates` | `candidate_id` | Same as `persona_memory` + `status` (`awaiting_review`, `promoted`, `rejected`) | RESTRICTED |
| `public_knowledge` | `topic_id` | `approved_content`, `context_rules`, `guardrail_rules`, `embedding` | PUBLIC |

### 4.1 Entity DDL (TypeScript‑like)
```ts
type JournalEntry = {
  entry_id: string
  content: string
  emotional_markers: string[]
  themes: string[]  // User-selected themes (1-5) from existing theme list
  embedding: number[]
  public_elevation_blocked: boolean
  created_at: Date
}

type PersonaMemoryCandidate = {
  candidate_id: string
  summary: string
  themes: string[]  // AI-classified themes (1-5) from existing theme list
  narrative_elements: string[]
  source_entry_refs: string[]
  embedding: number[]
  privacy_level: "RESTRICTED"
  status: "awaiting_review" | "promoted" | "rejected"
}
```

### 4.2 Theme & Narrative Extraction Workflow
The goal is to convert a raw journal entry into a **Persona Memory Candidate** that captures thematic and narrative signal while respecting privacy settings.

#### Pipeline Overview (LangChain)
1. **Pre‑Chunking**
   ```ts
   const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1024, chunkOverlap: 50 })
   const chunks = await textSplitter.splitText(entry.content)
   ```
2. **Embedding & Storage**
   ```ts
   await qdrant.addDocuments(chunks.map(c => ({ content: c })))
   ```
3. **Theme Classification**
   ```ts
   const themePrompt = new PromptTemplate({
     template: "Classify the text into 1-5 most relevant themes from the predefined theme list: {themes}. Return a JSON array.",
     inputVariables: ["text", "themes"]
   })
   const themeChain = new LLMChain({ llm, prompt: themePrompt })
   const { text: themes } = await themeChain.call({ text: entry.content, themes: THEME_LIST })
   ```
4. **Narrative Element Extraction**
   ```ts
   const narrativePrompt = new PromptTemplate({
     template: "Identify protagonist, desire, obstacle, and emotional tone. Return JSON.",
     inputVariables: ["text"]
   })
   const narrativeChain = new LLMChain({ llm, prompt: narrativePrompt })
   const { text: narrative } = await narrativeChain.call({ text: entry.content })
   ```
5. **Summarization**
   ```ts
   const summary = await summarizeChain.call({ text: entry.content })
   ```
6. **Candidate Construction**
   ```ts
   const candidate: PersonaMemoryCandidate = {
     candidate_id: uuid(),
     summary,
     themes: themes,  // AI-classified themes from step 3
     narrative_elements: narrative,
     source_entry_refs: [entry.entry_id],
     embedding: await embedder.embed(summary),
     privacy_level: "RESTRICTED",
     status: "awaiting_review"
   }
   await candidatesCollection.insert(candidate)
   ```

If `public_elevation_blocked` is `true` on the source entry, the pipeline stops after embedding; no candidate is created.

### 4.3 Manual Promotion & Review Controls
**Notification Flow**
1. After a candidate is stored, an `persona.memory.candidate.created` event triggers a push notification (email + in‑app inbox) summarizing the extraction results.
2. The Companion exposes a **Memory Inbox** panel powered by `GET /persona/memory/candidates`.

| Action | Endpoint | Result |
|--------|----------|--------|
| Promote | PATCH `/persona/memory/{id}/promote` | Moves row to `persona_memory`, status → `promoted` |
| Edit | PATCH `/persona/memory/{id}` | Updates fields before promotion |
| Reject | DELETE `/persona/memory/{id}` | Deletes candidate; audit logged |

Safeguards: promotion requires a confirm step; rejected candidates cannot be re‑created from the same entry unless an admin uses `force=true`.

---

## 5. Privacy & Permissions
Three immutable scopes drive all routing and filtering logic: `STRICT_PRIVATE`, `RESTRICTED`, `PUBLIC`.

1. Raw journal tokens never leave the Companion context.  
2. Persona memory must be manually promoted and can be demoted at any time.  
3. Public knowledge answers only from the whitelisted topic set and applies guardrails for disallowed themes.

---

## 6. Integration Guides
### 6.1 Node.js (LangChain.js) – Private Retrieval
```ts
import { OpenAIEmbeddings, VectorStoreRetriever } from "langchain"
import { QdrantVectorStore } from "@langchain/community/vectorstores/qdrant"

const qdrant = await QdrantVectorStore.fromExistingIndex(
  new OpenAIEmbeddings({ apiKey: process.env.OPENAI_KEY }),
  { url: process.env.QDRANT_URL, collectionName: "journal_entries" }
)

export async function getPrivateContext(query: string) {
  const retriever = new VectorStoreRetriever({ vectorStore: qdrant, k: 5 })
  return retriever.getRelevantDocuments(query)
}
```
*(React and Python guides remain unchanged; see previous revision.)*

---

## 7. Development Roadmap Snapshot
- Map & document memory schema – **50 % complete**  
- Prototype RetrievalQA (public & private) – **Not started**  
- Prompt templates + guardrails – **Not started**  
- Front‑end wiring (Companion UI & Chat widget) – **High priority**

Codex should prioritize code generation for these high‑impact tasks.

---

## 8. Glossary
| Term | Meaning |
|------|---------|
| **Companion** | Private journaling app with full‑trust access |
| **Persona API** | Node.js service that mediates all memory and generates LLM calls |
| **Public RAG Chat** | Guard‑railed Q&A widget for portfolio visitors |
| **Scope** | Auth tier defining maximum data visibility |
| **Promotion** | Manual process of elevating journal content into persona memory |

---

## 9. Next Steps for Documentation
1. Generate an OpenAPI 3.1 spec for all endpoints.  
2. Add dbdiagram.io PNG of the schema.  
3. Expand guardrail test matrix.  
4. Version this doc in Git and auto‑publish to the Notion knowledge base.

*Last updated: 2025‑06‑09*
