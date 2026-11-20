import { LlmWorkerService } from '../services/LlmWorkerService';
import { getFallbackModels } from '../../config/gemini';

export async function callGeminiApi(options: {
  model: string;
  fallbackModels?: string | string[];
  contents: string | any[];
  config?: any;
  maxTimeoutMs?: number;
  onRetry?: (attempt: number, delayMs: number, timeElapsedMs: number, maxTimeoutMs: number) => void;
}) {
  const {
    model,
    fallbackModels = getFallbackModels(options.model),
    contents,
    config,
    maxTimeoutMs = 120000,
    onRetry,
  } = options;

  const promptText = typeof contents === 'string' ? contents : JSON.stringify(contents);

  const res = await LlmWorkerService.generate({
    prompt: promptText,
    model,
    fallbackModels,
    schema: config?.responseSchema,
    temperature: config?.temperature ?? 0,
    maxOutputTokens: config?.maxOutputTokens,
    timeoutMs: maxTimeoutMs,
    onRetry,
  });

  return {
    text: res.text,
    usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 },
  };
}
