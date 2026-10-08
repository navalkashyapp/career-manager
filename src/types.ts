export interface UserProfile {
  profileName?: string;
  isDefault?: boolean;
  id: string;
  fullName: string;
  targetTitle: string;
  targetLevel?: string;
  jobTitle?: string;
  location: string;
  preferredCompensation: string;
  linkedinUrl: string;
  portfolioUrl: string;
  careerHistory: CareerEntry[];
  coreSkills: CoreSkills;
  projects: ProjectBrief[];
  resumeVersions?: ResumeVersion[];
  chatSummary?: string;
  education?: EducationEntry[];
  workAuthorization?: WorkAuthorizationEntry[];
  email?: string;
  phone?: string;
}

export interface WorkAuthorizationEntry {
  id: string;
  country: string;
  type: string;
  validity: string;
}

export interface EducationEntry {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate: string;
}

export interface ResumeVersion {
  id: string;
  name: string;
  timestamp: number;
  markdown: string;
}

export interface CareerEntry {
  id: string;
  company: string;
  title: string;
  dates: string;
  location: string;
  bullets: string[];
}

export interface CoreSkills {
  cloudInfrastructure: string[];
  programmingLanguages: string[];
  frameworks: string[];
  certifications: string[];
  programMethodologies: string[];
}

export interface ProjectBrief {
  id: string;
  title: string;
  problem: string;
  architecture: string;
  impact: string;
  teamSize: string;
  scaleMetrics: string;
}

export type JobStage =
  | 'Targeting'
  | 'Referral Requested'
  | 'Applied'
  | 'Recruiter Screen'
  | 'Technical Loop'
  | 'Onsite'
  | 'Offer Extended'
  | 'Archived';

export interface JobApplication {
  id: string;
  jobTitle: string;
  companyName: string;
  location: string;
  jobUrl?: string;
  salaryRange: string;
  targetLevel: string;
  contacts: ContactPerson[];
  rawJobDescription: string;
  cleanedJdJson?: any;
  extractedMarkdown?: string;
  matchScore: number;
  stage: JobStage;
  notes: string;
  nextEventDate?: string;

  // AI Career-Ops Fields
  gapAnalysis?: string[];
  aiAnalysis?: {
    skillAlignment?: string;
    cultureFit?: string;
    compensationMatching?: string;
    growthPotential?: string;
    verdict?: string;
  };
  resumeSnapshot?: string; // The active targeted resume text
  tailoredResumes?: Array<{
    id: string;
    markdown: string;
    createdAt: number;
    keywordsTargeted: string[];
  }>;
  tailoredResumePackage?: {
    tailoredSummary?: string;
    tailoredExperiences?: Array<{ id: string; tailoredBullets: string[] }>;
    tailoredProjects?: Array<{
      id: string;
      tailoredImpact?: string;
      tailoredArchitecture?: string;
    }>;
    coverLetterDraft?: string;
    keywordAdjustments?: Array<{ keyword: string; suggestion?: string }>;
    generatedAt?: number;
  };
  interviewPrep?: {
    systemDesignQuestions?: Array<{ question: string; focusAreas: string[] }>;
    behavioralPrompts?: Array<{ prompt: string; whyTheyAskThis: string }>;
    generatedAt?: number;
  };
  outreachDraftsRecruiter?: Array<{
    id: string;
    subject: string;
    body: string;
    type: string;
    createdAt: number;
  }>;
  outreachDraftsHiringManager?: Array<{
    id: string;
    subject: string;
    body: string;
    type: string;
    createdAt: number;
  }>;
  outreachDraftsFriend?: Array<{
    id: string;
    subject: string;
    body: string;
    type: string;
    createdAt: number;
  }>;

  createdAt: number;
  updatedAt: number;
}

export interface ContactPerson {
  id: string;
  name: string;
  role: string;
  email: string;
  linkedinUrl: string;
}

export interface JobSearchHistoryEntry {
  id: string;
  timestamp: number;
  input: string;
  result: any;
  status?: 'pending' | 'completed' | 'error';
  progressPhase?: string;
  progressPercent?: number;
  error?: string;
}
