import { BaseAgent } from './BaseAgent';
import { Type, Schema } from '@google/genai';

export class ResumeTailorAgent extends BaseAgent {
  protected getSystemPrompt(): string {
    return `
      You are the centralized backend orchestration engine acting as the Resume Tailor module of the career-ops framework.
      Your core objective is to generate an ATS-Optimized CV & Tailor the Resume.
      CRITICAL RULE: No Formatting Hallucinations. Do not change the core schema or remove existing employment dates. 
      Only optimize descriptions, impact bullet points, and tech stack visibility.
      CRITICAL RULE: Fact Integrity. Never invent or hallucinate professional experience or certifications. 
      If a critical skill is missing, highlight it in the gap analysis.
    `;
  }

  protected getResponseSchema(): Schema {
    return {
      type: Type.OBJECT,
      properties: {
        tailoredCvMarkdown: { type: Type.STRING },
        keywordsTargeted: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        changesMade: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      },
      required: ["tailoredCvMarkdown", "keywordsTargeted", "changesMade"]
    };
  }

  public async tailorResume(userProfile: any, cvText: string, jobDescription: string): Promise<any> {
    const prompt = `
      Tailor the following Master CV for this Job Description.
      
      User Profile:
      ${JSON.stringify(userProfile)}
      
      Master CV:
      ${cvText}
      
      Job Description:
      ${jobDescription}
    `;
    
    return this.generateStructuredContent(prompt);
  }
}
