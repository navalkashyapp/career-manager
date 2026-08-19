export interface UserProfile {
  id: string;
  fullName: string;
  targetTitle: string;
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

export type JobStage = 'Targeting' | 'Referral Requested' | 'Applied' | 'Recruiter Screen' | 'Technical Loop' | 'Onsite' | 'Offer Extended' | 'Archived';

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
  matchScore: number;
  stage: JobStage;
  notes: string;
  
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
  outreachDrafts?: Array<{
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
}
