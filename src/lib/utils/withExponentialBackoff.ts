export async function withExponentialBackoff<T>(
  operation: () => Promise<T>,
  timeoutMs: number = 600000 // 600 seconds
): Promise<T> {
  const startTime = Date.now();
  let delay = 5000;

  while (true) {
    try {
      return await operation();
    } catch (err: any) {
      const is503 = err?.status === 503 || err?.message?.includes('503') || err?.message?.includes('high demand');
      const is429 = err?.status === 429 || err?.message?.includes('429');
      
      if (!is503 && !is429) {
        throw err;
      }

      if (Date.now() - startTime + delay > timeoutMs) {
        throw new Error(`Timeout of ${timeoutMs}ms exceeded while retrying API. Last error: ${err.message}`);
      }

      console.warn(`[API Error] ${err.status || err.message}. Retrying in ${delay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
}
