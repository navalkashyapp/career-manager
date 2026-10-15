import { GoogleGenAI } from '@google/genai';
import { JobEvaluationAgent, JobEvaluation } from './JobEvaluationAgent';
import { ResumeTailorAgent, UserProfile, TailorResult } from './ResumeTailorAgent';
import { PortalExtractionAgent, JobPostingMetadata } from './PortalExtractionAgent';
import {
  InterviewCoachAgent,
  PrepPlan,
  MockRound,
  MockTurn,
  InterviewDebrief,
} from './InterviewCoachAgent';
import { OutreachAgent, OutreachChannel, OutreachDraft, RecipientContext } from './OutreachAgent';
import { GEMINI_MODELS } from '../config/gemini';
import { BaseAgentConfig } from './BaseAgent';

/* ------------------------------------------------------------------ */
/* Typed actions: every action declares its payload shape. No `any`.   */
/* ------------------------------------------------------------------ */

export type ActionName =
  | 'evaluate_job'
  | 'tailor_resume'
  | 'parse_job_page'
  | 'batch_evaluate_jobs'
  | 'interview_prep_plan'
  | 'interview_prep_mock'
  | 'interview_prep_debrief'
  | 'draft_outreach';

interface CandidatePayload {
  userProfile: UserProfile;
  masterCvMarkdown: string;
}

export interface EvaluateJobPayload extends CandidatePayload {
  jobDescription: string;
}
export interface TailorResumePayload extends CandidatePayload {
  jobDescription: string;
}
export interface ParseJobPagePayload {
  domSnippet: string;
}
export interface BatchEvaluatePayload extends CandidatePayload {
  jobDescriptions: string[];
}
export interface PrepPlanPayload extends CandidatePayload {
  jobDescription: string;
  daysAvailable: number;
}
export interface MockPayload extends CandidatePayload {
  jobDescription: string;
  history: MockTurn[];
  coveredTopics: string[];
}
export interface DebriefPayload {
  interviewTranscript: string;
  jobDescription?: string;
}
export interface OutreachPayload extends CandidatePayload {
  jobDescription: string;
  recipient: RecipientContext;
  channel: OutreachChannel;
}

export interface ActionPayloadMap {
  evaluate_job: EvaluateJobPayload;
  tailor_resume: TailorResumePayload;
  parse_job_page: ParseJobPagePayload;
  batch_evaluate_jobs: BatchEvaluatePayload;
  interview_prep_plan: PrepPlanPayload;
  interview_prep_mock: MockPayload;
  interview_prep_debrief: DebriefPayload;
  draft_outreach: OutreachPayload;
}

export interface BatchEvaluationItem {
  jobIndex: number;
  jobDescription: string;
  evaluation?: JobEvaluation;
  error?: string;
}

export interface OrchestratorConfig extends BaseAgentConfig {
  models?: {
    jobEval?: string;
    resumeTailor?: string;
    portalExtract?: string;
    interviewCoach?: string;
    outreach?: string;
  };
  agentFallbackModels?: {
    jobEval?: string | string[];
    resumeTailor?: string | string[];
    portalExtract?: string | string[];
    interviewCoach?: string | string[];
    outreach?: string | string[];
  };
  /** Max parallel evaluations in a batch. Defaults to 4. */
  batchConcurrency?: number;
}

const DEFAULT_BATCH_CONCURRENCY = 4;

export class OrchestratorAgent {
  private jobEval: JobEvaluationAgent;
  private resumeTailor: ResumeTailorAgent;
  private portalExtract: PortalExtractionAgent;
  private interviewCoach: InterviewCoachAgent;
  private outreach: OutreachAgent;
  private batchConcurrency: number;

  constructor(aiClient: GoogleGenAI, config: OrchestratorConfig = {}) {
    const models = config.models ?? {};
    const agentFallbackModels = config.agentFallbackModels ?? {};
    const baseFallback = config.fallbackModels;
    const agentConfig = { debug: config.debug ?? false, useLocalCli: config.useLocalCli };
    this.batchConcurrency = config.batchConcurrency ?? DEFAULT_BATCH_CONCURRENCY;

    this.jobEval = new JobEvaluationAgent(aiClient, models.jobEval ?? GEMINI_MODELS.FLASH, {
      ...agentConfig,
      fallbackModels: agentFallbackModels.jobEval ?? baseFallback,
    });
    // Tailoring needs deeper reasoning — keep PRO as the default.
    this.resumeTailor = new ResumeTailorAgent(aiClient, models.resumeTailor ?? GEMINI_MODELS.PRO, {
      ...agentConfig,
      fallbackModels: agentFallbackModels.resumeTailor ?? baseFallback,
    });
    this.portalExtract = new PortalExtractionAgent(
      aiClient,
      models.portalExtract ?? GEMINI_MODELS.FLASH,
      { ...agentConfig, fallbackModels: agentFallbackModels.portalExtract ?? baseFallback },
    );
    this.interviewCoach = new InterviewCoachAgent(
      aiClient,
      models.interviewCoach ?? GEMINI_MODELS.FLASH,
      { ...agentConfig, fallbackModels: agentFallbackModels.interviewCoach ?? baseFallback },
    );
    this.outreach = new OutreachAgent(aiClient, models.outreach ?? GEMINI_MODELS.FLASH, {
      ...agentConfig,
      fallbackModels: agentFallbackModels.outreach ?? baseFallback,
    });
  }

