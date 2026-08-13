import { BaseAgent } from './BaseAgent';
import { Type, Schema } from '@google/genai';

export class PortalExtractionAgent extends BaseAgent {
  protected getSystemPrompt(): string {
    return `
      You are the centralized backend orchestration engine acting as the Automated Portal & Career Page Processing module of the career-ops framework.
      Your core objective is to extract clean metadata fields from scraped structural data or DOM snippets from job portals (e.g., Greenhouse, Ashby, Lever).
    `;
  }

  protected getResponseSchema(): Schema {
    return {
      type: Type.OBJECT,
      properties: {
        companyName: { type: Type.STRING },
        roleTitle: { type: Type.STRING },
        location: { type: Type.STRING },
        salaryRange: { type: Type.STRING },
        strictRequirements: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      },
      required: ["companyName", "roleTitle", "location", "salaryRange", "strictRequirements"]
    };
  }

  public async extractMetadata(domSnippet: string): Promise<any> {
    const prompt = `
      Extract the requested metadata from the following scraped structural data or DOM snippet.
      
      DOM Snippet / Raw Data:
      ${domSnippet}
    `;
    
    return this.generateStructuredContent(prompt);
  }
}
