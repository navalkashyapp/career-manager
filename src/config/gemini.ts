export const GEMINI_MODELS = {
  FLASH: process.env.GEMINI_MODEL_FLASH || process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  PRO: process.env.GEMINI_MODEL_PRO || 'gemini-3.1-pro-preview',
  FALLBACK_FLASH:
    process.env.GEMINI_MODEL_FALLBACK_FLASH ||
    process.env.GEMINI_FALLBACK_MODEL ||
    'gemini-3.8-flash',
  FALLBACK_PRO:
    process.env.GEMINI_MODEL_FALLBACK_PRO ||
    process.env.GEMINI_FALLBACK_MODEL ||
    'gemini-3.8-flash',
};

/**
 * Fallback model cascades: when Google returns 503 (high demand / unavailable) or 429,
 * the agent seamlessly cascades to these models in sequence.
 */
export const GEMINI_FALLBACK_CASCADES: Record<string, string[]> = {
  'gemini-3.8-flash': [
    'gemini-3.8-flash',
    'gemini-flash-lite-latest',
    'gemini-3.1-flash-lite',
    'gemini-3.7-flash',
  ],
  'gemini-3.1-pro-preview': ['gemini-3.8-flash', 'gemini-3.8-flash', 'gemini-flash-lite-latest'],
};

export function getFallbackModels(primaryModel: string): string[] {
  if (process.env.GEMINI_FALLBACK_MODEL) {
    return [process.env.GEMINI_FALLBACK_MODEL];
  }
  if (GEMINI_FALLBACK_CASCADES[primaryModel]) {
    return GEMINI_FALLBACK_CASCADES[primaryModel];
  }
  if (primaryModel.toLowerCase().includes('pro')) {
    return [GEMINI_MODELS.FALLBACK_PRO, 'gemini-3.8-flash', 'gemini-flash-lite-latest'];
  }
  return [GEMINI_MODELS.FALLBACK_FLASH, 'gemini-flash-lite-latest', 'gemini-3.1-flash-lite'];
}
