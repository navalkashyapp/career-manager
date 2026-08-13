import { GoogleGenAI } from '@google/genai';
import { BaseAgent } from '../../agents/BaseAgent';
import { MatchScorerInput, MatchScorerResult } from '../types/careerOpsTypes';
import { matchScorerPrompt } from '../prompts/matchScorerPrompt';

export class MatchScorerAgent extends BaseAgent {
  constructor(aiClient: GoogleGenAI) {
    super(aiClient);
  }

  protected getSystemPrompt(): string {
    return matchScorerPrompt;
  }

  protected getResponseSchema(): any {
    return {
      type: "object",
      properties: {
        overallScore: { type: "number", description: "Score from 0.0 to 5.0" },
        grades: {
          type: "object",
          properties: {
            skillAlignment: { type: "string" },
            cultureFit: { type: "string" },
            compensationMatching: { type: "string" },
            growthPotential: { type: "string" }
          },
          required: ["skillAlignment", "cultureFit", "compensationMatching", "growthPotential"]
        },
        jobTitle: { type: "string" },
        companyName: { type: "string" },
        jobSummary: { type: "string" },
        gapAnalysis: {
          type: "array",
          items: { type: "string" }
        },
        verdict: { type: "string", description: "Brief final recommendation" }
      },
      required: [
        "overallScore", "grades", "jobTitle", "companyName", "jobSummary", "gapAnalysis", "verdict"
      ]
    };
  }

  public async evaluate(input: MatchScorerInput): Promise<MatchScorerResult> {
    const prompt = `
Candidate Profile:
${JSON.stringify(input.userProfile, null, 2)}

Candidate CV:
${input.cvText}

Job Description:
${input.jobDescription}
`;
    return (await this.generateStructuredContent(prompt)) as MatchScorerResult;
  }
}
