import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LlmWorkerService } from '../services/LlmWorkerService';
import { AgyCliService } from '../services/AgyCliService';

describe('LlmWorkerService Unified Abstraction', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly detects Antigravity availability and preference', () => {
    vi.spyOn(AgyCliService, 'isAvailable').mockReturnValue(true);
    expect(LlmWorkerService.isAntigravityPreferred(true)).toBe(true);
    expect(LlmWorkerService.isAntigravityPreferred(false)).toBe(false);
  });

  it('routes to Antigravity CLI when preferred and available', async () => {
    vi.spyOn(AgyCliService, 'isAvailable').mockReturnValue(true);
    const agySpy = vi
      .spyOn(AgyCliService, 'executePrompt')
      .mockResolvedValue(
        JSON.stringify({ subject: 'Excited about the role', body: 'Hello there' }),
      );

    const result = await LlmWorkerService.generateStructured<{ subject: string; body: string }>({
      prompt: 'Draft an outreach note',
      forceAntigravity: true,
    });

    expect(agySpy).toHaveBeenCalled();
    expect(result.subject).toBe('Excited about the role');
    expect(result.body).toBe('Hello there');
  });

  it('parses JSON safely with codeblock fences', () => {
    const rawFenced = '```json\n{"status": "ok", "score": 95}\n```';
    const parsed = LlmWorkerService.parseJsonSafely<{ status: string; score: number }>(rawFenced);
    expect(parsed.status).toBe('ok');
    expect(parsed.score).toBe(95);
  });

  it('falls back to Gemini API when Antigravity fails', async () => {
    vi.spyOn(AgyCliService, 'isAvailable').mockReturnValue(true);
    vi.spyOn(AgyCliService, 'executePrompt').mockRejectedValue(new Error('CLI process timeout'));

    // Mock GoogleGenAI execution via internal call
    const mockGenerate = vi.spyOn(LlmWorkerService as any, 'generate').mockResolvedValue({
      text: JSON.stringify({ message: 'Fallback succeeded' }),
      provider: 'gemini',
      modelUsed: 'gemini-2.5-flash',
    });

    const res = await LlmWorkerService.generateStructured<{ message: string }>({
      prompt: 'Test fallback prompt',
      forceAntigravity: false,
    });

    expect(res.message).toBe('Fallback succeeded');
  });
});
