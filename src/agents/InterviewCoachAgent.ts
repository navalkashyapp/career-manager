import { BaseAgent } from './BaseAgent';
import { Type, Schema } from '@google/genai';
import { UserProfile } from './ResumeTailorAgent';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type Priority = 'critical' | 'important' | 'nice-to-have';
export type QuestionCategory =
  'behavioral' | 'technical' | 'system-design' | 'role-specific' | 'culture';

export interface PrepBlock {
  day: number;
  focusTopic: string;
  /** Why this topic matters for THIS job — one line, tied to the JD. */
  whyItMatters: string;
  priority: Priority;
  estimatedMinutes: number;
  /** Concrete things to do, not "study X". */
  drills: string[];
  /** Web search queries the user can run. Never URLs — the model invents those. */
  resourceQueries: string[];
}

export interface PrepPlan {
  totalDays: number;
  roleTitle: string;
  blocks: PrepBlock[];
  /** The 3 things to do if they only have one evening. */
  ifShortOnTime: string[];
}

export interface MockTurn {
  role: 'interviewer' | 'candidate';
  text: string;
  score?: number;
}

export interface AnswerFeedback {
  strengths: string[];
  improvements: string[];
  /** 1-10, anchored: 9-10 hire signal, 7-8 solid, 5-6 mixed, below 5 concern. */
  score: number;
  scoreRationale: string;
}

export interface MockQuestion {
  question: string;
  category: QuestionCategory;
  /** 1-5. Ramps up as the session progresses. */
  difficulty: number;
  /** What a strong answer contains — the rubric the score is judged against. */
  whatGoodLooksLike: string[];
  /** A nudge to give if the candidate stalls, not the answer. */
  followUpIfStuck?: string;
}

export interface MockRound {
  feedbackOnPrevious: AnswerFeedback | null;
  nextQuestion: MockQuestion;
  coveredTopics: string[];
}

export interface DebriefFinding {
  severity: 'critical' | 'major' | 'minor';
  /** Their words, quoted. */
  moment: string;
  issue: string;
  fix: string;
}

export interface InterviewDebrief {
  overallReadiness: number;
  readinessNote: string;
  findings: DebriefFinding[];
  missedOpportunities: string[];
  profileUpdates: { area: string; suggestion: string; reason: string }[];
}

/* ------------------------------------------------------------------ */
/* Schemas                                                             */
/* ------------------------------------------------------------------ */

const PREP_PLAN_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    totalDays: { type: Type.NUMBER },
    roleTitle: { type: Type.STRING },
    blocks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          day: { type: Type.NUMBER },
          focusTopic: { type: Type.STRING },
          whyItMatters: { type: Type.STRING },
          priority: { type: Type.STRING, enum: ['critical', 'important', 'nice-to-have'] },
          estimatedMinutes: { type: Type.NUMBER },
          drills: { type: Type.ARRAY, items: { type: Type.STRING } },
          resourceQueries: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          'day',
          'focusTopic',
          'whyItMatters',
          'priority',
          'estimatedMinutes',
          'drills',
          'resourceQueries',
        ],
      },
    },
    ifShortOnTime: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['totalDays', 'roleTitle', 'blocks', 'ifShortOnTime'],
};

const MOCK_ROUND_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    feedbackOnPrevious: {
      type: Type.OBJECT,
      properties: {
        strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
        improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
        score: { type: Type.NUMBER },
        scoreRationale: { type: Type.STRING },
      },
      required: ['strengths', 'improvements', 'score', 'scoreRationale'],
    },
    nextQuestion: {
      type: Type.OBJECT,
      properties: {
        question: { type: Type.STRING },
        category: {
          type: Type.STRING,
          enum: ['behavioral', 'technical', 'system-design', 'role-specific', 'culture'],
        },
        difficulty: { type: Type.NUMBER },
        whatGoodLooksLike: { type: Type.ARRAY, items: { type: Type.STRING } },
        followUpIfStuck: { type: Type.STRING },
      },
      required: ['question', 'category', 'difficulty', 'whatGoodLooksLike'],
    },
    coveredTopics: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['nextQuestion', 'coveredTopics'],
};

const DEBRIEF_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    overallReadiness: { type: Type.NUMBER },
    readinessNote: { type: Type.STRING },
    findings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          severity: { type: Type.STRING, enum: ['critical', 'major', 'minor'] },
          moment: { type: Type.STRING },
          issue: { type: Type.STRING },
          fix: { type: Type.STRING },
        },
        required: ['severity', 'moment', 'issue', 'fix'],
      },
    },
    missedOpportunities: { type: Type.ARRAY, items: { type: Type.STRING } },
    profileUpdates: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          area: { type: Type.STRING },
          suggestion: { type: Type.STRING },
          reason: { type: Type.STRING },
        },
        required: ['area', 'suggestion', 'reason'],
      },
    },
  },
  required: [
    'overallReadiness',
    'readinessNote',
    'findings',
    'missedOpportunities',
    'profileUpdates',
  ],
};

