import { BaseAgent } from './BaseAgent';
import { Type, Schema } from '@google/genai';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type PageType = 'single-posting' | 'listing-page' | 'unknown';
export type Confidence = 'high' | 'medium' | 'low';

export interface SalaryRange {
  raw: string;
  min?: number;
  max?: number;
  currency?: string;
  period?: 'year' | 'month' | 'hour' | 'unknown';
}

export interface JobPostingMetadata {
  pageType: PageType;
  /** Populated when a listing page (not a single posting) is detected. */
  detectedPostings?: { title: string; url?: string }[];
  companyName: string;
  companyDescription?: string;
  roleTitle: string;
  roleDescription?: string;
  location: string;
  remotePolicy: 'remote' | 'hybrid' | 'on-site' | 'unknown';
  employmentType: string;
  department: string;
  experienceLevel: string;
  salary: SalaryRange;
  postedDate: string;
  applicationDeadline?: string;
  applicationUrl?: string;
  requirements: string[];
  niceToHaves: string[];
  qualifications?: string[];
  responsibilities?: string[];
  benefits: string[];
  visaSponsorshipMentioned: boolean;
  /** Per-field confidence so callers know what to trust. */
  fieldConfidence: Record<string, Confidence>;
  warnings: string[];
}

const METADATA_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    pageType: { type: Type.STRING, enum: ['single-posting', 'listing-page', 'unknown'] },
    detectedPostings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          url: { type: Type.STRING },
        },
        required: ['title'],
      },
    },
    companyName: { type: Type.STRING },
    companyDescription: { type: Type.STRING },
    roleTitle: { type: Type.STRING },
    roleDescription: { type: Type.STRING },
    location: { type: Type.STRING },
    remotePolicy: { type: Type.STRING, enum: ['remote', 'hybrid', 'on-site', 'unknown'] },
    employmentType: { type: Type.STRING },
    department: { type: Type.STRING },
    experienceLevel: { type: Type.STRING },
    salary: {
      type: Type.OBJECT,
      properties: {
        raw: { type: Type.STRING },
        min: { type: Type.NUMBER },
        max: { type: Type.NUMBER },
        currency: { type: Type.STRING },
        period: { type: Type.STRING, enum: ['year', 'month', 'hour', 'unknown'] },
      },
      required: ['raw'],
    },
    qualifications: { type: Type.ARRAY, items: { type: Type.STRING } },
    responsibilities: { type: Type.ARRAY, items: { type: Type.STRING } },
    postedDate: { type: Type.STRING },
    applicationDeadline: { type: Type.STRING },
    applicationUrl: { type: Type.STRING },
    requirements: { type: Type.ARRAY, items: { type: Type.STRING } },
    niceToHaves: { type: Type.ARRAY, items: { type: Type.STRING } },
    benefits: { type: Type.ARRAY, items: { type: Type.STRING } },
    visaSponsorshipMentioned: { type: Type.BOOLEAN },
    fieldConfidence: {
      type: Type.OBJECT,
      properties: {
        companyName: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
        roleTitle: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
        location: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
        salary: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
        requirements: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
      },
    },
    warnings: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: [
    'pageType',
    'companyName',
    'companyDescription',
    'roleTitle',
    'roleDescription',
    'location',
    'remotePolicy',
    'employmentType',
    'salary',
    'requirements',
    'niceToHaves',
    'qualifications',
    'fieldConfidence',
    'warnings',
  ],
};

/** DOM dumps can run to hundreds of KB. Keep the head where postings live. */
const MAX_SNIPPET_CHARS = 60000;

export class PortalExtractionAgent extends BaseAgent {
  protected getSystemPrompt(): string {
    return `
You extract structured job metadata from scraped pages and DOM snippets
(Greenhouse, LInkedin, Lever, Ashby, Workday, and generic career pages).

EXTRACTION RULES
- Extract ONLY what is on the page. Empty string when a field is absent —
  never infer the company from the URL, the salary from the title, or the
  location from a footer.
- First decide pageType. If the page lists multiple roles, set pageType to
  "listing-page", list what you can in detectedPostings, and leave the
  single-posting fields empty with a warning. Do not blend several postings
  into one.
- requirements vs niceToHaves: split on the page's own language ("must have",
  "required" vs "nice to have", "bonus", "preferred"). When the page does not
  distinguish, put everything in requirements and say so in warnings.
- salary: keep the raw text always; parse min/max/currency/period only when
  unambiguous. Do not convert currencies or annualize hourly rates.
- remotePolicy: "remote" only if the page says remote. "Hybrid"/"on-site"
  likewise. Otherwise "unknown" — do not guess from the city.
- fieldConfidence: "low" for anything parsed from messy markup or truncated
  input; say why in warnings.
    `.trim();
  }

  protected getResponseSchema(): Schema {
    return METADATA_SCHEMA;
  }

  public async extractMetadata(domSnippet: string): Promise<JobPostingMetadata> {
    if (!domSnippet || domSnippet.trim().length < 50) {
      throw new Error('DOM snippet is empty or too short to extract from.');
    }

    const snippet = this.truncate(domSnippet, MAX_SNIPPET_CHARS, 'DOM snippet');

    const prompt = `
Extract job posting metadata from this scraped page content.

PAGE CONTENT:
${snippet}

Follow the extraction rules exactly. When in doubt, leave the field empty
and lower its confidence — a missing field is honest, a guessed one is a lie.
    `.trim();

    return this.generateStructuredContent<JobPostingMetadata>(prompt);
  }
}
