import { adminDb } from '../firebaseAdmin';
import { JobScraperService } from './JobScraperService';
import { GoogleGenAI } from '@google/genai';
import { GEMINI_MODELS } from '../../config/gemini';
import type { JobApplication, JobUrlEntry } from '../../types';

export interface WorkerOptions {
  intervalMs?: number;
  delayBetweenJobsMs?: number;
  maxPerCycle?: number;
  enabled?: boolean;
}

export interface WorkerStatus {
  isRunning: boolean;
  isProcessing: boolean;
  lastRunAt: number | null;
  pollIntervalMs: number;
  delayBetweenJobsMs: number;
  maxPerCycle: number;
  currentJob: { url: string; company?: string; targetRole?: string } | null;
  stats: {
    processedCount: number;
    successCount: number;
    failureCount: number;
    lastError?: string;
  };
}

interface ExtractedJobDetails {
  isJobPosting: boolean;
  pageType:
    | 'single_job_posting'
    | 'listing_or_search'
    | 'expired_or_closed'
    | 'company_portal'
    | 'error_page'
    | 'other';
  rejectionReason?: string;
  companyName: string;
  jobTitle: string;
  location: string;
  salaryRange: string;
  targetLevel: string;
  requirements: string[];
  jobSummary: string;
  responsibilities: string[];
  techStack: string[];
}

/**
 * Fast check to filter out URLs that are obviously NOT single job postings
 * (e.g. search pages, job alert management links, saved jobs, company home pages).
 */
export function isObviouslyNotAJobUrl(rawUrl: string): { isInvalid: boolean; reason?: string } {
  try {
    const parsed = new URL(rawUrl);
    const pathname = parsed.pathname.toLowerCase();
    const hostname = parsed.hostname.toLowerCase();

    // LinkedIn checks
    if (hostname.includes('linkedin.com')) {
      if (pathname.includes('/jobs/search') || pathname.includes('/jobs/search-results')) {
        return {
          isInvalid: true,
          reason: 'LinkedIn search results page, not an individual job posting.',
        };
      }
      if (pathname.includes('/jobs/collections/')) {
        return {
          isInvalid: true,
          reason: 'LinkedIn job collection page, not an individual job posting.',
        };
      }
      if (pathname.includes('/jobs/jam/manage')) {
        return { isInvalid: true, reason: 'LinkedIn job alert management link.' };
      }
      if (pathname.includes('/jobs/tracker') || pathname.includes('/jobs/saved')) {
        return { isInvalid: true, reason: 'LinkedIn saved jobs or tracker link.' };
      }
      if (!pathname.includes('/jobs/view/') && !pathname.includes('/jobs/')) {
        return { isInvalid: true, reason: 'Not a recognized LinkedIn job posting URL.' };
      }
    }

    // Generic job board search / alerts / home checks
    if (
      pathname === '/careers' ||
      pathname === '/careers/' ||
      pathname === '/jobs' ||
      pathname === '/jobs/' ||
      pathname === '/about' ||
      pathname === '/'
    ) {
      return { isInvalid: true, reason: 'Root portal or homepage, not a specific job vacancy.' };
    }

    if (
      pathname.includes('/search') ||
      pathname.includes('/browse') ||
      pathname.includes('/alert') ||
      pathname.includes('/login') ||
      pathname.includes('/signin') ||
      pathname.includes('/unsubscribe')
    ) {
      return { isInvalid: true, reason: 'Search, authentication, or alert preference page.' };
    }

    return { isInvalid: false };
  } catch {
    return { isInvalid: true, reason: 'Malformed URL.' };
  }
}

/**
 * Text-based signals indicating an expired, closed, or nonexistent job posting.
 */
