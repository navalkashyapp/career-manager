import { BaseAgent } from './BaseAgent';
import { Type, Schema } from '@google/genai';

export class JobEvaluationAgent extends BaseAgent {
  protected getSystemPrompt(): string {
    return `
      You are the centralized backend orchestration engine acting as the Job Evaluation module of the career-ops framework.
      Your core objective is to evaluate a raw job description against the user's profile and CV.
      You must act strictly as an objective assessor and return a valid JSON object matching the requested schema.
      Provide an overall score (1.0 to 5.0), individual grades (A-F) for Skill Alignment, Culture Fit, Compensation Matching, and Growth Potential, a bulleted gap analysis, and extract the job title, company name, and a short summary of the job description.
    `;
  }

  protected getResponseSchema(): Schema {
    return {
      type: Type.OBJECT,
      properties: {
        overallScore: { type: Type.NUMBER },
        grades: {
          type: Type.OBJECT,
          properties: {
            skillAlignment: { type: Type.STRING },
            cultureFit: { type: Type.STRING },
            compensationMatching: { type: Type.STRING },
            growthPotential: { type: Type.STRING }
          }
        },
        jobTitle: { type: Type.STRING },
        companyName: { type: Type.STRING },
        jobSummary: { type: Type.STRING },
        gapAnalysis: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        verdict: { type: Type.STRING }
      },
      required: ["overallScore", "grades", "gapAnalysis", "verdict", "jobTitle", "companyName", "jobSummary"]
    };
  }

  public async evaluateJob(userProfile: any, cvText: string, jobDescription: string): Promise<any> {
    const prompt = `
      Evaluate the following job against the candidate's profile and CV.
      
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
