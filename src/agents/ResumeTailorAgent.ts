import { BaseAgent } from './BaseAgent';
import { Type, Schema } from '@google/genai';

/* ------------------------------------------------------------------ */
/* Types: no `any` anywhere. Typed schemas catch missing fields before */
/* the model gets a chance to invent them.                            */
/* ------------------------------------------------------------------ */

export interface UserProfile {
  fullName: string;
  headline?: string;
  /** A paragraph the user actually wrote (old bullets, LinkedIn, cover note).
   *  The agent matches this voice instead of defaulting to "professional tone". */
  voiceSample?: string;
  location?: string;
  email?: string;
  phone?: string;
}

export interface RequirementEvidence {
  /** JD keyword or requirement */
  keyword: string;
  /** How it maps to the user's real history. Omit entirely when there is no evidence. */
  evidence?: string;
  /** Seniority the JD implies for this requirement, if stated */
  seniority?: string;
}

export interface JobAnalysis {
  roleTitle: string;
  company: string;
  seniorityLevel:
    'intern' | 'junior' | 'mid' | 'senior' | 'lead' | 'principal' | 'exec' | 'unknown';
  hardRequirements: RequirementEvidence[];
  niceToHaves: string[];
  /** 2-3 strongest relevance arguments: why THIS person fits THIS role */
  positioningAngles: string[];
  /** How the company writes: formal, startup-casual, mission-driven, etc. */
  companyVoice: string;
  redFlags: string[];
}

export interface BulletChange {
  section: string;
  role: string;
  before: string;
  after: string;
  reason: string;
}

export interface TailorResult {
  summary: string;
  tailoredCvMarkdown: string;
  keySkills: string[];
  keywordMatch: { matched: string[]; missing: string[] };
  gaps: string[];
  bulletChanges: BulletChange[];
  /** Facts the agent needs from the user instead of guessing. Never invent these. */
  questionsForUser: string[];
  confidence: 'high' | 'medium' | 'low';
  confidenceNote: string;
}

const ANALYSIS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    roleTitle: { type: Type.STRING },
    company: { type: Type.STRING },
    seniorityLevel: {
      type: Type.STRING,
      enum: ['intern', 'junior', 'mid', 'senior', 'lead', 'principal', 'exec', 'unknown'],
    },
    hardRequirements: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          keyword: { type: Type.STRING },
          evidence: { type: Type.STRING },
          seniority: { type: Type.STRING },
        },
        required: ['keyword'],
      },
    },
    niceToHaves: { type: Type.ARRAY, items: { type: Type.STRING } },
    positioningAngles: { type: Type.ARRAY, items: { type: Type.STRING } },
    companyVoice: { type: Type.STRING },
    redFlags: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: [
    'roleTitle',
    'company',
    'seniorityLevel',
    'hardRequirements',
    'niceToHaves',
    'positioningAngles',
    'companyVoice',
  ],
};

const RESULT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    tailoredCvMarkdown: { type: Type.STRING },
    keySkills: { type: Type.ARRAY, items: { type: Type.STRING } },
    tailoredExperiences: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          company: { type: Type.STRING },
          companyDates: { type: Type.STRING },
          role: { type: Type.STRING },
          roleDates: { type: Type.STRING },
          tailoredBullets: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['company', 'role', 'tailoredBullets', 'companyDates'],
      },
    },
    coverLetterDraft: { type: Type.STRING },
    educationAndQualifications: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          degree: { type: Type.STRING },
          school: { type: Type.STRING },
          dates: { type: Type.STRING },
        },
        required: ['degree', 'school'],
      },
    },
    keywordMatch: {
      type: Type.OBJECT,
      properties: {
        matched: { type: Type.ARRAY, items: { type: Type.STRING } },
        missing: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['matched', 'missing'],
    },
    gaps: { type: Type.ARRAY, items: { type: Type.STRING } },
    bulletChanges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          section: { type: Type.STRING },
          role: { type: Type.STRING },
          before: { type: Type.STRING },
          after: { type: Type.STRING },
          reason: { type: Type.STRING },
        },
        required: ['section', 'role', 'before', 'after', 'reason'],
      },
    },
    questionsForUser: { type: Type.ARRAY, items: { type: Type.STRING } },
    confidence: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
    confidenceNote: { type: Type.STRING },
  },
  required: [
    'summary',
    'tailoredCvMarkdown',
    'keySkills',
    'tailoredExperiences',
    'coverLetterDraft',
    'educationAndQualifications',
    'keywordMatch',
    'gaps',
    'bulletChanges',
    'questionsForUser',
    'confidence',
    'confidenceNote',
  ],
};

