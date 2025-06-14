import { OpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import type { AccessLevel } from '../models/permissions';
import { config } from '../config/environment';
import { VectorStoreService } from './vectorStore';

export class LLMService {
  private llm: OpenAI;
  private vectorStore: VectorStoreService;
  private themePrompt: PromptTemplate;
  private narrativePrompt: PromptTemplate;
  private summaryPrompt: PromptTemplate;
  private responsePrompt: PromptTemplate;

  constructor() {
    this.llm = new OpenAI({ openAIApiKey: config.openai.apiKey });
    this.vectorStore = new VectorStoreService();

    // Initialize prompt templates
    this.themePrompt = new PromptTemplate({
      template: "Classify the text into one or more of the predefined themes: {themes}. Return a JSON array.",
      inputVariables: ["text", "themes"]
    });

    this.narrativePrompt = new PromptTemplate({
      template: "Identify protagonist, desire, obstacle, and emotional tone. Return JSON.",
      inputVariables: ["text"]
    });

    this.summaryPrompt = new PromptTemplate({
      template: "Summarize the following text while preserving key themes and emotional context: {text}",
      inputVariables: ["text"]
    });

    this.responsePrompt = new PromptTemplate({
      template: `Given the following context and query, provide a response that:
1. Only uses information from the provided context
2. Respects privacy boundaries based on access level: {accessLevel}
3. Maintains a natural, conversational tone

Context:
{context}

Query: {query}

Response:`,
      inputVariables: ["context", "query", "accessLevel"]
    });
  }

  async extractThemes(text: string): Promise<string[]> {
    const chain = RunnableSequence.from([
      this.themePrompt,
      this.llm,
      (output) => JSON.parse(output)
    ]);
    
    const result = await chain.invoke({ 
      text, 
      themes: ['personal-growth', 'career', 'creativity', 'work', 'health', 'relationships'] 
    });
    return result;
  }

  async extractNarrativeElements(text: string) {
    const chain = RunnableSequence.from([
      this.narrativePrompt,
      this.llm,
      (output) => JSON.parse(output)
    ]);
    
    const result = await chain.invoke({ text });
    return result;
  }

  async summarizeText(text: string): Promise<string> {
    const chain = RunnableSequence.from([
      this.summaryPrompt,
      this.llm
    ]);
    
    const result = await chain.invoke({ text });
    return result;
  }

  async generateResponse(
    prompt: string,
    accessLevel: AccessLevel
  ) {
    // Get relevant context based on access level
    const results = await this.vectorStore.queryMemory(prompt, accessLevel);
    
    // If no results or insufficient access, return appropriate response
    if (!results.length) {
      return {
        text: "I don't have enough information to answer that question.",
        metadata: {
          confidence: 0,
          reason: "no_relevant_context"
        }
      };
    }

    // Prepare context from results
    const contextText = results.map((r: any) => r.payload.text).join('\n');
    
    // Generate response using the context
    const chain = RunnableSequence.from([
      this.responsePrompt,
      this.llm
    ]);
    
    const response = await chain.invoke({
      context: contextText,
      query: prompt,
      accessLevel: accessLevel.scope
    });

    return {
      text: response,
      metadata: {
        confidence: results[0].score,
        sources: results.map((r: any) => r.id)
      }
    };
  }
}
