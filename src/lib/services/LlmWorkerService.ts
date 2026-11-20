import { GoogleGenAI } from '@google/genai';
import { AgyCliService } from './AgyCliService';
import { withExponentialBackoff } from '../utils/withExponentialBackoff';
import { GEMINI_MODELS, getFallbackModels } from '../../config/gemini';

export interface LlmCallOptions {
  prompt: string;
  systemPrompt?: string;
  schema?: any;
  model?: string;
  fallbackModels?: string | string[];
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  debug?: boolean;
  onRetry?: (attempt: number, delayMs: number, timeElapsedMs: number, maxTimeoutMs: number) => void;
  useLocalCli?: boolean;
  forceAntigravity?: boolean;
  forceGemini?: boolean;
}

export interface LlmResponse {
  text: string;
  provider: 'antigravity' | 'gemini';
  modelUsed?: string;
}

/**
 * LlmWorkerService is the centralized worker and single source of truth
 * for all LLM calls across the application.
 *
 * It decides whether to route calls to the local Antigravity CLI ('agy') or
 * the GoogleGenAI SDK, enforcing priority, automatic fallbacks, key rotation,
 * and structured JSON validation. No other component should call Gemini API
 * or Antigravity directly.
 */
export class LlmWorkerService {
  private static cachedAiClients: Map<string, GoogleGenAI> = new Map();

  /**
   * Evaluates whether Antigravity CLI ('agy') should be prioritized for this call.
   */
  public static isAntigravityPreferred(override?: boolean): boolean {
    if (override !== undefined) {
      return override && AgyCliService.isAvailable();
    }

    const envNoCli =
      process.env.USE_LOCAL_CLI === 'false' || process.env.VITE_USE_LOCAL_CLI === 'false';
    if (envNoCli) {
      return false;
    }

    const envForceCli =
      process.env.USE_LOCAL_CLI === 'true' ||
      process.env.VITE_USE_LOCAL_CLI === 'true' ||
      process.env.USE_AGY === 'true';

    if (envForceCli) {
      return AgyCliService.isAvailable();
    }

    // Default to Antigravity CLI whenever available on the machine
    return AgyCliService.isAvailable();
  }

