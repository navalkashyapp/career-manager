import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { JobScraperService } from './JobScraperService';
import { JobEvaluationAgent } from '../../agents/JobEvaluationAgent';
import { UserProfile } from '../../../src/types';

export class LocalConnectorService {
  private static STORE_PATH = path.join(process.cwd(), 'src', 'store', 'local-jobs.json');

  public static async runAutomatedSearch(
    keywords: string,
    profileData: UserProfile,
    ai: any,
  ): Promise<void> {
    console.log(`[Connector] Starting automated job search for: ${keywords}`);
    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage();

      // Navigate to LinkedIn Jobs search (no auth required for public search)
      const encodedQuery = encodeURIComponent(keywords);
      const searchUrl = `https://www.linkedin.com/jobs/search?keywords=${encodedQuery}&location=United%20States&f_TPR=r86400`; // Last 24 hours

      console.log(`[Connector] Navigating to ${searchUrl}`);
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Wait for job cards to load
      await page.waitForTimeout(3000); // Wait out any anti-bot or lazy loading

      // Extract job links from the public search results
      const jobLinks = await page.evaluate(() => {
        const anchors = Array.from(
          document.querySelectorAll(
            'a.base-card__full-link, a.job-search-card__title, a.base-search-card__title',
          ),
        );
        return anchors
          .map((a: any) => a.href)
          .filter((href) => href && href.includes('/jobs/view/'));
      });

      // Remove duplicates
      const uniqueLinks = Array.from(new Set(jobLinks)).slice(0, 5); // Limit to top 5 for local automation run
      console.log(`[Connector] Found ${uniqueLinks.length} jobs to evaluate.`);

      await browser.close(); // Close browser before intense scraping to save resources

      const agent = new JobEvaluationAgent(ai);
      const cvText = JSON.stringify(profileData, null, 2);

      for (const url of uniqueLinks) {
        console.log(`[Connector] Evaluating job: ${url}`);
        try {
          const jobDescription = await JobScraperService.scrapeJobPosting(url);
          if (jobDescription.length < 50) continue;

          const evaluation = await agent.evaluateJob(profileData as any, cvText, jobDescription);

          if (evaluation.overallScore >= 3.5) {
            console.log(
              `[Connector] HIGH MATCH FOUND: Score ${evaluation.overallScore} - Saving locally.`,
            );
            this.saveHighMatchJob({
              url,
              score: evaluation.overallScore,
              title: evaluation.jobTitle || 'Unknown Title',
              company: evaluation.companyName || 'Unknown Company',
              evaluationSummary: evaluation.jobSummary || '',
              timestamp: new Date().toISOString(),
            });
          } else {
            console.log(`[Connector] Score ${evaluation.overallScore} - Skipping.`);
          }
        } catch (err: any) {
          console.error(`[Connector] Error evaluating ${url}:`, err.message);
        }

        // 5-second pause between requests to respect Gemini Free Tier rate limits (15 RPM)
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      console.log(`[Connector] Automated search completed.`);
    } catch (error) {
      console.error(`[Connector] Fatal error during search:`, error);
      await browser.close();
    }
  }

  private static saveHighMatchJob(jobData: any) {
    try {
      // Ensure directory exists
      const storeDir = path.dirname(this.STORE_PATH);
      if (!fs.existsSync(storeDir)) {
        fs.mkdirSync(storeDir, { recursive: true });
      }

      let jobs: any[] = [];
      if (fs.existsSync(this.STORE_PATH)) {
        const fileContent = fs.readFileSync(this.STORE_PATH, 'utf-8');
        jobs = fileContent ? JSON.parse(fileContent) : [];
      }

      // Avoid exact duplicates
      const exists = jobs.some((j: any) => j.url === jobData.url);
      if (!exists) {
        jobs.push(jobData as any);
        fs.writeFileSync(this.STORE_PATH, JSON.stringify(jobs, null, 2));
      }
    } catch (err) {
      console.error(`[Connector] Failed to save local job:`, err);
    }
  }
}
