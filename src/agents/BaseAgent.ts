import { GoogleGenAI, Schema } from '@google/genai';
import { GEMINI_MODELS } from '../config/gemini';
import { callGeminiApi } from '../lib/utils/geminiClient';

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
      
      const response = await callGeminiApi({
        model: this.model,
        contents: fullPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema
        }
      });
      
      console.log(`\n================= AI RESPONSE: ${this.constructor.name} =================\n`, response?.text, '\n======================================================================\n');
      return JSON.parse(response?.text || '{}');
    } catch (error: any) {
      console.error(`Error in agent ${this.constructor.name}:`, error);
      throw new Error(`AI generation failed: ${error.message || 'Unknown error'}`);
    }
  }
}