  /**
   * Primary unified generation entrypoint.
   */
  public static async generate(options: LlmCallOptions): Promise<LlmResponse> {
    const {
      prompt,
      systemPrompt,
      schema,
      model = GEMINI_MODELS.FLASH,
      fallbackModels = getFallbackModels(model),
      temperature = 0,
      maxOutputTokens,
      timeoutMs = 120000,
      debug = false,
      onRetry,
      useLocalCli,
      forceAntigravity = false,
      forceGemini = false,
    } = options;

    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n---\nUSER REQUEST:\n${prompt}` : prompt;

    const preferAntigravity =
      !forceGemini && (forceAntigravity || this.isAntigravityPreferred(useLocalCli));

    // 1. Prioritize Antigravity CLI when preferred
    if (preferAntigravity) {
      console.log('='.repeat(60));
      console.log(`[LlmWorker] 🚀 Routing LLM request via Antigravity CLI ('agy')...`);
      if (debug) {
        console.log(`[LlmWorker Prompt]:\n`, fullPrompt);
      } else {
        console.log(`[LlmWorker Prompt Size]: ${fullPrompt.length} chars`);
      }
      console.log('='.repeat(60));

      try {
        const rawText = await AgyCliService.executePrompt(fullPrompt, schema, {
          timeoutMs,
          debug,
        });

        console.log('='.repeat(60));
        console.log(`[LlmWorker] ✔ Completed via Antigravity CLI (${rawText.length} chars)`);
        console.log('='.repeat(60));

        return {
          text: rawText,
          provider: 'antigravity',
          modelUsed: 'agy-cli',
        };
      } catch (cliErr: any) {
        console.warn(
          `[LlmWorker] ⚠️ Antigravity CLI notice (${cliErr.message}). Falling back to Gemini API...`,
        );
      }
    }

    // 2. Fallback or primary execution via Gemini API SDK
    console.log('='.repeat(60));
    console.log(`[LlmWorker] 🌐 Routing LLM request via Gemini API (Model: ${model})...`);
    if (debug) {
      console.log(`[LlmWorker Gemini Prompt]:\n`, fullPrompt);
    } else {
      console.log(`[LlmWorker Gemini Payload Size]: ${fullPrompt.length} chars`);
    }
    console.log('='.repeat(60));

    const apiKeys = [
      process.env.GEMINI_API_KEY_1,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY,
    ].filter(Boolean) as string[];

    if (apiKeys.length === 0) {
      // If no Gemini API keys exist, attempt emergency Antigravity if available
      if (AgyCliService.isAvailable() && !preferAntigravity) {
        console.warn(
          '[LlmWorker] No Gemini API key found. Attempting emergency fallback to Antigravity CLI...',
        );
        const rawText = await AgyCliService.executePrompt(fullPrompt, schema, {
          timeoutMs,
          debug,
        });
        return { text: rawText, provider: 'antigravity', modelUsed: 'agy-cli-emergency' };
      }
      throw new Error(
        'No Gemini API key provided in environment variables and Antigravity CLI is unavailable.',
      );
    }

    let effectiveModel = model;
    const config: any = {
      temperature,
      ...(maxOutputTokens ? { maxOutputTokens } : {}),
      ...(schema ? { responseMimeType: 'application/json', responseSchema: schema } : {}),
    };

    try {
      const response = await withExponentialBackoff(
        async (keyIndex, modelToUse) => {
          effectiveModel = modelToUse || model;
          if (modelToUse && modelToUse !== model) {
            console.warn(
              `[LlmWorker] Fallback model cascading: using "${effectiveModel}" instead of "${model}"`,
            );
          }

          const currentKey = apiKeys[keyIndex % apiKeys.length];
          let client = this.cachedAiClients.get(currentKey);
          if (!client) {
            client = new GoogleGenAI({ apiKey: currentKey });
            this.cachedAiClients.set(currentKey, client);
          }

          return client.models.generateContent({
            model: effectiveModel,
            contents: fullPrompt,
            config,
          });
        },
        timeoutMs,
        onRetry,
        Array.isArray(fallbackModels) ? fallbackModels : [fallbackModels],
      );

      const responseText = response?.text ?? '';
      console.log('='.repeat(60));
      console.log(
        `[LlmWorker] ✔ Completed via Gemini API [${effectiveModel}] (${responseText.length} chars)`,
      );
      console.log('='.repeat(60));

      return {
        text: responseText,
        provider: 'gemini',
        modelUsed: effectiveModel,
      };
    } catch (apiErr: any) {
      console.error(`[LlmWorker] ✖ Gemini API failed: ${apiErr.message}`);

      // Emergency failover to Antigravity CLI if not already attempted
      if (!preferAntigravity && AgyCliService.isAvailable()) {
        try {
          console.warn(
            `[LlmWorker] 🚨 Gemini API failed. Executing EMERGENCY failover to Antigravity CLI...`,
          );
          const rawText = await AgyCliService.executePrompt(fullPrompt, schema, {
            timeoutMs,
            debug,
          });
          return { text: rawText, provider: 'antigravity', modelUsed: 'agy-cli-emergency' };
        } catch (failoverErr: any) {
          console.error(
            `[LlmWorker] Emergency Antigravity CLI failover also failed: ${failoverErr.message}`,
          );
        }
      }

      throw apiErr;
    }
  }

  /**
   * Generates text content directly.
   */
  public static async generateText(options: LlmCallOptions): Promise<string> {
    const res = await this.generate(options);
    return res.text;
  }

  /**
   * Generates structured JSON output strictly conforming to the requested schema or type.
   */
  public static async generateStructured<T = any>(options: LlmCallOptions): Promise<T> {
    const res = await this.generate(options);
    return this.parseJsonSafely<T>(res.text);
  }

  /**
   * Robust parser that extracts valid JSON objects or arrays, stripping code fences if needed.
   */
  public static parseJsonSafely<T = any>(rawText: string): T {
    if (!rawText || !rawText.trim()) {
      throw new Error('Received empty response from LLM.');
    }

    const trimmed = rawText.trim();

    // 1. Direct parse attempt
    try {
      return JSON.parse(trimmed) as T;
    } catch {}

    // 2. Strip Markdown code fences
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenceMatch) {
      try {
        return JSON.parse(fenceMatch[1].trim()) as T;
      } catch {}
    }

    // 3. Extract JSON object substring { ... }
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as T;
      } catch {}
    }

    // 4. Extract JSON array substring [ ... ]
    const firstBracket = trimmed.indexOf('[');
    const lastBracket = trimmed.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      try {
        return JSON.parse(trimmed.slice(firstBracket, lastBracket + 1)) as T;
      } catch {}
    }

    throw new Error(`Failed to parse LLM response into valid JSON: ${rawText.slice(0, 200)}`);
  }
}
