export async function withExponentialBackoff<T>(
  operation: (keyIndex: number, currentModel?: string) => Promise<T>,
  timeoutMs: number = 600000, // 600 seconds
  onRetry?: (attempt: number, delayMs: number, timeElapsedMs: number, maxTimeoutMs: number) => void,
  fallbackModels?: string | string[],
): Promise<T> {
  const startTime = Date.now();
  let delay = 2000;
  let attempt = 1;

  const fallbacks: string[] = Array.isArray(fallbackModels)
    ? fallbackModels
    : fallbackModels
      ? [fallbackModels]
      : [];
  let fallbackIndex = 0;
  let activeModel: string | undefined = undefined;

  while (true) {
    try {
      const keyIndex = attempt - 1;
      return await operation(keyIndex, activeModel);
    } catch (err: any) {
      const is503 =
        err?.status === 503 ||
        err?.code === 503 ||
        err?.status === 'UNAVAILABLE' ||
        err?.message?.includes('503') ||
        err?.message?.includes('high demand') ||
        err?.message?.includes('UNAVAILABLE') ||
        err?.error?.code === 503 ||
        err?.error?.status === 'UNAVAILABLE';

      const is429 =
        err?.status === 429 ||
        err?.code === 429 ||
        err?.error?.code === 429 ||
        err?.message?.includes('429');

      const isResourceExhausted =
        is429 ||
        err?.status === 'RESOURCE_EXHAUSTED' ||
        err?.error?.status === 'RESOURCE_EXHAUSTED' ||
        err?.message?.includes('RESOURCE_EXHAUSTED') ||
        err?.message?.includes('Quota exceeded');

      if (!is503 && !isResourceExhausted) {
        throw err;
      }

      // If we encounter 503 (model overloaded) OR 429/RESOURCE_EXHAUSTED (quota reached for model) and have fallback models:
      if ((is503 || isResourceExhausted) && fallbackIndex < fallbacks.length) {
        const failedModel = activeModel || 'primary';
        const nextModel = fallbacks[fallbackIndex++];
        activeModel = nextModel;

        console.warn(
          `[API ${is503 ? '503 Overloaded' : '429 Quota'}] Model "${failedModel}" failed (${is503 ? 'High demand' : 'Quota exhausted'}). Seamlessly falling back to "${nextModel}"...`,
        );

        // Immediate retry with the fallback model without waiting for backoff delay
        attempt++;
        continue;
      }

      const timeElapsed = Date.now() - startTime;
      if (timeElapsed + delay > timeoutMs) {
        throw new Error(
          `Timeout of ${timeoutMs}ms exceeded while retrying API. Last error: ${err.message || JSON.stringify(err)}`,
        );
      }

      console.warn(
        `[API Error] ${err.status || err.message || 'Service Error'}. Retrying in ${delay / 1000} seconds...`,
      );
      if (onRetry) {
        onRetry(attempt, delay, timeElapsed, timeoutMs);
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, 30000); // Exponential backoff with 30s cap
      attempt++;
    }
  }
}