/* ------------------------------------------------------------------ */
/* The banned list. Every one of these is a tell. The model must say   */
/* the thing, not dress it up.                                        */
/* ------------------------------------------------------------------ */

const BANNED_PHRASES = [
  'leverage',
  'utilize',
  'synergy',
  'robust',
  'cutting-edge',
  'results-driven',
  'passionate',
  'detail-oriented',
  'proven track record',
  'dynamic',
  'spearheaded',
  'thought leader',
  'guru',
  'ninja',
  'rockstar',
  'fast-paced environment',
  'self-starter',
  'team player',
];

export class ResumeTailorAgent extends BaseAgent {
  /* ---------------------------------------------------------------- */
  /* System prompt: a person who writes resumes for a living, not a    */
  /* "centralized backend orchestration engine".                       */
  /* ---------------------------------------------------------------- */
  protected getResponseSchema(): any {
    return {};
  }

  protected getSystemPrompt(): string {
    return `
You are a resume writer with fifteen years of experience placing candidates at
top companies. You write the way strong candidates actually write: plain words,
short sentences, specific numbers, no filler.

ANTI-SLOP WRITING v4.1 GUIDELINES
- Write for the reader and the requested purpose. Avoid generic padding, canned openings and conclusions, empty praise, fake specificity, and chat scaffolding.
- Treat vocabulary lists as review prompts, not bans. Keep accurate technical terms, necessary hedges, requested wording, and structures that fit the format.
- Check who performs each action. Name an agent when it matters; retain a useful passive when the agent is unknown or less important.
- Check that an introductory or trailing modifier attaches to the intended person or thing.
- Check what a comma plus "-ing" phrase actually asserts: simultaneous action, result, or cause. Keep it only when that relationship is supported; split or recast it when unclear.
- Give pronouns clear referents. Preserve who or what each pronoun covers.
- Preserve negation, quantifiers, and modality. "Some," "most," "may," "must," "not," and "not all" are not interchangeable.
- Make coordinated list items grammatically parallel when they carry equal weight.
- Remove unrequested chat or reasoning scaffolding from the deliverable.
- Keep the tone requested. Remove unsolicited hype, reassurance, excessive praise, or snark when it does not fit.
- Keep facts, numbers, citations, and uncertainty grounded in supplied sources. Never invent personal experience or details to make writing seem human.
- Review repetition, stock contrasts, padding, repetitive cadence, and generic wrap-ups. Revise only where they weaken clarity or voice.
- Vary sentence and paragraph rhythm naturally. Do not add errors, fragments, or awkwardness to imitate a person.

VOICE
- Write like a competent human, not a press release. Concrete nouns, active
  verbs, zero adjectives standing in for evidence.
- Every bullet that can carry a number must carry one: scope, scale, or
  outcome. A bullet with no number needs a reason to exist.
- Fragments are fine. "Led migration of 40 services to Kubernetes; cut deploy
  time from 45 minutes to 6." beats a full sentence that says less.
- Match the diction and sentence length of the user's voice sample when one
  is provided. Never default to generic "professional tone".
- BANNED words and phrases — do not use them, do not rephrase around them,
  just say the thing plainly: ${BANNED_PHRASES.join(', ')}.
- Never write "Responsible for". Say what the person did.

FACT INTEGRITY (mechanical, not aspirational)
- Every bullet must trace to something in the master CV. If you cannot point
  at the source line, do not write the bullet.
- Never invent experience, certifications, metrics, employers, or dates.
- If a JD keyword has no evidence in the CV, it goes in "missing"/"gaps" —
  never woven quietly into a bullet.
- If a number is plausible but unstated, put the question in "questionsForUser"
  and write the bullet without the number. Do not guess.

STRUCTURE
- Lead with a 2-3 line summary built from the positioning angles: who this
  person is, for this role, and the single strongest proof.
- Reorder bullets so the most relevant work for THIS job comes first within
  each role. Cut bullets that add nothing for this application.
- Standard section headers only (Summary, Experience, Skills, Education).
  Single column. No tables, no graphics, no columns — parsers choke on them.

WHAT NOT TO DO
- No keyword stuffing. A keyword appears once, in context, where it is true.
- Do not change employment dates, job titles, or company names.
- Do not add a Skills section entry the user has not demonstrably used.
- Keep the resume to what the role needs. Shorter and truer beats longer.
    `.trim();
  }

