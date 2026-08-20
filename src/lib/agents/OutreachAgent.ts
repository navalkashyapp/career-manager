import { GoogleGenAI, Type, Schema } from '@google/genai';
import { GEMINI_MODELS } from '../../config/gemini';
import { callGeminiApi } from '../utils/geminiClient';

export class OutreachAgent {
  private ai: GoogleGenAI;

  constructor(ai: GoogleGenAI) {
    this.ai = ai;
  }

  public async draft(
    payload: any,
    onRetry?: (
      attempt: number,
      delayMs: number,
      timeElapsedMs: number,
      maxTimeoutMs: number,
    ) => void,
  ): Promise<any> {
    const { jdText, profileData, messageType } = payload;

    // Agent 1: The Extractor (Flash)
    const extractPrompt = `
You are an expert technical recruiter and text analyst.
I have a raw job description that may contain noise, boilerplate, EEO statements, or formatting artifacts.
Extract ALL core job responsibilities, ALL required and preferred tech stack/skills, and ALL key company details. 
Do NOT omit any technical requirements or role expectations. Return a comprehensive, clean version of the actual job without the noise. Do not include a conversational preamble.

RAW JOB DESCRIPTION:
${jdText}
    `;

    const extractedJdResponse = await callGeminiApi({
      model: GEMINI_MODELS.FLASH,
      contents: extractPrompt,
      config: { maxOutputTokens: 8192 },
      maxTimeoutMs: 120000,
      onRetry,
    });

    const cleanedJd = extractedJdResponse.text;

    // Agent 2: The Drafter (Pro)
    const draftPrompt = `
You are an expert executive career strategist. 
Analyze this CLEANED Job Description: 
${cleanedJd}

And this Candidate Profile: 
${JSON.stringify(profileData)}

Generate a highly compelling, crisp, 150-word email for type: ${messageType}.
Ensure tone is confident, professional, peer-to-peer, and highlights relevant metrics from the profile.
Only output the subject and body of the email.

Return the result as a JSON object with this structure:
{
  "subject": "string",
  "body": "string"
}
    `;

    const response = await callGeminiApi({
      model: GEMINI_MODELS.PRO,
      contents: draftPrompt,
      config: {
        responseMimeType: 'application/json',
      },
      maxTimeoutMs: 600000,
      onRetry,
    });

    return JSON.parse(response.text || '{}');
  }
}
