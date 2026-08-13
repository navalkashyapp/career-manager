import { GoogleGenAI, Type, Schema } from '@google/genai';
import { GEMINI_MODELS } from '../../config/gemini';

export class OutreachAgent {
  private ai: GoogleGenAI;

  constructor(ai: GoogleGenAI) {
    this.ai = ai;
  }

  public async draft(payload: any): Promise<any> {
    const { jdText, profileData, messageType } = payload;
    const prompt = `
You are an expert executive career strategist. 
Analyze this Job Description: ${jdText}
And this Candidate Profile: ${JSON.stringify(profileData)}

Generate a highly compelling, crisp, 150-word email for type: ${messageType}.
Ensure tone is confident, professional, peer-to-peer, and highlights relevant metrics (e.g., 1000+ service migrations, cloud infrastructure).
Only output the subject and body of the email.

Return the result as a JSON object with this structure:
{
  "subject": "string",
  "body": "string"
}
    `;

    const response = await this.ai.models.generateContent({
      model: GEMINI_MODELS.FLASH,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });
    
    return JSON.parse(response.text || '{}');
  }
}