  /* ------------------------- input validation --------------------- */
  private validateInputs(cvText: string, jobDescription: string): void {
    if (!cvText || cvText.trim().length < 200) {
      throw new Error('Master CV is empty or too short to work with. Provide the full CV text.');
    }
    if (!jobDescription || jobDescription.trim().length < 100) {
      throw new Error('Job description is empty or too short. Paste the full posting.');
    }
  }

  /* --------------------- pass 1: analyze the JD ------------------- */
  public async analyzeJob(jobDescription: string): Promise<JobAnalysis> {
    const prompt = `
Analyze this job posting and extract what matters for tailoring a resume.
Return ONLY what the posting actually says — do not infer requirements
that are not stated.

Job Description:
${jobDescription}

Rules:
- hardRequirements: skills/experience the posting marks as required.
  Leave "evidence" empty here; it gets filled in pass 2 against the CV.
- niceToHaves: explicitly optional or "bonus" items.
- positioningAngles: the 2-3 arguments a strong candidate would lead with
  for this specific role. Be opinionated.
- companyVoice: how the posting is written (formal, startup-casual,
  mission-driven, bureaucratic). One phrase.
- redFlags: anything odd — unrealistic scope, vague role, salary far below
  market signals. Empty array if none.
    `.trim();

    return this.generateStructuredContent<JobAnalysis>(prompt, { schema: ANALYSIS_SCHEMA });
  }

  /* --------------------- pass 2: tailor the resume ---------------- */
  public async tailorResume(
    userProfile: UserProfile,
    cvText: string,
    jobDescription: string,
    analysis?: JobAnalysis,
  ): Promise<TailorResult> {
    this.validateInputs(cvText, jobDescription);

    // Reuse a prior analysis when provided so the two passes stay consistent.
    const jobAnalysis = analysis ?? (await this.analyzeJob(jobDescription));

    const prompt = `
Tailor the master CV for the job below, following the system rules exactly.

JOB ANALYSIS (from pass 1 — treat as the brief):
${JSON.stringify(jobAnalysis, null, 2)}

USER PROFILE:
${JSON.stringify(userProfile, null, 2)}
${userProfile.voiceSample ? `\nMatch this voice:\n${userProfile.voiceSample}` : ''}

MASTER CV (the only source of truth for facts):
${cvText}

JOB DESCRIPTION:
${jobDescription}

Write the tailored resume now. Requirements:
1. Summary: 2-3 lines from the positioning angles. Name the role, the
   strongest proof, nothing else.
2. bulletChanges: Every bullet rewritten or kept must earn its place for THIS job.
   Show each changed bullet as a before/after pair with a one-line reason.
3. keySkills: a list of 5-8 top Key Skills and Expertise that should be added into the resume to improve chances for selection for this role.
4. tailoredExperiences: structured array of work experiences, each with company, role, dates, and an array of tailored bullets. YOU MUST POPULATE 'tailoredBullets' with the final, polished strings (do not leave this empty).
5. coverLetterDraft: A personalized cover letter draft addressing the hiring team for this company/role.
6. educationAndQualifications: Degree, school, and dates from the CV.
7. keywordMatch.matched: JD keywords with real evidence in the CV.
   keywordMatch.missing: JD keywords with none — be honest.
8. gaps: skills/experience the role wants that the CV cannot support.
9. questionsForUser: specific facts you need (metrics, dates, tools) that
   you refused to invent. Max 5, most valuable first.
10. confidence: high only if every hard requirement maps to evidence.
    `.trim();

    return this.generateStructuredContent<TailorResult>(prompt, { schema: RESULT_SCHEMA });
  }

  /* ----------------- convenience: full pipeline in one call ------- */
  public async tailor(
    userProfile: UserProfile,
    cvText: string,
    jobDescription: string,
  ): Promise<{ analysis: JobAnalysis; result: TailorResult }> {
    this.validateInputs(cvText, jobDescription);
    const analysis = await this.analyzeJob(jobDescription);
    const result = await this.tailorResume(userProfile, cvText, jobDescription, analysis);
    return { analysis, result };
  }
}
