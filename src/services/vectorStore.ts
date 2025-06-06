import { QdrantClient } from '@qdrant/js-client-rest';
import { randomUUID } from "crypto";
import { OpenAIEmbeddings } from '@langchain/openai';
import { config } from '../config/environment';
import type { AccessLevel } from '../models/permissions';

export class VectorStoreService {
  private client: QdrantClient;
  private embeddings: OpenAIEmbeddings;
  private collection = 'memories';

  constructor() {
    this.client = new QdrantClient({
      url: config.vectorDb.url,
      apiKey: config.vectorDb.apiKey,
    });
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: config.openai.apiKey,
    });
  }

  async storeMemory(text: string, metadata: any) {
    const vector = await this.embeddings.embedQuery(text);
    await this.client.upsert(this.collection, {
      wait: true,
      points: [
        {
          id: randomUUID(),
          vector,
          payload: { text, ...metadata },
        },
      ],
    });
  }

  async queryMemory(query: string, accessLevel: AccessLevel) {
    const vector = await this.embeddings.embedQuery(query);
    const results = await this.client.search(this.collection, {
      vector,
      limit: 5,
      filter: {
        must: [{ key: 'accessLevel', match: { value: accessLevel } }],
      },
    });
    return results;
  }
}
