import { OpenAI } from '@langchain/openai';
import type { AccessLevel } from '../models/permissions';
import { config } from '../config/environment';
import { VectorStoreService } from './vectorStore';

export class LLMService {
  private llm: OpenAI;
  private vectorStore: VectorStoreService;

  constructor() {
    this.llm = new OpenAI({ openAIApiKey: config.openai.apiKey });
    this.vectorStore = new VectorStoreService();
  }

  async generateResponse(
    prompt: string,
    accessLevel: AccessLevel
  ) {
    const results = await this.vectorStore.queryMemory(prompt, accessLevel);
    const contextText = results.map((r: any) => r.payload.text).join('\n');
    const finalPrompt = `${contextText}\n${prompt}`;
    const response = await this.llm.call(finalPrompt);
    return response;
  }
}
