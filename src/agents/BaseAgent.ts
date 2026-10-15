import { GoogleGenAI, Schema } from '@google/genai';
import { GEMINI_MODELS, getFallbackModels } from '../config/gemini';
import { callGeminiApi } from '../lib/utils/geminiClient';
import { withExponentialBackoff } from '../lib/utils/withExponentialBackoff';
import { AgyCliService } from '../lib/services/AgyCliService';

export interface GenerateOptions {
  /** Replaces the agent's default system prompt for this call. */
  systemPrompt?: string;
  /** Replaces the agent's default response schema for this call. */
  schema?: Schema;
  /** Defaults to 0. Structured extraction should be deterministic. */
  temperature?: number;
  /** JSON repair retries. Defaults to 2. */
  maxRetries?: number;
  /** Per-call log override. */
  debug?: boolean;
}

export interface BaseAgentConfig {
  debug?: boolean;
  fallbackModels?: string | string[];
  useLocalCli?: boolean;
}

const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_TEMPERATURE = 0;

export abstract class BaseAgent {
  protected ai?: GoogleGenAI;
  protected model: string;
  protected fallbackModels: string[];
  protected debug: boolean;
  protected useLocalCli: boolean;

  constructor(
    aiClient?: GoogleGenAI,
    model: string = GEMINI_MODELS.FLASH,
    config: BaseAgentConfig = {},
  ) {
    this.ai = aiClient;
    this.model = model;
    this.fallbackModels = config.fallbackModels
      ? Array.isArray(config.fallbackModels)
        ? config.fallbackModels
        : [config.fallbackModels]
      : getFallbackModels(model);
    this.debug = config.debug ?? false;
    this.useLocalCli =
      config.useLocalCli ??
      (process.env.USE_LOCAL_CLI === 'true' ||
        process.env.VITE_USE_LOCAL_CLI === 'true' ||
        process.env.USE_AGY === 'true');
  }

  protected abstract getSystemPrompt(): string;
  protected abstract getResponseSchema(): Schema | any;

