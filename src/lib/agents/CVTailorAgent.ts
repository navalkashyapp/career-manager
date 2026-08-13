import { GoogleGenAI } from '@google/genai';
import { BaseAgent } from '../../agents/BaseAgent';
import { CVTailorInput, CVTailorResult } from '../types/careerOpsTypes';
import { cvTailorPrompt } from '../prompts/cvTailorPrompt';

export class CVTailorAgent extends BaseAgent {
  constructor(aiClient: GoogleGenAI) {
    super(aiClient);
  }

  protected getSystemPrompt(): string {
    return cvTailorPrompt;
  }

  protected getResponseSchema(): any {
    return {
      type: "object",
      properties: {
        tailoredSummary: { type: "string" },
        tailoredExperiences: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              tailoredBullets: {
                type: "array",
                items: { type: "string" }
              }
            },
            required: ["id", "tailoredBullets"]
          }
        },
        tailoredProjects: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              tailoredImpact: { type: "string" },
              tailoredArchitecture: { type: "string" }
            },
            required: ["id", "tailoredImpact", "tailoredArchitecture"]
          }
        },
        coverLetterDraft: { type: "string" }
      },
      required: ["tailoredSummary", "tailoredExperiences", "tailoredProjects"]
    };
  }

  public async tailor(input: CVTailorInput): Promise<CVTailorResult> {
    const prompt = `
Role Archetype: ${input.archetype}

Candidate Profile:
${JSON.stringify(input.userProfile, null, 2)}

Master CV:
${input.masterCvText}

Job Description:
${input.jobDescription}
`;
    return (await this.generateStructuredContent(prompt)) as CVTailorResult;
  }
}
