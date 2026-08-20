import { GoogleGenAI } from '@google/genai';
import { withExponentialBackoff } from './withExponentialBackoff';

let ai: GoogleGenAI;

export async function callGeminiApi(options: {
  model: string;
  contents: string | any[];
  config?: any;
  maxTimeoutMs?: number;
  onRetry?: (attempt: number, delayMs: number, timeElapsedMs: number, maxTimeoutMs: number) => void;
}) {
  const { model, contents, config, maxTimeoutMs = 30000, onRetry } = options;

  const apiKeys = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY,
  ].filter(Boolean) as string[];

  if (apiKeys.length === 0) {
    throw new Error('No GEMINI_API_KEY provided in environment variables.');
  }

  console.log('='.repeat(60));
  console.log(`[Gemini API Request] Model: ${model}`);
  console.log(
    `[Gemini API Request] Contents:\n`,
    typeof contents === 'string' ? contents : JSON.stringify(contents, null, 2),
  );
  if (config) {
    console.log(`[Gemini API Request] Config:\n`, JSON.stringify(config, null, 2));
  }
  console.log('='.repeat(60));

  const response = await withExponentialBackoff(
    async (keyIndex) => {
      const currentKey = apiKeys[keyIndex % apiKeys.length];
      const aiClient = new GoogleGenAI({ apiKey: currentKey });

      return aiClient.models.generateContent({
        model,
        contents,
        config,
      });
    },
    maxTimeoutMs,
    onRetry,
  );

  console.log('='.repeat(60));
  console.log(`[Gemini API Response] Model: ${model}`);
  console.log(`[Gemini API Response] Usage:\n`, JSON.stringify(response.usageMetadata, null, 2));
  console.log(`[Gemini API Response] Response Text:\n`, response.text);
  console.log('='.repeat(60));

  return response;
}
