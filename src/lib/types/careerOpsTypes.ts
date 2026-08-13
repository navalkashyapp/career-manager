import { UserProfile } from '../../types';

export interface MatchScorerInput {
  userProfile: UserProfile;
  cvText: string;
  jobDescription: string;
}

export interface MatchScorerResult {
  overallScore: number;
  grades: {
    skillAlignment: string;
    cultureFit: string;
    compensationMatching: string;
    growthPotential: string;
  };
  jobTitle: string;
  companyName: string;
  jobSummary: string;
  gapAnalysis: string[];
  verdict: string;
}

export interface CVTailorInput {
  userProfile: UserProfile;
  masterCvText: string;
  jobDescription: string;
  archetype: string;
}

export interface CVTailorResult {
  tailoredSummary: string;
  tailoredExperiences: Array<{
    id: string; // matches the CareerEntry id
    tailoredBullets: string[];
  }>;
  tailoredProjects: Array<{
    id: string; // matches the ProjectBrief id
    tailoredImpact: string;
    tailoredArchitecture: string;
  }>;
  coverLetterDraft?: string;
}

export interface InterviewCoachInput {
  userProfile: UserProfile;
  cvText: string;
  jobDescription: string;
  companyName: string;
  roleTitle: string;
}

export interface InterviewCoachResult {
  recruiterScreenPrep: {
    expectedQuestions: string[];
    compensationStrategy: string;
  };
  hiringManagerPrep: {
    technicalPriorities: string[];
    companyMilestones: string[];
  };
  peerPanelPrep: {
    technicalQuestions: string[];
    systemDesignTopics: string[];
  };
  recommendedStarStories: Array<{
    storyTitle: string;
    situation: string;
    task: string;
    action: string;
    result: string;
    relevanceToJob: string;
  }>;
}