  public async handleAction<A extends ActionName>(
    action: A,
    payload: ActionPayloadMap[A],
  ): Promise<unknown>;
  public async handleAction(action: string, payload: any): Promise<unknown>;
  public async handleAction(action: any, payload: any): Promise<unknown> {
    switch (action) {
      case 'evaluate_job': {
        const p = payload as EvaluateJobPayload;
        return this.jobEval.evaluateJob(
          this.require(p.userProfile, 'userProfile'),
          this.require(p.masterCvMarkdown, 'masterCvMarkdown'),
          this.require(p.jobDescription, 'jobDescription'),
        );
      }

      case 'tailor_resume': {
        const p = payload as TailorResumePayload;
        return this.resumeTailor.tailor(
          this.require(p.userProfile, 'userProfile'),
          this.require(p.masterCvMarkdown, 'masterCvMarkdown'),
          this.require(p.jobDescription, 'jobDescription'),
        );
      }

      case 'parse_job_page': {
        const p = payload as ParseJobPagePayload;
        return this.portalExtract.extractMetadata(
          this.require(p.domSnippet || (p as any).jobDescription, 'domSnippet'),
        );
      }

      case 'batch_evaluate_jobs': {
        const p = payload as BatchEvaluatePayload;
        const descriptions = this.require(p.jobDescriptions, 'jobDescriptions');
        if (!Array.isArray(descriptions) || descriptions.length === 0) {
          throw new Error('jobDescriptions must be a non-empty array for batch evaluation.');
        }
        return this.batchEvaluate(p.userProfile, p.masterCvMarkdown, descriptions);
      }

      case 'interview_prep_plan': {
        const p = payload as PrepPlanPayload;
        return this.interviewCoach.generatePrepPlan(
          this.require(p.userProfile, 'userProfile'),
          this.require(p.masterCvMarkdown, 'masterCvMarkdown'),
          this.require(p.jobDescription, 'jobDescription'),
          p.daysAvailable ?? (p as any).days ?? 7,
        );
      }

      case 'interview_prep_mock': {
        const p = payload as MockPayload;
        return this.interviewCoach.generateMockQuestion({
          jobDescription: this.require(p.jobDescription, 'jobDescription'),
          cvText: this.require(p.masterCvMarkdown, 'masterCvMarkdown'),
          history: p.history ?? (p as any).chatHistory ?? [],
          coveredTopics: p.coveredTopics ?? [],
        });
      }

      case 'interview_prep_debrief': {
        const p = payload as DebriefPayload;
        // A debrief without a transcript is meaningless — the old fallback to
        // jobDescription silently produced a fake debrief. Fail loudly instead.
        const transcript = p.interviewTranscript || (p as any).jobDescription;
        return this.interviewCoach.generateDebrief(
          this.require(transcript, 'interviewTranscript'),
          p.jobDescription,
        );
      }

      case 'draft_outreach': {
        const p = payload as OutreachPayload;
        const recipient = p.recipient ?? {
          name: (p as any).persona || 'Hiring Manager',
          role: 'Hiring Manager',
          company: (p as any).companyName || 'Target Company',
        };
        const channel = (p.channel as OutreachChannel) || 'cold-email';
        return this.outreach.generateOutreach({
          userProfile: this.require(p.userProfile, 'userProfile'),
          cvText: this.require(p.masterCvMarkdown, 'masterCvMarkdown'),
          jobDescription: this.require(p.jobDescription, 'jobDescription'),
          recipient,
          channel,
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /* ------------------------- batch evaluation --------------------- */
  private async batchEvaluate(
    userProfile: UserProfile,
    masterCvMarkdown: string,
    jobDescriptions: string[],
  ): Promise<{ batchEvaluations: BatchEvaluationItem[] }> {
    const results: BatchEvaluationItem[] = [];

    // Chunked concurrency: one failure must not kill the batch, and the
    // provider must not get hammered with unbounded parallel calls.
    for (let i = 0; i < jobDescriptions.length; i += this.batchConcurrency) {
      const chunk = jobDescriptions.slice(i, i + this.batchConcurrency);
      const settled = await Promise.allSettled(
        chunk.map((jd, offset) =>
          this.jobEval
            .evaluateJob(userProfile, masterCvMarkdown, jd)
            .then((evaluation) => ({ jobIndex: i + offset, jobDescription: jd, evaluation })),
        ),
      );
      for (let k = 0; k < settled.length; k++) {
        const s = settled[k];
        if (s.status === 'fulfilled') {
          results.push(s.value);
        } else {
          results.push({
            jobIndex: i + k,
            jobDescription: chunk[k],
            error: s.reason instanceof Error ? s.reason.message : String(s.reason),
          });
        }
      }
    }

    // Successful evaluations sort by score, highest first; failures sink.
    results.sort((a, b) => (b.evaluation?.overallScore ?? -1) - (a.evaluation?.overallScore ?? -1));
    return { batchEvaluations: results };
  }

  private require<T>(value: T | undefined | null | '', name: string): T {
    if (value === undefined || value === null || value === '') {
      throw new Error(`Missing required payload field: "${name}".`);
    }
    return value as T;
  }
}

/* Re-export the result types so callers don't hunt through agent files. */
export type {
  JobEvaluation,
  TailorResult,
  JobPostingMetadata,
  PrepPlan,
  MockRound,
  InterviewDebrief,
  OutreachDraft,
};
