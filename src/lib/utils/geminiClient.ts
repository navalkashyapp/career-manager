import { GoogleGenAI } from '@google/genai';
import { withExponentialBackoff } from './withExponentialBackoff';
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
    maxTimeoutMs = 30000,
    onRetry,
  } = options;

  const getEnv = (key: string) => {
    try {
      if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
        const val = (import.meta as any).env[`VITE_${key}`] || (import.meta as any).env[key];
        if (val) return val;
      }
    } catch (e) {}
    try {
      if (typeof process !== 'undefined' && process.env) {
        return process.env[key] || process.env[`VITE_${key}`];
      }
    } catch (e) {}
    return undefined;
  };

  const isDebug = getEnv('DEBUG') === 'true';
  const useLocalCli = getEnv('USE_LOCAL_CLI') === 'true';

  if (useLocalCli) {
    console.log('='.repeat(60));
    console.log(`[AGY CLI Request] Routing to local CLI proxy...`);
    const isBrowser = typeof window !== 'undefined';
    const baseUrl = isBrowser ? getEnv('BACKEND_URL') || '' : 'http://localhost:3000';

    // Stringify contents for text CLI
    const promptText = typeof contents === 'string' ? contents : JSON.stringify(contents);
    if (isDebug) {
      console.log('[AGY CLI Request Prompt]:\n', promptText);
    } else {
      console.log(`[AGY CLI Request Prompt Length]: ${promptText.length} chars`);
    }

    const token = await (async () => {
      if (!isBrowser) return null;
      try {
        const { getIdTokenSafe } = await import('../../store/firebase');
        return await getIdTokenSafe();
      } catch {
        return null;
      }
    })();

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${baseUrl}/api/gemini/agy-proxy`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt: promptText }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`AGY CLI Proxy Error: ${err.error || res.statusText}`);
    }

    const data = await res.json();
    console.log('='.repeat(60));
    if (isDebug) {
      console.log('[AGY CLI Response] Response Text:\n', data.text);
    } else {
      console.log(`[AGY CLI Response] Length: ${data.text?.length ?? 0} chars`);
    }
    console.log('='.repeat(60));
    return {
      text: data.text,
      usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 },
    };
  }

  const apiKeys = [
    getEnv('GEMINI_API_KEY_1'),
    getEnv('GEMINI_API_KEY_2'),
    getEnv('GEMINI_API_KEY'),
  ].filter(Boolean) as string[];

  if (apiKeys.length === 0) {
    throw new Error('No GEMINI_API_KEY provided in environment variables.');
  }

  console.log('='.repeat(60));
  console.log(`[Gemini API Request] Model: ${model}`);
  if (isDebug) {
    console.log(
      `[Gemini API Request] Contents:\n`,
      typeof contents === 'string' ? contents : JSON.stringify(contents, null, 2),
    );
    if (config) {
      console.log(`[Gemini API Request] Config:\n`, JSON.stringify(config, null, 2));
    }
  } else {
    const payloadLen =
      typeof contents === 'string' ? contents.length : JSON.stringify(contents).length;
    console.log(`[Gemini API Request] Payload size: ${payloadLen} chars`);
  }
  console.log('='.repeat(60));

  let usedModel = model;
  const response = await withExponentialBackoff(
    async (keyIndex, modelToUse) => {
      usedModel = modelToUse || model;
      if (modelToUse && modelToUse !== model) {
        console.warn(
          `[Gemini API] 503 Fallback active: using model "${usedModel}" instead of "${model}"`,
        );
      }
      const currentKey = apiKeys[keyIndex % apiKeys.length];
      const aiClient = new GoogleGenAI({ apiKey: currentKey });

      return aiClient.models.generateContent({
        model: usedModel,
        contents,
        config,
      });
    },
    maxTimeoutMs,
    onRetry,
    fallbackModels,
  );

  console.log('='.repeat(60));
  console.log(`[Gemini API Response] Model: ${usedModel}`);
  if (response.usageMetadata) {
    console.log(`[Gemini API Response] Usage:\n`, JSON.stringify(response.usageMetadata, null, 2));
  }
  if (isDebug) {
    console.log(`[Gemini API Response] Response Text:\n`, response.text);
  } else {
    console.log(`[Gemini API Response] Output length: ${response.text?.length ?? 0} chars`);
  }
  console.log('='.repeat(60));

  return response;
}
