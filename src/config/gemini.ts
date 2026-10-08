export const GEMINI_MODELS = {
  FLASH: process.env.GEMINI_MODEL_FLASH || process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  PRO: process.env.GEMINI_MODEL_PRO || 'gemini-3.1-pro-preview',
  FALLBACK_FLASH:
    process.env.GEMINI_MODEL_FALLBACK_FLASH ||
    process.env.GEMINI_FALLBACK_MODEL ||
    'gemini-2.5-flash',
  FALLBACK_PRO:
    process.env.GEMINI_MODEL_FALLBACK_PRO || process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-pro',
};

/**
 * Fallback model cascades: when Google returns 503 (high demand / unavailable),
 * the agent seamlessly cascades to these models in sequence.
 */
export const GEMINI_FALLBACK_CASCADES: Record<string, string[]> = {
  'gemini-3.8-flash': ['gemini-3.7-flash', 'gemini-3.8-flash-lite', 'gemini-2.5-flash'],
  'gemini-3.1-pro-preview': ['gemini-2.5-pro', 'gemini-1.5-pro', 'gemini-2.5-flash'],
};

export function getFallbackModels(primaryModel: string): string[] {
  if (process.env.GEMINI_FALLBACK_MODEL) {
    return [process.env.GEMINI_FALLBACK_MODEL];
  }
  if (GEMINI_FALLBACK_CASCADES[primaryModel]) {
    return GEMINI_FALLBACK_CASCADES[primaryModel];
  }
  if (primaryModel.toLowerCase().includes('pro')) {
    return [GEMINI_MODELS.FALLBACK_PRO, 'gemini-2.5-flash'];
  }
  return [GEMINI_MODELS.FALLBACK_FLASH, 'gemini-3.8-flash-lite'];
}
