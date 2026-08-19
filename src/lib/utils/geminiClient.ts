import { GoogleGenAI } from '@google/genai';
import { withExponentialBackoff } from './withExponentialBackoff';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function callGeminiApi(options: {
  model: string;
  contents: string | any[];
  config?: any;
}) {
  const { model, contents, config } = options;

  console.log('='.repeat(60));
  console.log(`[Gemini API Request] Model: ${model}`);
  console.log(`[Gemini API Request] Contents:\n`, typeof contents === 'string' ? contents : JSON.stringify(contents, null, 2));
  if (config) {
    console.log(`[Gemini API Request] Config:\n`, JSON.stringify(config, null, 2));
  }
  console.log('='.repeat(60));

  const response = await withExponentialBackoff(() => 
    ai.models.generateContent({
      model,
      contents,
      config
    })
  );

  console.log('='.repeat(60));
  console.log(`[Gemini API Response] Model: ${model}`);
  console.log(`[Gemini API Response] Usage:\n`, JSON.stringify(response.usageMetadata, null, 2));
  console.log(`[Gemini API Response] Response Text:\n`, response.text);
  console.log('='.repeat(60));

  return response;
}
