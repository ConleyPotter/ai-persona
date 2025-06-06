import { config } from './environment';
import { OpenAI } from '@langchain/openai';

export const openai = new OpenAI({
  openAIApiKey: config.openai.apiKey,
});
