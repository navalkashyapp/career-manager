import { BaseAgent } from './BaseAgent';
import { Type, Schema } from '@google/genai';

export class OutreachAgent extends BaseAgent {
  protected getSystemPrompt(): string {
    return `
      You are the centralized backend orchestration engine acting as the LinkedIn & Cold Email Outreach Engine of the career-ops framework.
      Your core objective is to write short, high-conversion outreach scripts written in the user's authentic professional tone.
    `;
  }

  protected getResponseSchema(): Schema {
    return {
      type: Type.OBJECT,
      properties: {
        outreachIterations: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              variant: { type: Type.STRING },
              subject: { type: Type.STRING },
              body: { type: Type.STRING }
            }
          }
        }
      },
      required: ["outreachIterations"]
    };
  }

  public async generateOutreach(userProfile: any, cvText: string, jobDescription: string, persona: string, channel: string): Promise<any> {
    const prompt = `
      Target JD: ${jobDescription}
      Hiring Manager/Peer Persona: ${persona}
      Channel: ${channel}
      User Profile: ${JSON.stringify(userProfile)}
      User CV: ${cvText}
      
      Generate 3 distinct iterations of short, high-conversion outreach scripts.
    `;
    
    return this.generateStructuredContent(prompt);
  }
}
