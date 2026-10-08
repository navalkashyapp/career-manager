import { describe, it, expect, vi } from 'vitest';
import {
  BaseAgent,
  ResumeTailorAgent,
  JobEvaluationAgent,
  PortalExtractionAgent,
  InterviewCoachAgent,
  OutreachAgent,
  OrchestratorAgent,
} from '../../agents';

describe('New V2 Agents Integration', () => {
  const dummyAi = {} as any;

  it('instantiates all agents successfully', () => {
    const resumeTailor = new ResumeTailorAgent(dummyAi);
    const jobEval = new JobEvaluationAgent(dummyAi);
    const portalExtract = new PortalExtractionAgent(dummyAi);
    const interviewCoach = new InterviewCoachAgent(dummyAi);
    const outreach = new OutreachAgent(dummyAi);
    const orchestrator = new OrchestratorAgent(dummyAi);

    expect(resumeTailor).toBeInstanceOf(BaseAgent);
    expect(jobEval).toBeInstanceOf(BaseAgent);
    expect(portalExtract).toBeInstanceOf(BaseAgent);
    expect(interviewCoach).toBeInstanceOf(BaseAgent);
    expect(outreach).toBeInstanceOf(BaseAgent);
    expect(orchestrator).toBeDefined();
  });

  it('orchestrator routes evaluate_job action', async () => {
    const orchestrator = new OrchestratorAgent(dummyAi);
    const spy = vi.spyOn((orchestrator as any).jobEval, 'evaluateJob').mockResolvedValue({
      jobTitle: 'Software Engineer',
      companyName: 'Acme',
      overallScore: 4.8,
    });

    const result = await orchestrator.handleAction('evaluate_job', {
      userProfile: { fullName: 'John Doe' },
      masterCvMarkdown: 'Senior dev with 10 years experience',
      jobDescription: 'Looking for a Senior dev with 8+ years experience in Node and React.',
    } as any);

    expect(spy).toHaveBeenCalled();
    expect((result as any).overallScore).toBe(4.8);
  });
});