export class InterviewCoachAgent extends BaseAgent {
  protected getSystemPrompt(): string {
    return `
You are an interview coach who has run hundreds of hiring loops at top companies.
You are direct, specific, and allergic to generic advice.

COACHING RULES
- Every drill, question, and piece of feedback ties to a specific requirement
  in the job description or a specific line in the candidate's CV. If you cannot
  name the tie, do not include the item.
- Behavioral answers are judged on STAR structure: Situation, Task, Action,
  Result with numbers. Say which letter is missing when one is.
- Technical answers are judged on correctness first, then on tradeoff awareness.
  A correct answer with no tradeoff discussion caps at 7/10.
- Never soften feedback to be nice. "Good answer, maybe add more detail" is
  useless. Name the exact sentence that failed and what should replace it.
- BANNED coaching fluff: "practice makes perfect", "be yourself", "just be
  confident", "do your research". Give the action, not the platitude.

SCORING ANCHORS (1-10)
- 9-10: hire signal. Would advocate for this candidate in debrief.
- 7-8: solid. Meets bar, nothing memorable.
- 5-6: mixed. Would need a strong read elsewhere to proceed.
- Below 5: concern. Would argue against hiring on this answer alone.
    `.trim();
  }

  protected getResponseSchema(): Schema {
    return PREP_PLAN_SCHEMA;
  }

  /* ------------------------- prep plan ---------------------------- */
  public async generatePrepPlan(
    userProfile: UserProfile,
    cvText: string,
    jobDescription: string,
    daysAvailable: number,
  ): Promise<PrepPlan> {
    if (!Number.isFinite(daysAvailable) || daysAvailable < 1) {
      throw new Error('daysAvailable must be a positive number.');
    }
    const prompt = `
Build a ${daysAvailable}-day interview prep plan for this candidate and role.

CANDIDATE: ${JSON.stringify(userProfile)}
CV: ${cvText}
JOB DESCRIPTION: ${jobDescription}

Rules:
- Day 1+ blocks target the DELTA between the CV and the JD: the requirements
  with the weakest evidence get the earliest, highest-priority blocks.
- Each block needs drills the candidate can actually do in the estimated
  minutes — e.g. "write out 2 STAR stories for conflict situations, 20 min
  each" not "practice behavioral questions".
- resourceQueries are web search phrases, never URLs.
- ifShortOnTime: the 3 blocks to keep if they only have one evening.
    `.trim();

    return this.generateStructuredContent<PrepPlan>(prompt, { schema: PREP_PLAN_SCHEMA });
  }

  /* ------------------------- mock interview ----------------------- */
  public async generateMockQuestion(opts: {
    jobDescription: string;
    cvText: string;
    history: MockTurn[];
    coveredTopics: string[];
  }): Promise<MockRound> {
    const { jobDescription, cvText, history, coveredTopics } = opts;

    const historyText =
      history.length === 0
        ? '(no answers yet — this is the first question)'
        : history
            .map(
              (t) =>
                `${t.role.toUpperCase()}: ${t.text}${t.score != null ? ` [score: ${t.score}]` : ''}`,
            )
            .join('\n');

    const prompt = `
You are the hiring manager for this role. Continue the mock interview.

JOB DESCRIPTION: ${jobDescription}
CANDIDATE CV: ${cvText}

CONVERSATION SO FAR:
${historyText}

TOPICS ALREADY COVERED (do not repeat): ${coveredTopics.join(', ') || '(none)'}

Rules:
- If there is a previous candidate answer, score it against the rubric in
  whatGoodLooksLike from when the question was asked. Quote the sentence that
  most helped and the one that most hurt.
- The next question must probe something NOT yet covered, chosen from the
  JD's hardest requirements or the CV's thinnest claims.
- Difficulty ramps: start at 2, move up when they score 7+, down when below 5.
- whatGoodLooksLike is the rubric — 3-4 concrete elements of a strong answer.
    `.trim();

    return this.generateStructuredContent<MockRound>(prompt, { schema: MOCK_ROUND_SCHEMA });
  }

  /* --------------------------- debrief ---------------------------- */
  public async generateDebrief(
    interviewTranscript: string,
    jobDescription?: string,
  ): Promise<InterviewDebrief> {
    if (!interviewTranscript || interviewTranscript.trim().length < 50) {
      throw new Error('Interview transcript is empty or too short to debrief.');
    }
    const prompt = `
Debrief this real interview transcript like a hiring manager writing loop notes.

TRANSCRIPT:
${interviewTranscript}
${jobDescription ? `\nJOB DESCRIPTION (for context):\n${jobDescription}` : ''}

Rules:
- findings: quote the candidate's actual words in "moment". Severity critical
  = would single-handedly fail the loop.
- missedOpportunities: moments where a stronger answer was available — name
  what they should have said.
- profileUpdates: concrete additions/corrections for the candidate's profile
  or CV revealed by the interview (e.g. "CV claims Kubernetes expertise but
  candidate could not describe a deployment strategy — downgrade or prepare").
- overallReadiness 1-10 with a one-line hiring-manager-style verdict.
    `.trim();

    return this.generateStructuredContent<InterviewDebrief>(prompt, { schema: DEBRIEF_SCHEMA });
  }
}
