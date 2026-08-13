import { GoogleGenAI } from '@google/genai';
import { BaseAgent } from '../../agents/BaseAgent';
import { InterviewCoachInput, InterviewCoachResult } from '../types/careerOpsTypes';
import { interviewCoachPrompt } from '../prompts/interviewCoachPrompt';

export class InterviewCoachAgent extends BaseAgent {
  constructor(aiClient: GoogleGenAI) {
    super(aiClient);
  }

  protected getSystemPrompt(): string {
    return interviewCoachPrompt;
  }

  protected getResponseSchema(): any {
    return {
      type: "object",
      properties: {
        recruiterScreenPrep: {
          type: "object",
          properties: {
            expectedQuestions: { type: "array", items: { type: "string" } },
            compensationStrategy: { type: "string" }
          },
          required: ["expectedQuestions", "compensationStrategy"]
        },
        hiringManagerPrep: {
          type: "object",
          properties: {
            technicalPriorities: { type: "array", items: { type: "string" } },
            companyMilestones: { type: "array", items: { type: "string" } }
          },
          required: ["technicalPriorities", "companyMilestones"]
        },
        peerPanelPrep: {
          type: "object",
          properties: {
            technicalQuestions: { type: "array", items: { type: "string" } },
            systemDesignTopics: { type: "array", items: { type: "string" } }
          },
          required: ["technicalQuestions", "systemDesignTopics"]
        },
        recommendedStarStories: {
          type: "array",
          items: {
            type: "object",
            properties: {
              storyTitle: { type: "string" },
              situation: { type: "string" },
              task: { type: "string" },
              action: { type: "string" },
              result: { type: "string" },
              relevanceToJob: { type: "string" }
            },
            required: ["storyTitle", "situation", "task", "action", "result", "relevanceToJob"]
          }
        }
      },
      required: ["recruiterScreenPrep", "hiringManagerPrep", "peerPanelPrep", "recommendedStarStories"]
    };
  }

  public async prep(input: InterviewCoachInput): Promise<InterviewCoachResult> {
    const prompt = `
Company: ${input.companyName}
Role: ${input.roleTitle}

Candidate Profile:
${JSON.stringify(input.userProfile, null, 2)}

Candidate CV:
${input.cvText}

Job Description:
${input.jobDescription}
`;
    return (await this.generateStructuredContent(prompt)) as InterviewCoachResult;
  }
}
