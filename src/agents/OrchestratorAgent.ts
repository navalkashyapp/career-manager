import { GoogleGenAI } from '@google/genai';
import { JobEvaluationAgent } from './JobEvaluationAgent';
import { ResumeTailorAgent } from './ResumeTailorAgent';
import { PortalExtractionAgent } from './PortalExtractionAgent';
import { InterviewCoachAgent } from './InterviewCoachAgent';
import { OutreachAgent } from './OutreachAgent';
import { GEMINI_MODELS } from '../config/gemini';

export class OrchestratorAgent {
  private ai: GoogleGenAI;
  private jobEval: JobEvaluationAgent;
  private resumeTailor: ResumeTailorAgent;
  private portalExtract: PortalExtractionAgent;
  private interviewCoach: InterviewCoachAgent;
  private outreach: OutreachAgent;

  constructor(aiClient: GoogleGenAI) {
    this.ai = aiClient;
    this.jobEval = new JobEvaluationAgent(aiClient, GEMINI_MODELS.FLASH);
    this.resumeTailor = new ResumeTailorAgent(aiClient, GEMINI_MODELS.PRO); // Tailoring needs deeper reasoning
    this.portalExtract = new PortalExtractionAgent(aiClient, GEMINI_MODELS.FLASH);
    this.interviewCoach = new InterviewCoachAgent(aiClient, GEMINI_MODELS.FLASH);
    this.outreach = new OutreachAgent(aiClient, GEMINI_MODELS.FLASH);
  }

  public async handleAction(action: string, payload: any): Promise<any> {
    const { 
      userProfile, 
      masterCvMarkdown, 
      jobDescription, 
      jobDescriptions, 
      interviewFocus,
      chatHistory,
      interviewTranscript,
      persona,
      channel,
      domSnippet
    } = payload;

    switch (action) {
      case 'evaluate_job':
        return this.jobEval.evaluateJob(userProfile, masterCvMarkdown, jobDescription);
      
      case 'tailor_resume':
        return this.resumeTailor.tailorResume(userProfile, masterCvMarkdown, jobDescription);
      
      case 'parse_job_page':
        return this.portalExtract.extractMetadata(domSnippet || jobDescription);
      
      case 'batch_evaluate_jobs':
        // Process in parallel
        if (!Array.isArray(jobDescriptions)) {
          throw new Error('jobDescriptions must be an array for batch evaluation');
        }
        const evaluations = await Promise.all(
          jobDescriptions.map(async (jd, index) => {
            const evalResult = await this.jobEval.evaluateJob(userProfile, masterCvMarkdown, jd);
            return {
              jobIndex: index,
              ...evalResult
            };
          })
        );
        // Sort from highest to lowest match score
        evaluations.sort((a, b) => b.overallScore - a.overallScore);
        return { batchEvaluations: evaluations };

      case 'interview_prep_plan':
        return this.interviewCoach.generatePrepPlan(userProfile, masterCvMarkdown, jobDescription);
      
      case 'interview_prep_mock':
        return this.interviewCoach.generateMockQuestion(jobDescription, chatHistory || interviewFocus);
      
      case 'interview_prep_debrief':
        return this.interviewCoach.generateDebrief(interviewTranscript || jobDescription);
      
      case 'draft_outreach':
        return this.outreach.generateOutreach(userProfile, masterCvMarkdown, jobDescription, persona || 'Hiring Manager', channel || 'Cold Email');

      default:
        throw new Error(`Unknown action in OrchestratorAgent: ${action}`);
    }
  }
}
