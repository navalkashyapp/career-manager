import { BaseAgent } from './BaseAgent';
import { Type, Schema } from '@google/genai';
import { UserProfile } from './ResumeTailorAgent';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F' | 'N/A';
export type Recommendation = 'strong-apply' | 'apply' | 'stretch' | 'skip';

export interface DimensionScore {
  grade: Grade;
  /** CV/JD lines that justify the grade. A grade without evidence is a guess. */
  evidence: string[];
  note?: string;
}

export interface JobEvaluation {
  jobTitle: string;
  companyName: string;
  jobSummary: string;
  /** 1.0-5.0, weighted: skills 40%, growth 25%, culture 20%, comp 15%. */
  overallScore: number;
  scoreBreakdown: string;
  dimensions: {
    skillAlignment: DimensionScore;
    cultureFit: DimensionScore;
    compensation: DimensionScore;
    growthPotential: DimensionScore;
  };
  /** Hard blockers: visa, location, clearance, seniority mismatch. Checked first. */
  dealbreakers: string[];
  gaps: { gap: string; severity: 'blocking' | 'concerning' | 'minor'; fixable: string }[];
  recommendation: Recommendation;
  recommendationReasons: string[];
}

const EVALUATION_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    jobTitle: { type: Type.STRING },
    companyName: { type: Type.STRING },
    jobSummary: { type: Type.STRING },
    overallScore: { type: Type.NUMBER },
    scoreBreakdown: { type: Type.STRING },
    dimensions: {
      type: Type.OBJECT,
      properties: {
        skillAlignment: {
          type: Type.OBJECT,
          properties: {
            grade: { type: Type.STRING, enum: ['A', 'B', 'C', 'D', 'F', 'N/A'] },
            evidence: { type: Type.ARRAY, items: { type: Type.STRING } },
            note: { type: Type.STRING },
          },
          required: ['grade', 'evidence'],
        },
        cultureFit: {
          type: Type.OBJECT,
          properties: {
            grade: { type: Type.STRING, enum: ['A', 'B', 'C', 'D', 'F', 'N/A'] },
            evidence: { type: Type.ARRAY, items: { type: Type.STRING } },
            note: { type: Type.STRING },
          },
          required: ['grade', 'evidence'],
        },
        compensation: {
          type: Type.OBJECT,
          properties: {
            grade: { type: Type.STRING, enum: ['A', 'B', 'C', 'D', 'F', 'N/A'] },
            evidence: { type: Type.ARRAY, items: { type: Type.STRING } },
            note: { type: Type.STRING },
          },
          required: ['grade', 'evidence'],
        },
        growthPotential: {
          type: Type.OBJECT,
          properties: {
            grade: { type: Type.STRING, enum: ['A', 'B', 'C', 'D', 'F', 'N/A'] },
            evidence: { type: Type.ARRAY, items: { type: Type.STRING } },
            note: { type: Type.STRING },
          },
          required: ['grade', 'evidence'],
        },
      },
      required: ['skillAlignment', 'cultureFit', 'compensation', 'growthPotential'],
    },
    dealbreakers: { type: Type.ARRAY, items: { type: Type.STRING } },
    gaps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          gap: { type: Type.STRING },
          severity: { type: Type.STRING, enum: ['blocking', 'concerning', 'minor'] },
          fixable: { type: Type.STRING },
        },
        required: ['gap', 'severity', 'fixable'],
      },
    },
    recommendation: {
      type: Type.STRING,
      enum: ['strong-apply', 'apply', 'stretch', 'skip'],
    },
    recommendationReasons: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: [
    'jobTitle',
    'companyName',
    'jobSummary',
    'overallScore',
    'scoreBreakdown',
    'dimensions',
    'dealbreakers',
    'gaps',
    'recommendation',
    'recommendationReasons',
  ],
};

export class JobEvaluationAgent extends BaseAgent {
  protected getSystemPrompt(): string {
    return `
You are a hiring assessor with no incentive to flatter the candidate. Your job
is to tell them whether a role is worth their time — including telling them to
skip it.

ASSESSMENT RULES
- Dealbreakers first: work authorization, location/remote mismatch, required
  clearance, seniority band far outside the candidate's level. If any exist,
  recommendation is "skip" regardless of the score.
- Every grade needs evidence: quote or paraphrase the CV line and the JD line
  that justify it. No evidence, no grade above C.
- Compensation: grade ONLY if both the JD (salary range) and the profile
  (expectations) provide numbers. Otherwise grade N/A with a note. Never infer
  salary from a job title.
- Culture fit: judge from what the posting actually signals (values stated,
  how the role is described, team structure). Do not invent company culture.
- Growth potential: does this role move the candidate forward from where
  their CV shows them today, or sideways/down?
- overallScore weighting: skills 40%, growth 25%, culture 20%, comp 15%.
  State the math in scoreBreakdown.
- Recommendation is a decision, not a summary: strong-apply (top 10% fit),
  apply (solid fit), stretch (worth a shot, gaps named), skip (do not waste
  the application).
    `.trim();
  }

  protected getResponseSchema(): Schema {
    return EVALUATION_SCHEMA;
  }

  public async evaluateJob(
    userProfile: UserProfile,
    cvText: string,
    jobDescription: string,
  ): Promise<JobEvaluation> {
    if (!jobDescription || jobDescription.trim().length < 100) {
      throw new Error('Job description is empty or too short to evaluate.');
    }
    if (!cvText || cvText.trim().length < 200) {
      throw new Error('CV is empty or too short to evaluate against.');
    }

    const prompt = `
Evaluate this job for this candidate. Be honest; a wrong "apply" wastes their time.

CANDIDATE PROFILE: ${JSON.stringify(userProfile)}
CV: ${cvText}
JOB DESCRIPTION: ${jobDescription}

Check dealbreakers before anything else. Then grade each dimension with
evidence. Then decide: strong-apply, apply, stretch, or skip — with reasons
the candidate can act on.
    `.trim();

    return this.generateStructuredContent<JobEvaluation>(prompt);
  }
}