export function detectClosedOrExpiredContent(text: string): { isClosed: boolean; reason?: string } {
  const normalized = text.toLowerCase();

  const patterns = [
    { regex: /this job has been closed/i, reason: 'Job closed by employer' },
    { regex: /this job is no longer available/i, reason: 'Job is no longer available' },
    { regex: /job has expired/i, reason: 'Job posting has expired' },
    { regex: /this posting has expired/i, reason: 'Posting has expired' },
    { regex: /no longer accepting applications/i, reason: 'No longer accepting applications' },
    { regex: /position has been filled/i, reason: 'Position has been filled' },
    { regex: /job you('re| are) looking for isn't available/i, reason: 'Job is not available' },
    {
      regex: /job you('re| are) looking for is no longer available/i,
      reason: 'Job is no longer available',
    },
    { regex: /we couldn't find that page/i, reason: 'Page not found (404)' },
    { regex: /page not found/i, reason: 'Page not found (404)' },
    { regex: /404 not found/i, reason: 'Page not found (404)' },
    { regex: /error 404/i, reason: 'Page not found (404)' },
    { regex: /this vacancy has closed/i, reason: 'Vacancy has closed' },
  ];

  for (const { regex, reason } of patterns) {
    if (regex.test(normalized)) {
      return { isClosed: true, reason };
    }
  }

  return { isClosed: false };
}

/**
 * Text-based signals indicating that the scraper was blocked or hit an anti-bot challenge.
 */
export function isScraperBlockedContent(text: string): { isBlocked: boolean; reason?: string } {
  const normalized = text.toLowerCase();

  if (
    normalized.includes('you have been blocked') ||
    normalized.includes('sorry, you have been blocked') ||
    normalized.includes('why have i been blocked') ||
    normalized.includes('cloudflare ray id') ||
    normalized.includes('please enable javascript and cookies to continue') ||
    normalized.includes('access to this page has been denied') ||
    normalized.includes('verify you are a human')
  ) {
    return {
      isBlocked: true,
      reason: 'Anti-bot or Cloudflare security block detected ("you have been blocked")',
    };
  }

  return { isBlocked: false };
}

/**
 * Heuristically infers role title and company name from URL structure when scraping is blocked.
 */
export function inferRoleAndCompanyFromUrl(
  url: string,
  fallbackCompany?: string,
  fallbackRole?: string,
): { jobTitle: string; companyName: string } {
  let jobTitle = (fallbackRole || '').trim();
  let companyName = (fallbackCompany || '').trim();

  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;

    // Check for LinkedIn pattern: /jobs/view/<slug-with-role-and-company>-<id>
    if (parsed.hostname.includes('linkedin.com')) {
      const parts = pathname.split('/').filter(Boolean);
      const lastPart = parts[parts.length - 1] || '';
      // Pattern e.g. "software-engineer-at-meta-123456"
      const match = lastPart.match(/(.+)-at-(.+)-\d+/i);
      if (match) {
        if (!jobTitle) {
          jobTitle = match[1]
            .replace(/[-_]+/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase())
            .trim();
        }
        if (!companyName) {
          companyName = match[2]
            .replace(/[-_]+/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase())
            .trim();
        }
      }
    }
  } catch {}

  return {
    jobTitle: jobTitle || 'Target Role (Scraping Blocked)',
    companyName: companyName || 'Company (Scraping Blocked)',
  };
}

export class JobUrlWorkerService {
  private static timer: NodeJS.Timeout | null = null;
  private static isRunning = false;
  private static isProcessing = false;
  private static lastRunAt: number | null = null;
  private static pollIntervalMs = 120000; // 2 minutes default
  private static delayBetweenJobsMs = 65000; // 65 seconds between jobs to avoid bot detection and rate limits
  private static maxPerCycle = 5; // Up to 5 jobs per periodic sweep
  private static currentJob: { url: string; company?: string; targetRole?: string } | null = null;

  private static stats = {
    processedCount: 0,
    successCount: 0,
    failureCount: 0,
    lastError: undefined as string | undefined,
  };

  /**
   * Start the periodic background worker.
   */
  public static start(options?: WorkerOptions): void {
    if (this.isRunning) {
      console.log('[JobUrlWorker] Worker is already running.');
      return;
    }

    if (options?.intervalMs) this.pollIntervalMs = options.intervalMs;
    if (options?.delayBetweenJobsMs) this.delayBetweenJobsMs = options.delayBetweenJobsMs;
    if (options?.maxPerCycle) this.maxPerCycle = options.maxPerCycle;

    // Read from env if configured
    if (process.env.JOB_WORKER_INTERVAL_MS) {
      const parsed = parseInt(process.env.JOB_WORKER_INTERVAL_MS, 10);
      if (!isNaN(parsed) && parsed > 0) this.pollIntervalMs = parsed;
    }
    if (process.env.JOB_WORKER_DELAY_MS) {
      const parsed = parseInt(process.env.JOB_WORKER_DELAY_MS, 10);
      if (!isNaN(parsed) && parsed >= 0) this.delayBetweenJobsMs = parsed;
    }
    if (process.env.JOB_WORKER_MAX_PER_CYCLE) {
      const parsed = parseInt(process.env.JOB_WORKER_MAX_PER_CYCLE, 10);
      if (!isNaN(parsed) && parsed > 0) this.maxPerCycle = parsed;
    }

    this.isRunning = true;
    console.log(
      `[JobUrlWorker] Starting periodic worker (Interval: ${this.pollIntervalMs / 1000}s, Delay: ${
        this.delayBetweenJobsMs / 1000
      }s, Max/Cycle: ${this.maxPerCycle})`,
    );

    // Initial check after 10 seconds of server boot
    setTimeout(() => {
      this.runCycle().catch((err) => {
        console.error('[JobUrlWorker] Initial cycle error:', err);
      });
    }, 10000);

    // Recurring interval timer
    this.timer = setInterval(() => {
      this.runCycle().catch((err) => {
        console.error('[JobUrlWorker] Scheduled cycle error:', err);
      });
    }, this.pollIntervalMs);
  }

  /**
   * Stop the periodic worker.
   */
  public static stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log('[JobUrlWorker] Periodic worker stopped.');
  }

  /**
   * Get the current status and statistics of the worker.
   */
  public static getStatus(): WorkerStatus {
    return {
      isRunning: this.isRunning,
      isProcessing: this.isProcessing,
      lastRunAt: this.lastRunAt,
      pollIntervalMs: this.pollIntervalMs,
      delayBetweenJobsMs: this.delayBetweenJobsMs,
      maxPerCycle: this.maxPerCycle,
      currentJob: this.currentJob,
      stats: { ...this.stats },
    };
  }

  /**
   * Trigger an immediate run cycle outside of the normal schedule.
   */
  public static async triggerNow(options?: { forceAll?: boolean; userId?: string }): Promise<{
    status: string;
    isProcessing: boolean;
  }> {
    if (this.isProcessing) {
      return { status: 'already_processing', isProcessing: true };
    }

    // Trigger asynchronously so API callers don't block
    this.runCycle(options).catch((err) => {
      console.error('[JobUrlWorker] Manual trigger error:', err);
    });

    return { status: 'triggered', isProcessing: true };
  }

  /**
   * Main cycle execution: searches users and processes pending job URLs one by one.
   */
  public static async runCycle(options?: { forceAll?: boolean; userId?: string }): Promise<void> {
    if (this.isProcessing) {
      console.log('[JobUrlWorker] Previous cycle still in progress. Skipping tick.');
      return;
    }

    this.isProcessing = true;
    this.lastRunAt = Date.now();

    try {
      let usersSnap;
      if (options?.userId) {
        const singleDoc = await adminDb.collection('users').doc(options.userId).get();
        usersSnap = singleDoc.exists ? [singleDoc] : [];
      } else {
        const snap = await adminDb.collection('users').get();
        usersSnap = snap.docs;
      }

      for (const userDoc of usersSnap) {
        await this.processUserQueue(userDoc.id, options?.forceAll ?? false);
      }
    } catch (error: any) {
      console.error('[JobUrlWorker] Error during runCycle:', error.message);
      this.stats.lastError = error.message;
    } finally {
      this.isProcessing = false;
      this.currentJob = null;
    }
  }

  /**
   * Processes pending job URLs for a single user one by one.
   */
  public static async processUserQueue(userId: string, forceAll = false): Promise<number> {
    const jobUrlsRef = adminDb.collection('users').doc(userId).collection('job_urls');

    // Fetch pending URLs (and failed URLs if forceAll is specified)
    let query = jobUrlsRef.where('status', '==', 'pending');
    if (!forceAll) {
      query = query.limit(this.maxPerCycle);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      return 0;
    }

    console.log(
      `[JobUrlWorker] Found ${snapshot.size} pending job URL(s) for user: ${userId}. Processing one by one...`,
    );

    let processedThisBatch = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data() as JobUrlEntry;
      await this.processOneJob(userId, doc.id, data);
      processedThisBatch++;

      // Polite delay between jobs to respect remote hosts & Gemini quotas (default 65s)
      if (processedThisBatch < snapshot.size) {
        console.log(
          `[JobUrlWorker] Sleeping for ${Math.round(
            this.delayBetweenJobsMs / 1000,
          )}s before fetching next job...`,
        );
        await new Promise((resolve) => setTimeout(resolve, this.delayBetweenJobsMs));
      }
    }

    return processedThisBatch;
  }

  /**
   * Processes a single job URL: verifies it is actually a job posting, scrapes JD,
   * extracts details via Gemini, and adds to Targeting lane ONLY if verified.
   */
  private static async processOneJob(
    userId: string,
    docId: string,
    data: JobUrlEntry,
  ): Promise<void> {
    const docRef = adminDb.collection('users').doc(userId).collection('job_urls').doc(docId);
    this.currentJob = { url: data.url, company: data.company, targetRole: data.targetRole };

    console.log(
      `\n[JobUrlWorker] ---> Validating & Ingesting: [${data.company || 'Unknown'}] ${data.url}...`,
    );

    // Step 0: Check URL structure before doing heavy scraping
    const urlCheck = isObviouslyNotAJobUrl(data.url);
    if (urlCheck.isInvalid) {
      console.warn(`[JobUrlWorker] ⛔ REJECTED URL: ${data.url} - ${urlCheck.reason}`);
      await docRef.update({
        status: 'failed',
        error: `Invalid Job URL: ${urlCheck.reason}`,
        lastTraversedAt: Date.now(),
      });
      this.stats.processedCount++;
      this.stats.failureCount++;
      this.stats.lastError = urlCheck.reason;
      return;
    }

    // Step 1: Update status to 'traversing'
    await docRef.update({
      status: 'traversing',
      lastTraversedAt: Date.now(),
      error: null,
    });

    try {
      // Step 2: Scrape job page with Playwright
      let rawText = '';
      try {
        console.log(`[JobUrlWorker] Scraping HTML text via Playwright: ${data.url}`);
        rawText = await JobScraperService.scrapeJobPosting(data.url);
        console.log(`[JobUrlWorker] Scraped ${rawText.length} characters.`);
      } catch (scrapeErr: any) {
        console.warn(`[JobUrlWorker] Scraping failed for ${data.url}: ${scrapeErr.message}`);
        await docRef.update({
          status: 'failed',
          error: `Scraping failed: ${scrapeErr.message}`,
          lastTraversedAt: Date.now(),
        });
        this.stats.processedCount++;
        this.stats.failureCount++;
        this.stats.lastError = scrapeErr.message;
        return;
      }

      // Step 3: Check if scraping hit an anti-bot security challenge or "you have been blocked" page
      const blockCheck = isScraperBlockedContent(rawText);
      if (blockCheck.isBlocked) {
        const blockReason =
          'Scraping failed: anti-bot challenge encountered ("you have been blocked"). Job marked as failed.';
        console.warn(
          `[JobUrlWorker] ⚠️ BLOCKED SCRAPE: ${data.url} - ${blockReason}. Ingesting fallback into Target lane...`,
        );

        // Still add to Target lane as requested
        const { jobTitle, companyName } = inferRoleAndCompanyFromUrl(
          data.url,
          data.company,
          data.targetRole,
        );

        const placeholderMarkdown = [
          `## ${jobTitle} @ ${companyName}\n`,
          `**Location:** ${data.location || 'Remote / Unspecified'}  •  **Status:** ⚠️ Scraping Blocked\n`,
          `🔗 [View Original Job Posting](${data.url})\n`,
          '---\n',
          `### ⚠️ Automated Scraping Notice\n`,
          `The job page could not be fully scraped automatically because an anti-bot block was encountered ("you have been blocked").\n`,
          `Please open the original link directly to review requirements, or paste the job description text manually.\n\n`,
          `\`\`\`\n${rawText.slice(0, 500)}\n\`\`\`\n`,
        ].join('\n');

        const appsCol = adminDb.collection('users').doc(userId).collection('applications');
        const existingAppSnap = await appsCol.where('jobUrl', '==', data.url).limit(1).get();

        let targetAppId: string;
        if (!existingAppSnap.empty) {
          const existingDoc = existingAppSnap.docs[0];
          targetAppId = existingDoc.id;
          await existingDoc.ref.update({
            jobTitle,
            companyName,
            rawJobDescription: rawText,
            extractedMarkdown: placeholderMarkdown,
            updatedAt: Date.now(),
          });
        } else {
          const newAppRef = appsCol.doc();
          targetAppId = newAppRef.id;
          const newApplication: Partial<JobApplication> = {
            id: targetAppId,
            jobTitle,
            companyName,
            location: data.location || 'Remote / Unspecified',
            jobUrl: data.url,
            salaryRange: 'Competitive',
            targetLevel: 'Senior',
            stage: 'Targeting', // Still add it to target lane
            matchScore: 70,
            rawJobDescription: rawText,
            extractedMarkdown: placeholderMarkdown,
            notes: `Auto-ingested to Target lane on ${new Date().toLocaleString()}. Scraping was blocked by host anti-bot challenge.`,
            contacts: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          await newAppRef.set(newApplication);
        }

        // Mark the job URL as failed in job_urls collection
        await docRef.update({
          status: 'failed',
          applicationId: targetAppId,
          company: companyName,
          targetRole: jobTitle,
          error: blockReason,
          lastTraversedAt: Date.now(),
        });

        this.stats.processedCount++;
        this.stats.failureCount++;
        this.stats.lastError = blockReason;
        console.log(
          `[JobUrlWorker] ✔ Placed blocked job "${jobTitle}" @ "${companyName}" into Target lane as failed (App ID: ${targetAppId})`,
        );
        return;
      }

      // Step 4: Check scraped length
      if (!rawText || rawText.trim().length < 200) {
        const reason = `Scraped content is too short (${rawText ? rawText.trim().length : 0} chars) to be a job posting.`;
        console.warn(`[JobUrlWorker] ⛔ REJECTED: ${data.url} - ${reason}`);
        await docRef.update({
          status: 'failed',
          error: reason,
          lastTraversedAt: Date.now(),
        });
        this.stats.processedCount++;
        this.stats.failureCount++;
        this.stats.lastError = reason;
        return;
      }

      // Step 4: Check for closed, expired, or 404 signals in text
      const closedCheck = detectClosedOrExpiredContent(rawText);
      if (closedCheck.isClosed) {
        const reason = `Posting is unavailable: ${closedCheck.reason}`;
        console.warn(`[JobUrlWorker] ⛔ REJECTED: ${data.url} - ${reason}`);
        await docRef.update({
          status: 'failed',
          error: reason,
          lastTraversedAt: Date.now(),
        });
        this.stats.processedCount++;
        this.stats.failureCount++;
        this.stats.lastError = reason;
        return;
      }

      // Step 5: Extract structured parameters and verify with Gemini
      console.log(`[JobUrlWorker] Verifying & extracting role parameters with Gemini...`);
      const extracted = await this.extractWithAI(rawText, data.url, {
        company: data.company,
        targetRole: data.targetRole,
        location: data.location,
      });

      // Step 6: Verify AI classification
      if (!extracted.isJobPosting || extracted.pageType !== 'single_job_posting') {
        const reason =
          extracted.rejectionReason ||
          `Identified as ${extracted.pageType}, not a single job opening`;
        console.warn(`[JobUrlWorker] ⛔ REJECTED by AI validator: ${data.url} - ${reason}`);
        await docRef.update({
          status: 'failed',
          error: `Not a valid job posting: ${reason}`,
          lastTraversedAt: Date.now(),
        });
        this.stats.processedCount++;
        this.stats.failureCount++;
        this.stats.lastError = reason;
        return;
      }

      // Step 7: Content sufficiency check (must have title, not be a digest/alert, and have real requirements/summary)
      const isGenericOrAlertTitle =
        /job alert|search result|job digest|manage alert|recommended job/i.test(extracted.jobTitle);
      const hasSubstantiveContent =
        extracted.requirements.length > 0 ||
        extracted.responsibilities.length > 0 ||
        (extracted.jobSummary && extracted.jobSummary.length > 100);

      if (isGenericOrAlertTitle || !hasSubstantiveContent) {
        const reason = isGenericOrAlertTitle
          ? 'Extracted title indicates an alert digest or search query.'
          : 'Extracted content lacks concrete qualifications, responsibilities, or role description.';
        console.warn(`[JobUrlWorker] ⛔ REJECTED: ${data.url} - ${reason}`);
        await docRef.update({
          status: 'failed',
          error: reason,
          lastTraversedAt: Date.now(),
        });
        this.stats.processedCount++;
        this.stats.failureCount++;
        this.stats.lastError = reason;
        return;
      }

      // Step 8: Build generated Markdown
      const generatedMarkdown = [
        `## ${extracted.jobTitle} @ ${extracted.companyName}\n`,
        `**Location:** ${extracted.location}  •  **Level:** ${extracted.targetLevel}  •  **Compensation:** ${extracted.salaryRange}\n`,
        `🔗 [View Original Job Posting](${data.url})\n`,
        '---\n',
        extracted.jobSummary ? `### 📋 Role Overview\n${extracted.jobSummary}\n` : '',
        extracted.requirements?.length
          ? `### 🎯 Key Requirements & Qualifications\n${extracted.requirements
              .map((r) => `- ${r}`)
              .join('\n')}\n`
          : '',
        extracted.responsibilities?.length
          ? `### 💼 Core Responsibilities\n${extracted.responsibilities
              .map((r) => `- ${r}`)
              .join('\n')}\n`
          : '',
        extracted.techStack?.length
          ? `### 🛠️ Tech Stack & Key Skills\n${extracted.techStack
              .map((s) => `- \`${s}\``)
              .join('\n')}\n`
          : '',
      ]
        .filter(Boolean)
        .join('\n');

      // Step 9: Ingest into user's applications collection under 'Targeting' stage
      const appsCol = adminDb.collection('users').doc(userId).collection('applications');

      // Check if application for this job URL already exists to avoid duplicates
      const existingAppSnap = await appsCol.where('jobUrl', '==', data.url).limit(1).get();

      let targetAppId: string;
      if (!existingAppSnap.empty) {
        const existingDoc = existingAppSnap.docs[0];
        targetAppId = existingDoc.id;
        console.log(
          `[JobUrlWorker] Application for URL already exists (ID: ${targetAppId}). Updating...`,
        );
        await existingDoc.ref.update({
          jobTitle: extracted.jobTitle,
          companyName: extracted.companyName,
          location: extracted.location,
          salaryRange: extracted.salaryRange,
          targetLevel: extracted.targetLevel,
          rawJobDescription: rawText,
          extractedMarkdown: generatedMarkdown,
          cleanedJdJson: extracted,
          updatedAt: Date.now(),
        });
      } else {
        const newAppRef = appsCol.doc();
        targetAppId = newAppRef.id;
        const newApplication: Partial<JobApplication> = {
          id: targetAppId,
          jobTitle: extracted.jobTitle,
          companyName: extracted.companyName,
          location: extracted.location,
          jobUrl: data.url,
          salaryRange: extracted.salaryRange,
          targetLevel: extracted.targetLevel,
          stage: 'Targeting', // Add to Target lane as requested
          matchScore: 85,
          rawJobDescription: rawText,
          extractedMarkdown: generatedMarkdown,
          cleanedJdJson: extracted,
          notes: `Auto-ingested to Target lane by backend background worker on ${new Date().toLocaleString()}. Verified active job posting.`,
          contacts: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await newAppRef.set(newApplication);
      }

      // Step 10: Update Job URL entry in Firestore to completed
      await docRef.update({
        status: 'completed',
        applicationId: targetAppId,
        company: extracted.companyName,
        targetRole: extracted.jobTitle,
        location: extracted.location,
        lastTraversedAt: Date.now(),
        error: null,
      });

      this.stats.processedCount++;
      this.stats.successCount++;
      console.log(
        `[JobUrlWorker] ✔ SUCCESS: Verified & added "${extracted.jobTitle}" @ "${extracted.companyName}" into Targeting lane (App ID: ${targetAppId})`,
      );
    } catch (err: any) {
      console.error(`[JobUrlWorker] ✖ FAILED: ${data.url}:`, err.message);
      await docRef.update({
        status: 'failed',
        error: err.message || 'Failed to extract job details',
        lastTraversedAt: Date.now(),
      });
      this.stats.processedCount++;
      this.stats.failureCount++;
      this.stats.lastError = err.message;
    }
  }

  /**
   * Helper to verify that text is an active, single job posting and extract role parameters with Gemini.
   */
  private static async extractWithAI(
    jdText: string,
    url: string,
    fallback: { company?: string; targetRole?: string; location?: string },
  ): Promise<ExtractedJobDetails> {
    const prompt = `
You are a strict technical job validator and talent recruiter.
Your first and most critical duty is to VERIFY WHETHER THIS TEXT REPRESENTS A SINGLE, ACTIVE JOB POSTING.

CRITICAL RULES:
1. "isJobPosting": MUST be TRUE ONLY IF:
   - The text is a real, distinct, individual job opening.
   - It specifies an actual role and details (job duties, requirements, or scope).
   - It is currently active/open (not closed, expired, or unavailable).
2. "isJobPosting" MUST be FALSE IF:
   - The text is a list or search results of multiple jobs (e.g. "Your job alert for...", "See all jobs on LinkedIn", "Search results").
   - The job is expired, closed, or filled (e.g. "job is closed", "no longer available").
   - The text is a 404 error, home page, login screen, or generic company marketing.
   - The text is missing real job responsibilities or qualifications.
3. If "isJobPosting" is FALSE:
   - Set "pageType" appropriately ("listing_or_search", "expired_or_closed", "company_portal", "error_page", "other").
   - Provide a clear, honest explanation in "rejectionReason".
   - DO NOT invent or extrapolate fake job requirements from fallback metadata.

URL: ${url}
FALLBACK CONTEXT:
Company: ${fallback.company || 'Unknown Company'}
Role: ${fallback.targetRole || 'Technical Program Manager'}
Location: ${fallback.location || 'Remote'}

PAGE TEXT:
${jdText.slice(0, 15000)}

Return ONLY a JSON object with this exact shape:
{
  "isJobPosting": boolean,
  "pageType": "single_job_posting" | "listing_or_search" | "expired_or_closed" | "company_portal" | "error_page" | "other",
  "rejectionReason": "string (empty if isJobPosting is true)",
  "companyName": "string",
  "jobTitle": "string",
  "location": "string",
  "salaryRange": "string",
  "targetLevel": "string",
  "requirements": ["string"],
  "jobSummary": "string",
  "responsibilities": ["string"],
  "techStack": ["string"]
}
`;

    try {
      const apiKey =
        process.env.GEMINI_API_KEY ||
        process.env.GEMINI_API_KEY_1 ||
        process.env.GEMINI_API_KEY_2 ||
        '';
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: GEMINI_MODELS.FLASH,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      const isJob = parsed.isJobPosting === true && parsed.pageType === 'single_job_posting';

      return {
        isJobPosting: isJob,
        pageType: parsed.pageType || (isJob ? 'single_job_posting' : 'other'),
        rejectionReason:
          parsed.rejectionReason ||
          (isJob ? undefined : 'Page does not represent a valid single job posting.'),
        companyName: parsed.companyName || fallback.company || 'Unknown Company',
        jobTitle: parsed.jobTitle || fallback.targetRole || 'Technical Program Manager',
        location: parsed.location || fallback.location || 'Remote / Unspecified',
        salaryRange: parsed.salaryRange || 'Competitive',
        targetLevel: parsed.targetLevel || 'Senior',
        requirements: Array.isArray(parsed.requirements) ? parsed.requirements : [],
        jobSummary: parsed.jobSummary || '',
        responsibilities: Array.isArray(parsed.responsibilities) ? parsed.responsibilities : [],
        techStack: Array.isArray(parsed.techStack) ? parsed.techStack : [],
      };
    } catch (err: any) {
      console.warn('[JobUrlWorker] AI extraction notice:', err.message);
      return {
        isJobPosting: false,
        pageType: 'error_page',
        rejectionReason: `AI extraction failed: ${err.message}`,
        companyName: fallback.company || 'Unknown Company',
        jobTitle: fallback.targetRole || 'Technical Program Manager',
        location: fallback.location || 'Remote',
        salaryRange: 'Competitive',
        targetLevel: 'Senior',
        requirements: [],
        jobSummary: '',
        responsibilities: [],
        techStack: [],
      };
    }
  }
}
