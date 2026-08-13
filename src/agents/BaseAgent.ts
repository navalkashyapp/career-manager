import { GoogleGenAI, Schema } from '@google/genai';
import { GEMINI_MODELS } from '../config/gemini';

export abstract class BaseAgent {
  protected ai: GoogleGenAI;
  protected model: string;

  constructor(aiClient: GoogleGenAI, model: string = GEMINI_MODELS.FLASH) {
    this.ai = aiClient;
    this.model = model;
  }

  protected abstract getSystemPrompt(): string;
  protected abstract getResponseSchema(): any;

  protected async generateStructuredContent(
    prompt: string,
    systemPromptOverride?: string,
    schemaOverride?: Schema
  ): Promise<any> {
    const systemPrompt = systemPromptOverride || this.getSystemPrompt();
    const schema = schemaOverride || this.getResponseSchema();

    const fullPrompt = `
      ${systemPrompt}

      --- 
      USER REQUEST:
      ${prompt}
    `;

    try {
      console.log(`\n================= AI REQUEST: ${this.constructor.name} =================\n`, fullPrompt, '\n====================================================================\n');
      
      let response;
      let retries = 3;
      while (retries > 0) {
        try {
          response = await this.ai.models.generateContent({
            model: this.model,
            contents: fullPrompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: schema
            }
          });
          break; // Success
        } catch (err: any) {
          if (err.status === 429 && retries > 1) {
            console.warn(`[BaseAgent] 429 Quota Exceeded. Retrying in 5 seconds... (${retries - 1} retries left)`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            retries--;
          } else {
            throw err;
          }
        }
      }
      
      console.log(`\n================= AI RESPONSE: ${this.constructor.name} =================\n`, response?.text, '\n======================================================================\n');
      return JSON.parse(response?.text || '{}');
    } catch (error: any) {
      console.error(`Error in agent ${this.constructor.name}:`, error);
      throw new Error(`AI generation failed: ${error.message || 'Unknown error'}`);
    }
  }
}