  /**
   * Single call path for all structured generation.
   * If USE_LOCAL_CLI is enabled, routes through the user's Pro Antigravity CLI (`agy`).
   * Otherwise uses GoogleGenAI SDK with backoff, model cascades, and emergency fallback to `agy`.
   */
  protected async generateStructuredContent<T = unknown>(
    prompt: string,
    options: GenerateOptions = {},
  ): Promise<T> {
    const systemPrompt = options.systemPrompt ?? this.getSystemPrompt();
    const schema = options.schema ?? this.getResponseSchema();
    const temperature = options.temperature ?? DEFAULT_TEMPERATURE;
    const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    const debug = options.debug ?? this.debug;

    let fullPrompt = `${systemPrompt}\n\n---\nUSER REQUEST:\n${prompt}`;
    let lastError: unknown = null;

    // 1. Pro Antigravity CLI routing when USE_LOCAL_CLI is enabled
    if (this.useLocalCli && AgyCliService.isAvailable()) {
      this.log(
        debug,
        `AI REQUEST [${this.constructor.name}] (Routing via Pro Antigravity CLI 'agy')`,
        fullPrompt,
      );

      const maxAgyAttempts = 1;
      for (let attempt = 0; attempt < maxAgyAttempts; attempt++) {
        try {
          const rawText = await AgyCliService.executePrompt(fullPrompt, schema, {
            timeoutMs: 120000,
            debug,
          });
          this.log(debug, `AI RESPONSE [${this.constructor.name}] from agy`, rawText);
          return this.parseAndValidateJson<T>(rawText);
        } catch (error) {
          lastError = error;
          this.log(debug, `AI FAILED [${this.constructor.name}] agy attempt ${attempt + 1}`, error);
        }
      }

      this.log(
        debug,
        `[${this.constructor.name}] agy attempts failed, falling back immediately to GoogleGenAI SDK...`,
      );
    }

    const apiKeys = [
      process.env.GEMINI_API_KEY_1,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY,
    ].filter(Boolean) as string[];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let rawText = '';
      try {
        this.log(debug, `AI REQUEST [${this.constructor.name}] attempt ${attempt + 1}`, fullPrompt);

        // Directly call the GoogleGenAI SDK instance to ensure structured output with 503 fallback
        const response = await withExponentialBackoff(
          async (keyIndex, modelToUse) => {
            const effectiveModel = modelToUse || this.model;
            if (modelToUse && modelToUse !== this.model) {
              this.log(
                debug,
                `AI FALLBACK [${this.constructor.name}] Using fallback model: ${effectiveModel}`,
              );
            }
            const keyToUse = apiKeys.length > 0 ? apiKeys[keyIndex % apiKeys.length] : undefined;
            const client =
              keyIndex === 0 && this.ai
                ? this.ai
                : keyToUse
                  ? new GoogleGenAI({ apiKey: keyToUse })
                  : this.ai || new GoogleGenAI({ apiKey: '' });
            return client.models.generateContent({
              model: effectiveModel,
              contents: fullPrompt,
              config: {
                responseMimeType: 'application/json',
                responseSchema: schema,
                temperature,
              },
            });
          },
          60000,
          undefined,
          this.fallbackModels,
        );

        rawText = response?.text ?? '';
        this.log(debug, `AI RESPONSE [${this.constructor.name}]`, rawText);

        return this.parseAndValidateJson<T>(rawText);
      } catch (error) {
        lastError = error;
        this.log(debug, `AI FAILED [${this.constructor.name}] attempt ${attempt + 1}`, error);

        // Emergency failover to local agy CLI if available
        if (AgyCliService.isAvailable()) {
          try {
            this.log(
              debug,
              `AI EMERGENCY FAILOVER [${this.constructor.name}] API failed, falling back to Pro agy CLI...`,
            );
            const agyRaw = await AgyCliService.executePrompt(fullPrompt, schema, {
              timeoutMs: 120000,
              debug,
            });
            return this.parseAndValidateJson<T>(agyRaw);
          } catch (agyErr) {
            this.log(
              debug,
              `AI EMERGENCY FAILOVER [${this.constructor.name}] agy also failed:`,
              agyErr,
            );
          }
        }

        fullPrompt +=
          '\n\nYour previous response was not valid JSON. ' +
          'Return ONLY the JSON object matching the schema: no commentary, no markdown fences, no extra text.';
      }
    }

    const detail = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(
      `AI generation failed in ${this.constructor.name} after ${maxRetries + 1} attempts: ${detail}`,
    );
  }

  /** Validates and parses raw text into a JSON object, stripping markdown blocks if needed. */
  protected parseAndValidateJson<T>(rawText: string): T {
    if (!rawText || !rawText.trim()) {
      throw new Error('Received empty response text.');
    }

    try {
      return JSON.parse(rawText) as T;
    } catch {
      // Strip any markdown codeblock fences if present
      const stripped = rawText.replace(/```(?:json)?\n?([\s\S]*?)```/g, '$1').trim();
      try {
        return JSON.parse(stripped) as T;
      } catch {
        const salvaged = this.extractJsonObject(rawText);
        if (salvaged) {
          return JSON.parse(salvaged) as T;
        }
        throw new Error(`Invalid JSON returned: ${rawText.slice(0, 200)}`);
      }
    }
  }

  /** Best-effort extraction of the largest {...} block from a response. */
  protected extractJsonObject(text: string): string | null {
    if (!text) return null;
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    return text.slice(start, end + 1);
  }

  private log(debug: boolean, label: string, ...args: unknown[]): void {
    if (debug) console.log(`\n===== ${label} =====\n`, ...args, '\n====================\n');
  }

  /** Truncate runaway inputs (DOM dumps, 20-page CVs) with a visible marker. */
  protected truncate(text: string, maxChars: number, label = 'input'): string {
    if (!text || text.length <= maxChars) return text;
    return (
      text.slice(0, maxChars) +
      `\n\n[... truncated: ${label} was ${text.length} chars, kept first ${maxChars} ...]`
    );
  }
}
