import { Schema } from '@google/genai';
import { GEMINI_MODELS, getFallbackModels } from '../config/gemini';
import { LlmWorkerService } from '../lib/services/LlmWorkerService';

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
  protected ai?: any;
  protected model: string;
  protected fallbackModels: string[];
  protected debug: boolean;
  protected useLocalCli?: boolean;

  constructor(aiClient?: any, model: string = GEMINI_MODELS.FLASH, config: BaseAgentConfig = {}) {
    this.ai = aiClient;
    this.model = model;
    this.fallbackModels = config.fallbackModels
      ? Array.isArray(config.fallbackModels)
        ? config.fallbackModels
        : [config.fallbackModels]
      : getFallbackModels(model);
    this.debug = config.debug ?? false;
    this.useLocalCli = config.useLocalCli;
  }

  protected abstract getSystemPrompt(): string;
  protected abstract getResponseSchema(): Schema | any;

  /**
   * Single call path for all structured generation.
   * Routes through the centralized LlmWorkerService, which determines
   * whether to use Antigravity CLI ('agy') or Gemini API with cascading fallbacks.
   */
  protected async generateStructuredContent<T = unknown>(
    prompt: string,
    options: GenerateOptions = {},
  ): Promise<T> {
    const systemPrompt = options.systemPrompt ?? this.getSystemPrompt();
    const schema = options.schema ?? this.getResponseSchema();
    const temperature = options.temperature ?? DEFAULT_TEMPERATURE;
    const debug = options.debug ?? this.debug;

    this.log(debug, `[${this.constructor.name}] Delegating to LlmWorkerService...`, {
      model: this.model,
      hasSchema: !!schema,
    });

    return LlmWorkerService.generateStructured<T>({
      prompt,
      systemPrompt,
      schema,
      model: this.model,
      fallbackModels: this.fallbackModels,
      temperature,
      timeoutMs: 120000,
      debug,
      useLocalCli: this.useLocalCli,
    });
  }

  /** Validates and parses raw text into a JSON object, stripping markdown blocks if needed. */
  protected parseAndValidateJson<T>(rawText: string): T {
    return LlmWorkerService.parseJsonSafely<T>(rawText);
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
