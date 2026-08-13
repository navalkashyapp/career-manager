import { BaseAgent } from './BaseAgent';
import { Type, Schema } from '@google/genai';

export class InterviewCoachAgent extends BaseAgent {
  protected getSystemPrompt(): string {
    return `You are the Interview Prep & AI Simulation Debrief Agent.`;
  }

  protected getResponseSchema(): Schema {
    return { type: Type.OBJECT };
  }

  public async generatePrepPlan(userProfile: any, cvText: string, jobDescription: string): Promise<any> {
    const prompt = `
      Create a time-blocked technical and behavioral preparation agenda customized specifically to the delta between the user's resume and the job requirements.
      User Profile: ${JSON.stringify(userProfile)}
      CV: ${cvText}
      JD: ${jobDescription}
    `;
    const schema = {
      type: Type.OBJECT,
      properties: {
        timeBlockedAgenda: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              day: { type: Type.STRING },
              focusTopic: { type: Type.STRING },
              suggestedResources: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            }
          }
        }
      },
      required: ["timeBlockedAgenda"]
    };
    return this.generateStructuredContent(prompt, this.getSystemPrompt(), schema);
  }

  public async generateMockQuestion(jobDescription: string, chatHistory: string): Promise<any> {
    const prompt = `
      Act as an expert hiring manager for the target company. 
      Review the chat history and the JD.
      Generate a single, highly targeted interview question. Score the user's previous answer (if any) and output feedback plus the next question.
      JD: ${jobDescription}
      Chat History: ${chatHistory}
    `;
    const schema = {
      type: Type.OBJECT,
      properties: {
        feedbackOnPreviousAnswer: { type: Type.STRING },
        score: { type: Type.NUMBER },
        nextQuestion: { type: Type.STRING }
      },
      required: ["feedbackOnPreviousAnswer", "score", "nextQuestion"]
    };
    return this.generateStructuredContent(prompt, this.getSystemPrompt(), schema);
  }

  public async generateDebrief(interviewTranscript: string): Promise<any> {
    const prompt = `
      Analyze this raw text transcript from an actual interview to detect gaps, mistakes, or missed opportunities.
      Output suggested areas of improvement to update the user's profile.
      Transcript: ${interviewTranscript}
    `;
    const schema = {
      type: Type.OBJECT,
      properties: {
        detectedGaps: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        profileUpdates: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      },
      required: ["detectedGaps", "profileUpdates"]
    };
    return this.generateStructuredContent(prompt, this.getSystemPrompt(), schema);
  }
}
