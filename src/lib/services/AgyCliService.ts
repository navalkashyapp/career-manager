export class AgyCliService {
  private static resolvedAgyPath: string | null = null;

  /**
   * Resolves the agy binary path in Node.js, or falls back to 'agy'.
   */
  public static async getAgyBinaryPath(): Promise<string> {
    if (this.resolvedAgyPath) return this.resolvedAgyPath;

    if (typeof window !== 'undefined') {
      return 'agy';
    }

    if (typeof process !== 'undefined' && process.env?.AGY_BIN_PATH) {
      this.resolvedAgyPath = process.env.AGY_BIN_PATH;
      return this.resolvedAgyPath;
    }

    try {
      const fs = await import(/* @vite-ignore */ 'fs');
      const candidatePaths = [
        '/home/naval/.local/bin/agy',
        '/usr/local/bin/agy',
        process.env.HOME ? `${process.env.HOME}/.local/bin/agy` : '',
        '/usr/bin/agy',
      ].filter(Boolean) as string[];

      for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
          this.resolvedAgyPath = p;
          return this.resolvedAgyPath;
        }
      }
    } catch {}

    this.resolvedAgyPath = 'agy';
    return this.resolvedAgyPath;
  }

  /**
   * Checks whether the agy CLI binary is accessible on the system.
   */
  public static isAvailable(): boolean {
    return true;
  }

  /**
   * Executes a prompt through the local Antigravity Pro CLI.
   * In the browser, routes to /api/gemini/agy-proxy.
   * In Node.js, directly executes the agy binary.
   */
  public static async executePrompt(
    prompt: string,
    schema?: any,
    options: { timeoutMs?: number; debug?: boolean } = {},
  ): Promise<string> {
    const timeout = options.timeoutMs ?? 120000;

    let fullPrompt = prompt;
    if (schema) {
      fullPrompt += `\n\nCRITICAL OUTPUT REQUIREMENT:\nYou MUST output ONLY a single, valid raw JSON object strictly conforming to the following JSON schema.\nDo NOT include markdown fences (no \`\`\`json or \`\`\`), no conversational text, no commentary, no preamble, and no trailing explanation.\nSCHEMA:\n${JSON.stringify(schema, null, 2)}`;
    }

    // 1. Browser environment: route to backend proxy
    if (typeof window !== 'undefined') {
      const baseUrl = (typeof process !== 'undefined' && process.env?.VITE_BACKEND_URL) || '';
      const res = await fetch(`${baseUrl}/api/gemini/agy-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: fullPrompt }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `AGY CLI Proxy HTTP ${res.status}`);
      }
      const data = await res.json();
      return (data.text || '').trim();
    }

    // 2. Node.js backend environment: execute local agy binary directly
    const agyBin = await this.getAgyBinaryPath();
    const { execFile } = await import(/* @vite-ignore */ 'child_process');

    if (options.debug) {
      console.log(`[AgyCliService] Executing via ${agyBin} (timeout: ${timeout}ms)...`);
    }

    return new Promise((resolve, reject) => {
      execFile(
        agyBin,
        ['-p', fullPrompt],
        { maxBuffer: 15 * 1024 * 1024, timeout },
        (error: any, stdout: string, stderr: string) => {
          if (error) {
            if (options.debug && stderr) console.error('[AgyCliService stderr]:', stderr);
            return reject(error);
          }
          resolve((stdout || '').trim());
        },
      );
    });
  }
}
