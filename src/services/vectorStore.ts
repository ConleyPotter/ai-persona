import { QdrantClient } from '@qdrant/js-client-rest';
import { randomUUID } from "crypto";
import { OpenAIEmbeddings } from '@langchain/openai';
import { config } from '../config/environment';
import type { AccessLevel } from '../models/permissions';

export class VectorStoreService {
  private client: QdrantClient;
  private embeddings: OpenAIEmbeddings;
  private collections = {
    journal: 'journal_entries',
    persona: 'persona_memory',
    public: 'public_knowledge'
  };

  constructor() {
    this.client = new QdrantClient({
      url: config.vectorDb.url,
      apiKey: config.vectorDb.apiKey,
    });
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: config.openai.apiKey,
    });
  }

  async storeMemory(text: string, metadata: any, collection: 'journal' | 'persona' | 'public') {
    const vector = await this.embeddings.embedQuery(text);
    const id = randomUUID();
    
    await this.client.upsert(this.collections[collection], {
      wait: true,
      points: [
        {
          id,
          vector,
          payload: {
            text,
            ...metadata,
            embedding: vector,
            created_at: new Date().toISOString()
          },
        },
      ],
    });

    return { id, text, metadata: { ...metadata, embedding: vector } };
  }

  async queryMemory(query: string, accessLevel: AccessLevel) {
    const vector = await this.embeddings.embedQuery(query);
    
    // Determine which collections to search based on access level
    const collections = this.getAccessibleCollections(accessLevel);
    
    // Search each accessible collection
    const results = await Promise.all(
      collections.map(collection =>
        this.client.search(collection, {
          vector,
          limit: 5,
          filter: {
            must: [
              { key: 'accessLevel', match: { value: accessLevel.scope } }
            ],
          },
        })
      )
    );

    // Combine and sort results by score
    return results
      .flat()
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  private getAccessibleCollections(accessLevel: AccessLevel): string[] {
    switch (accessLevel.scope) {
      case 'companion_only':
        return [this.collections.journal];
      case 'persona_api':
        return [this.collections.journal, this.collections.persona];
      case 'chat_interface':
        return [this.collections.public];
      default:
        return [];
    }
  }
}
