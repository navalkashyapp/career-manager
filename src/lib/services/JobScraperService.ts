import { chromium } from 'playwright';

export class JobScraperService {
  /**
   * Scrapes the text content of a given URL.
   * This is a generic Playwright scraper that replaces the complex ATS-specific
   * integrations in career-ops/scan.mjs for now.
   * 
   * @param url The URL of the job posting
   * @returns The visible text content of the page
   */
  public static async scrapeJobPosting(url: string): Promise<string> {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      
      // Navigate and wait for domcontentloaded instead of networkidle, as LinkedIn keeps connections open
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000); // Wait 2s for dynamic content to render

      // Remove irrelevant elements that might pollute the JD text
      await page.evaluate(() => {
        const elementsToRemove = document.querySelectorAll('nav, footer, script, style, noscript, iframe');
        elementsToRemove.forEach(el => el.remove());
      });

      // Extract the visible innerText of the body
      const textContent = await page.evaluate(() => {
        return document.body.innerText;
      });

      // Simple cleanup of excessive whitespace
      const cleanText = textContent
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      return cleanText;
    } catch (error) {
      console.error(`Failed to scrape job posting at ${url}:`, error);
      throw new Error(`Scraping failed: ${(error as Error).message}`);
    } finally {
      await browser.close();
    }
  }
}
