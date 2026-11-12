import { chromium } from 'playwright';

export class JobScraperService {
  /**
   * Cleans raw HTML snippet into readable plain text while preserving structure.
   */
  private static cleanHtmlToText(html: string): string {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n+/g, '\n\n')
      .trim();
  }

  /**
   * Attempts to fetch LinkedIn job postings directly from the lightweight guest API.
   * LinkedIn hosts an unauthenticated job snippet endpoint:
   *   GET https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/<jobId>
   * Returns cleaned text content or null if not applicable / rate limited.
   */
  private static async fetchLinkedInGuestApi(url: string): Promise<string | null> {
    try {
      const match =
        url.match(/linkedin\.com\/jobs\/view\/(\d+)/i) || url.match(/currentJobId=(\d+)/i);
      if (!match) return null;

      const jobId = match[1];
      const guestApiUrl = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`;

      const res = await fetch(guestApiUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (!res.ok) {
        return null;
      }

      const html = await res.text();
      // Ensure the response has meaningful job content and isn't a login redirect
      if (html.includes('top-card-layout') || html.includes('show-more-less-html__markup')) {
        const text = this.cleanHtmlToText(html);
        if (text && text.length > 200) {
          return text;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Scrapes the text content of a given URL.
   * 1. Attempts the fast zero-auth LinkedIn Guest API first (if LinkedIn URL).
   * 2. Falls back to stealth Playwright with automation fingerprint evasion.
   *
   * @param url The URL of the job posting
   * @returns The visible text content of the page
   */
  public static async scrapeJobPosting(url: string): Promise<string> {
    // 1. Fast path: LinkedIn Guest API
    if (url.includes('linkedin.com')) {
      const guestText = await this.fetchLinkedInGuestApi(url);
      if (guestText) {
        return guestText;
      }
    }

    // 2. Fallback: Stealth Playwright
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    try {
      const context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 768 },
        locale: 'en-US',
        timezoneId: 'America/New_York',
        extraHTTPHeaders: {
          'Accept-Language': 'en-US,en;q=0.9',
          'Sec-Ch-Ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
        },
      });

      const page = await context.newPage();

      // Mask automation fingerprints before any page scripts execute
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        (window as any).chrome = { runtime: {} };
      });

      // Navigate and wait for domcontentloaded instead of networkidle
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000); // Allow dynamic hydration

      // Check if redirected to authwall
      const pageTitle = await page.title();
      if (
        pageTitle.toLowerCase().includes('log in') ||
        pageTitle.toLowerCase().includes('sign up')
      ) {
        throw new Error('Hit authwall/login redirection');
      }

      // Remove irrelevant elements that pollute the JD text
      await page.evaluate(() => {
        const elementsToRemove = document.querySelectorAll(
          'nav, footer, script, style, noscript, iframe',
        );
        elementsToRemove.forEach((el) => el.remove());
      });

      // Extract the visible innerText of the body
      const textContent = await page.evaluate(() => {
        return document.body.innerText;
      });

      // Cleanup excessive whitespace
      const cleanText = textContent.replace(/\n{3,}/g, '\n\n').trim();
      return cleanText;
    } catch (error) {
      console.error(`Failed to scrape job posting at ${url}:`, error);
      throw new Error(`Scraping failed: ${(error as Error).message}`);
    } finally {
      await browser.close();
    }
  }
}
