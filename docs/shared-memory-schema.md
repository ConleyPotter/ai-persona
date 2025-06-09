# Shared Memory Schema

## Schema Overview

A layered architecture for managing private journaling data and public-facing interactions while maintaining strict privacy boundaries.

## Data Layers

| **Layer** | **Schema Structure** | **Access Level** | **Storage Type** |
| --- | --- | --- | --- |
| Raw Journal | entry_id, timestamp, content, emotional_markers, themes | Private Only | Vector DB |
| Persona Memory | memory_id, themes, embeddings, privacy_level, source_refs | API-Permissioned | Vector DB |
| Public Knowledge | topic_id, approved_content, context_rules, guardrails | Public | Vector DB |

## Core Entities

### 1. Journal Entries

```sql
JournalEntry {
    id: uuid
    timestamp: datetime
    raw_content: text
    emotional_markers: string[]
    themes: string[]  # User-selected themes (1-5) from existing theme list
    embedding: vector(1536)
    privacy_level: enum[STRICT_PRIVATE]
}

```

### 2. Persona Memory

```sql
PersonaMemory {
    id: uuid
    creation_date: datetime
    themes: string[]  # AI-classified themes (1-5) from existing theme list
    narrative_elements: text
    source_entry_refs: uuid[]
    embedding: vector(1536)
    privacy_level: enum[PRIVATE, RESTRICTED, PUBLIC]
    access_rules: json
}

```

### 3. Public Knowledge Base

```sql
PublicKnowledge {
    id: uuid
    topic: string
    approved_content: text
    context_boundaries: json
    guardrail_rules: json
    embedding: vector(1536)
    last_updated: datetime
}

```

## Theme Classification

Themes are managed consistently across the system:

1. **Journal Entries**: Users can select 1-5 themes from an existing theme list when creating entries
2. **Persona Memory**: AI automatically classifies entries into 1-5 themes from the same theme list during memory creation
3. **Theme List**: Maintained as a separate entity to ensure consistency across the system

The theme classification process:
- Uses a simple classification model to analyze entry content
- Selects 1-5 most relevant themes from the existing theme list
- Ensures consistency between user-selected and AI-classified themes
- Supports the memory promotion workflow by maintaining thematic continuity