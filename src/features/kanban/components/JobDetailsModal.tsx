import React, { useState, useMemo, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import {
  X,
  Building2,
  MapPin,
  DollarSign,
  Layers,
  Calendar,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  FileText,
  Activity,
  BrainCircuit,
  Send,
  RefreshCw,
  Loader2,
  BookOpen,
  Briefcase,
  FileCode2,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Textarea } from '../../../components/ui/textarea';
import { useCareerOps } from '../../../hooks/useCareerOps';
import { useData } from '../../../hooks/useData';
import { useKanban } from '../hooks/useKanban';
import { prepInterview } from '../api/prepInterview';
import { OutreachAgent } from '../../../agents';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '../../../lib/utils';
import type { JobApplication, JobStage } from '../../../types';

export type DetailsTabType = 'description' | 'notes' | 'tailor' | 'prep' | 'outreach';

interface JobDetailsModalProps {
  app: JobApplication;
  onClose: () => void;
  initialTab?: DetailsTabType;
}

const ALL_STAGES: JobStage[] = [
  'Targeting',
  'Referral Requested',
  'Applied',
  'Recruiter Screen',
  'Technical Loop',
  'Onsite',
  'Offer Extended',
  'Archived',
];

const TONES = ['Professional', 'Casual', 'Direct'];
const AUDIENCES = ['Recruiter', 'Friend', 'Hiring Manager'];

function formatExtractedMarkdown(app: JobApplication): string {
  if (app.extractedMarkdown && app.extractedMarkdown.trim()) {
    return app.extractedMarkdown.trim();
  }

  let cleaned = app.cleanedJdJson;
  if (typeof cleaned === 'string') {
    try {
      cleaned = JSON.parse(cleaned);
    } catch (e) {
      if (cleaned.length > 50 && cleaned.includes('#')) {
        return cleaned;
      }
    }
  }

  if (cleaned?.extractedMarkdown && typeof cleaned.extractedMarkdown === 'string') {
    return cleaned.extractedMarkdown.trim();
  }

  const sections: string[] = [];

  // Header Title
  const title = app.jobTitle || cleaned?.jobTitle || 'Target Role';
  const company = app.companyName || cleaned?.companyName || 'Target Company';
  sections.push(`## ${title} @ ${company}\n`);

  // Metadata pills
  const meta: string[] = [];
  const loc = app.location || cleaned?.location;
  const level = app.targetLevel || cleaned?.targetLevel;
  const salary = app.salaryRange || cleaned?.salaryRange;
  if (loc) meta.push(`**Location:** ${loc}`);
  if (level) meta.push(`**Level:** ${level}`);
  if (salary) meta.push(`**Compensation:** ${salary}`);
  if (meta.length > 0) {
    sections.push(meta.join('  •  ') + '\n');
  }

  const postingUrl = app.jobUrl || cleaned?.jobUrl;
  if (postingUrl) {
    sections.push(`🔗 [View Original Job Posting](${postingUrl})\n`);
  }

  sections.push('---\n');

  // Role Overview / Summary
  const summary = cleaned?.jobSummary || cleaned?.roleSummary;
  if (summary) {
    sections.push(`### 📋 Role Overview\n${summary}\n`);
  }

  // Key Requirements
  const reqs = cleaned?.keyRequirements || cleaned?.requirements;
  if (Array.isArray(reqs) && reqs.length > 0) {
    sections.push(`### 🎯 Key Requirements & Qualifications\n`);
    reqs.forEach((r: string) => sections.push(`- ${r}`));
    sections.push('');
  }

  // Core Responsibilities
  const responsibilities = cleaned?.responsibilities || cleaned?.coreResponsibilities;
  if (Array.isArray(responsibilities) && responsibilities.length > 0) {
    sections.push(`### 💼 Core Responsibilities\n`);
    responsibilities.forEach((r: string) => sections.push(`- ${r}`));
    sections.push('');
  }

  // Tech Stack & Skills
  const stack = cleaned?.techStack || cleaned?.preferredSkills;
  if (Array.isArray(stack) && stack.length > 0) {
    sections.push(`### 🛠️ Tech Stack & Key Skills\n`);
    stack.forEach((s: string) => sections.push(`- \`${s}\``));
    sections.push('');
  }

  // If cleanedJdJson had no sections, check if notes contains Executive Summary or Key Requirements
  if (sections.length <= 4 && app.notes) {
    const formattedNotes = app.notes
      .replace(/^Executive Summary:/im, '### 📋 Executive Summary\n')
      .replace(/^Key Requirements:/im, '### 🎯 Key Requirements\n')
      .replace(/^• /gm, '- ');
    sections.push(formattedNotes);
  }

  // If still empty and rawJobDescription is available
  if (sections.length <= 4 && app.rawJobDescription) {
    sections.push(`### 📄 Job Description\n${app.rawJobDescription}`);
  }

  return sections.join('\n');
}

export const JobDetailsModal: React.FC<JobDetailsModalProps> = ({
  app,
  onClose,
  initialTab = 'description',
}) => {
  const { updateStage } = useKanban();
  const { profiles, updateApplication } = useData();
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const { generateTailoredResume, extractJobFromUrl } = useCareerOps();

  const [activeTab, setActiveTab] = useState<DetailsTabType>(initialTab);
  const [copiedJd, setCopiedJd] = useState(false);

  // --- Extracted JD State ---
  const [jdViewMode, setJdViewMode] = useState<'extracted' | 'raw'>('extracted');
  const [isExtractingJd, setIsExtractingJd] = useState(false);
  const [extractJdPhase, setExtractJdPhase] = useState('');
  const [extractJdPercentage, setExtractJdPercentage] = useState(0);
  const [extractJdError, setExtractJdError] = useState<string | null>(null);

  const extractedMarkdownText = useMemo(() => formatExtractedMarkdown(app), [app]);

  const handleCopyJd = () => {
    const textToCopy =
      jdViewMode === 'extracted'
        ? extractedMarkdownText || app.rawJobDescription
        : app.rawJobDescription;
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopiedJd(true);
    setTimeout(() => setCopiedJd(false), 2000);
  };

  const handleExtractJdWithAi = async () => {
    if (!app.rawJobDescription) return;
    setIsExtractingJd(true);
    setExtractJdError(null);
    setExtractJdPhase('Analyzing job description with Antigravity...');
    setExtractJdPercentage(20);
    try {
      const data = await extractJobFromUrl({ jdText: app.rawJobDescription }, (p) => {
        setExtractJdPhase(p.phase);
        setExtractJdPercentage(p.percentage);
      });

      const generatedMarkdown =
        data.extractedMarkdown ||
        [
          `## ${data.jobTitle || app.jobTitle} @ ${data.companyName || app.companyName}\n`,
          [
            data.location || app.location ? `**Location:** ${data.location || app.location}` : '',
            data.targetLevel || app.targetLevel
              ? `**Level:** ${data.targetLevel || app.targetLevel}`
              : '',
            data.salaryRange || app.salaryRange
              ? `**Compensation:** ${data.salaryRange || app.salaryRange}`
              : '',
          ]
            .filter(Boolean)
            .join('  •  ') + '\n',
          data.jobUrl || app.jobUrl
            ? `🔗 [View Original Job Posting](${data.jobUrl || app.jobUrl})\n`
            : '',
          '---\n',
          data.jobSummary ? `### 📋 Role Overview\n${data.jobSummary}\n` : '',
          data.keyRequirements?.length
            ? `### 🎯 Key Requirements & Qualifications\n${data.keyRequirements.map((r: string) => `- ${r}`).join('\n')}\n`
            : '',
          data.responsibilities?.length
            ? `### 💼 Core Responsibilities\n${data.responsibilities.map((r: string) => `- ${r}`).join('\n')}\n`
            : '',
          data.techStack?.length
            ? `### 🛠️ Tech Stack & Key Skills\n${data.techStack.map((s: string) => `- \`${s}\``).join('\n')}\n`
            : '',
        ]
          .filter(Boolean)
          .join('\n');

      await updateApplication(app.id, {
        cleanedJdJson: data,
        extractedMarkdown: generatedMarkdown,
        ...(data.companyName && data.companyName !== 'Unknown Company' && !app.companyName
          ? { companyName: data.companyName }
          : {}),
        ...(data.jobTitle && data.jobTitle !== 'Unknown Title' && !app.jobTitle
          ? { jobTitle: data.jobTitle }
          : {}),
        ...(data.location && !app.location ? { location: data.location } : {}),
        ...(data.salaryRange && !app.salaryRange ? { salaryRange: data.salaryRange } : {}),
        ...(data.targetLevel && !app.targetLevel ? { targetLevel: data.targetLevel } : {}),
      });
      setJdViewMode('extracted');
    } catch (err: any) {
      console.error('Failed to extract job description:', err);
      setExtractJdError(err.message || 'Failed to extract job details.');
    } finally {
      setIsExtractingJd(false);
      setExtractJdPhase('');
      setExtractJdPercentage(0);
    }
  };

  // --- Tailor Resume State ---

  const defaultProfile = profiles.find((p) => p.isDefault) || profiles[0];
  const activeTailorProfile = selectedProfileId
    ? profiles.find((p) => p.id === selectedProfileId) || defaultProfile
    : defaultProfile;
  const profile = activeTailorProfile;

  const [tailorData, setTailorData] = useState<any>(
    app.tailoredResumePackage ||
      (app.tailoredResumes && app.tailoredResumes.length > 0
        ? { coverLetterDraft: app.tailoredResumes[0].markdown }
        : null),
  );
  const [tailorLoading, setTailorLoading] = useState(false);
  const [tailorPhase, setTailorPhase] = useState('Initializing...');
  const [tailorPercentage, setTailorPercentage] = useState(0);
  const [tailorError, setTailorError] = useState<string | null>(null);

  // --- Interview Prep State ---
  const [prepData, setPrepData] = useState<any>(app.interviewPrep || null);
  const [prepLoading, setPrepLoading] = useState(false);
  const [prepError, setPrepError] = useState<string | null>(null);

  // --- Outreach State ---
  const [tone, setTone] = useState('Professional');
  const [audience, setAudience] = useState('Recruiter');
  const [draftsRecruiter, setDraftsRecruiter] = useState<any[]>(app.outreachDraftsRecruiter || []);
  const [draftsFriend, setDraftsFriend] = useState<any[]>(app.outreachDraftsFriend || []);
  const [draftsHiringManager, setDraftsHiringManager] = useState<any[]>(
    app.outreachDraftsHiringManager || [],
  );
  const [outreachLoading, setOutreachLoading] = useState(false);
  const [outreachPhase, setOutreachPhase] = useState('Initializing...');
  const [outreachPercentage, setOutreachPercentage] = useState(0);
  const [outreachError, setOutreachError] = useState<string | null>(null);
  const [copiedDraftId, setCopiedDraftId] = useState<string | null>(null);

  // Sync state whenever application updates from Firestore
  useEffect(() => {
    if (app.interviewPrep) {
      setPrepData(app.interviewPrep);
    }
    if (app.tailoredResumePackage) {
      setTailorData(app.tailoredResumePackage);
    } else if (app.tailoredResumes && app.tailoredResumes.length > 0) {
      setTailorData({ coverLetterDraft: app.tailoredResumes[0].markdown });
    }
    if (app.outreachDraftsRecruiter) {
      setDraftsRecruiter(app.outreachDraftsRecruiter);
    }
    if (app.outreachDraftsFriend) {
      setDraftsFriend(app.outreachDraftsFriend);
    }
    if (app.outreachDraftsHiringManager) {
      setDraftsHiringManager(app.outreachDraftsHiringManager);
    }
  }, [app]);

  const handleGeneratePdf = async () => {
    try {
      let pdfMakeModule: any;
      let pdfFontsModule: any;
      try {
        pdfMakeModule = await import('pdfmake/build/pdfmake');
        pdfFontsModule = await import('pdfmake/build/vfs_fonts');
      } catch (loadErr: any) {
        if (
          loadErr?.message?.includes('Failed to fetch dynamically imported module') ||
          loadErr?.message?.includes('error loading dynamically imported module')
        ) {
          console.warn(
            '[PDF Export] Stale dynamic chunk detected. Reloading page to load latest version...',
          );
          window.location.reload();
          return;
        }
        throw loadErr;
      }

      const pdfMake = pdfMakeModule.default || pdfMakeModule;
      const pdfFonts = pdfFontsModule.default || pdfFontsModule;

      pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.vfs;

      const content: any[] = [];

      const fullName = (profile as any)?.fullName || (profile as any)?.name || 'My Resume';
      content.push({ text: fullName, style: 'nameHeader' });

      const contactInfo = [
        activeTailorProfile?.phone,
        activeTailorProfile?.email,
        profile?.linkedinUrl
          ? activeTailorProfile?.linkedinUrl.replace(/^https?:\/\/(www\.)?/, '')
          : null,
      ]
        .filter(Boolean)
        .join(' • ');

      if (contactInfo) {
        content.push({ text: contactInfo, style: 'contactInfo' });
      }

      const profileTitle =
        [profile.targetLevel, profile.jobTitle].filter(Boolean).join(' ') || profile.targetTitle;
      const roleTargetStr = profileTitle ? `${profileTitle} | ${profile.location || 'Remote'}` : '';
      if (roleTargetStr) {
        content.push({ text: roleTargetStr, style: 'roleTarget' });
      }

      const summaryText = tailorData?.tailoredSummary || tailorData?.summary;
      if (summaryText) {
        content.push({ text: summaryText, style: 'summaryText' });
      }

      const allSkills =
        tailorData?.keySkills && tailorData.keySkills.length > 0
          ? tailorData.keySkills
          : profile?.coreSkills
            ? Object.values(activeTailorProfile?.coreSkills).flat().filter(Boolean)
            : (profile as any)?.skills || [];

      if (allSkills.length > 0) {
        content.push({ text: 'Key Skills and Expertise', style: 'sectionHeaderCentered' });
        content.push({ text: allSkills.join(' | '), style: 'centeredText' });
      }

      const parseBoldText = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.map((part) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return { text: part.slice(2, -2), bold: true };
          }
          return { text: part };
        });
      };

      const formatCompany = (companyStr: string) => {
        if (!companyStr) return '';
        const parts = companyStr.split(',');
        if (parts.length > 1) {
          return `${parts[0].toUpperCase()},${parts.slice(1).join(',')}`;
        }
        return companyStr.toUpperCase();
      };

      if (tailorData?.tailoredExperiences && tailorData.tailoredExperiences.length > 0) {
        content.push({ text: 'Professional Experience', style: 'sectionHeaderCentered' });
        tailorData.tailoredExperiences.forEach((exp: any) => {
          if (exp.company) {
            content.push({
              columns: [
                { text: formatCompany(exp.company), style: 'companyName', width: '*' },
                { text: exp.companyDates || '', style: 'datesRight', width: 'auto' },
              ],
            });
            content.push({
              text: `${exp.role || exp.id}`,
              style: 'roleTitle',
            });
          } else {
            content.push({ text: exp.id, style: 'companyName' });
          }

          if (exp.tailoredBullets && exp.tailoredBullets.length > 0) {
            content.push({
              ul: exp.tailoredBullets.map((bullet: string) => ({ text: parseBoldText(bullet) })),
              style: 'bulletList',
            });
          }
        });
      }

      if (
        tailorData?.educationAndQualifications &&
        tailorData.educationAndQualifications.length > 0
      ) {
        content.push({ text: 'Education And Qualifications', style: 'sectionHeaderCentered' });
        tailorData.educationAndQualifications.forEach((edu: any) => {
          content.push({
            columns: [
              { text: edu.degree || '', style: 'degreeLeft', width: '*' },
              { text: edu.dates || '', style: 'datesRight', width: 'auto' },
            ],
          });
          if (edu.school) {
            content.push({ text: edu.school, style: 'schoolLeft' });
          }
        });
      }

      const docDefinition = {
        content: content,
        styles: {
          nameHeader: { fontSize: 16, bold: true, alignment: 'center', margin: [0, 0, 0, 2] },
          contactInfo: { fontSize: 10, alignment: 'center', margin: [0, 0, 0, 6] },
          roleTarget: { fontSize: 11, bold: true, alignment: 'center', margin: [0, 0, 0, 4] },
          summaryText: {
            fontSize: 10,
            alignment: 'justify',
            margin: [0, 0, 0, 8],
            lineHeight: 1.2,
          },
          sectionHeaderCentered: {
            fontSize: 12,
            bold: true,
            alignment: 'center',
            margin: [0, 8, 0, 4],
          },
          centeredText: {
            fontSize: 10,
            alignment: 'center',
            margin: [0, 0, 0, 8],
            lineHeight: 1.2,
          },
          companyName: { fontSize: 10, bold: true, margin: [0, 4, 0, 2] },
          roleTitle: { fontSize: 10, bold: true, margin: [0, 0, 0, 4] },
          datesRight: { fontSize: 10, bold: true, alignment: 'right' },
          bulletList: { fontSize: 10, alignment: 'justify', margin: [0, 0, 0, 8], lineHeight: 1.2 },
          degreeLeft: { fontSize: 10, bold: true, margin: [0, 4, 0, 2] },
          schoolLeft: { fontSize: 10, bold: true, margin: [0, 0, 0, 4] },
        },
        defaultStyle: {
          font: 'Roboto',
        },
      };

      // @ts-ignore
      pdfMake
        .createPdf(docDefinition)
        .download(`Resume_Tailored_${app.companyName || 'Export'}.pdf`);
    } catch (e) {
      console.error('Failed to generate PDF:', e);
    }
  };

  const handleFetchTailoredResume = async () => {
    if (!profile) return;
    setTailorLoading(true);
    setTailorError(null);
    try {
      const data: any = await generateTailoredResume(
        app.extractedMarkdown || app.rawJobDescription || '',
        profile,
        (progress) => {
          setTailorPhase(progress.phase);
          setTailorPercentage(progress.percentage);
        },
      );
      setTailorData(data);

      const tailoredPkg = {
        ...data,
        generatedAt: Date.now(),
      };

      const newEntry = {
        id: Date.now().toString(),
        markdown: data.coverLetterDraft || data.tailoredSummary || '',
        createdAt: Date.now(),
        keywordsTargeted: data.keywordAdjustments?.map((k: any) => k.keyword) || [],
      };
      const updatedTailored = [newEntry, ...(app.tailoredResumes || [])];

      if (app.id) {
        await updateApplication(app.id, {
          tailoredResumePackage: tailoredPkg,
          tailoredResumes: updatedTailored,
        });
      }
    } catch (err: any) {
      setTailorError(err.message || 'Failed to tailor resume.');
    } finally {
      setTailorLoading(false);
    }
  };

  const handleFetchPrep = async () => {
    setPrepLoading(true);
    setPrepError(null);
    try {
      const data = await prepInterview({
        jdText: app.rawJobDescription || '',
        companyName: app.companyName,
      });
      const prepPayload = {
        ...data,
        generatedAt: Date.now(),
      };
      setPrepData(prepPayload);

      if (app.id) {
        await updateApplication(app.id, {
          interviewPrep: prepPayload,
        });
      }
    } catch (err: any) {
      setPrepError(err.message || 'Failed to generate interview prep.');
    } finally {
      setPrepLoading(false);
    }
  };

  const currentDrafts =
    audience === 'Recruiter'
      ? draftsRecruiter
      : audience === 'Friend'
        ? draftsFriend
        : draftsHiringManager;

  const handleGenerateOutreach = async () => {
    if (!profile) return;
    setOutreachLoading(true);
    setOutreachError(null);
    setCopiedDraftId(null);
    try {
      const agent = new OutreachAgent();

      let cleanedJd =
        typeof app.cleanedJdJson === 'string'
          ? app.cleanedJdJson
          : JSON.stringify(app.cleanedJdJson, null, 2);

      let extractedCleanJd: string | null = null;
      if (!app.cleanedJdJson) {
        setOutreachPhase('Extracting Job Requirements...');
        setOutreachPercentage(20);
        cleanedJd = await agent.extractJobDescription(app.rawJobDescription || '');
        extractedCleanJd = cleanedJd;
      }

      setOutreachPhase('Drafting & Polishing Message...');
      setOutreachPercentage(60);
      const refined = await agent.generateMessage(
        cleanedJd,
        profile,
        `${tone} Outreach to ${audience}`,
      );

      setOutreachPhase('Complete');
      setOutreachPercentage(100);

      const newDraft = {
        id: Date.now().toString(),
        type: `Custom (${tone} to ${audience})`,
        subject: refined.subject || '',
        body: refined.body || '',
        createdAt: Date.now(),
      };
      const newDrafts = [newDraft, ...currentDrafts];
      const updatePayload: any = {};
      if (audience === 'Recruiter') {
        setDraftsRecruiter(newDrafts);
        updatePayload.outreachDraftsRecruiter = newDrafts;
      } else if (audience === 'Friend') {
        setDraftsFriend(newDrafts);
        updatePayload.outreachDraftsFriend = newDrafts;
      } else {
        setDraftsHiringManager(newDrafts);
        updatePayload.outreachDraftsHiringManager = newDrafts;
      }

      if (extractedCleanJd && !app.cleanedJdJson) {
        updatePayload.cleanedJdJson = extractedCleanJd;
      }

      if (app.id) {
        await updateApplication(app.id, updatePayload);
      }
    } catch (err: any) {
      setOutreachError(err.message || 'Failed to generate outreach draft.');
    } finally {
      setOutreachLoading(false);
    }
  };

  const handleCopyDraft = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDraftId(id);
    setTimeout(() => setCopiedDraftId(null), 2000);
  };

  const handleStageChange = (newStage: JobStage) => {
    updateStage(app.id, newStage);
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[100] sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#1E293B] sm:border border-slate-200 dark:border-[#334155] sm:rounded-2xl w-full h-[100dvh] sm:h-auto max-w-4xl sm:max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 md:p-6 border-b border-slate-200 dark:border-[#334155] flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50 dark:bg-[#0F172A]/50 relative">
          {/* Mobile Close Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute top-3 right-3 md:hidden text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <X size={20} />
          </Button>

          <div className="space-y-1.5 flex-1 min-w-0 pr-8 md:pr-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 font-medium"
              >
                {app.stage}
              </Badge>
              {app.matchScore && app.matchScore > 0 && (
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                >
                  <Activity size={12} className="mr-1" />
                  {app.matchScore}% Match
                </Badge>
              )}
              {app.jobUrl && (
                <a
                  href={app.jobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <ExternalLink size={12} />
                  <span>View Original Posting</span>
                </a>
              )}
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
              {app.jobTitle}
            </h2>
            <div className="flex items-center text-sm font-medium text-slate-600 dark:text-slate-300">
              <Building2 size={16} className="mr-1.5 text-slate-400" />
              <span>{app.companyName}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0 self-start md:self-center">
            <select
              value={app.stage}
              onChange={(e) => handleStageChange(e.target.value as JobStage)}
              className="text-xs py-1.5 px-2.5 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              {ALL_STAGES.map((s) => (
                <option key={s} value={s}>
                  Move to: {s}
                </option>
              ))}
            </select>
            <select
              value={activeTailorProfile?.id || ''}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              className="text-xs py-1.5 px-2.5 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.profileName || (p.isDefault ? 'Main Profile' : 'Untitled Profile')}
                </option>
              ))}
            </select>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="hidden md:flex text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X size={20} />
            </Button>
          </div>
        </div>

        {/* Quick Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 md:p-5 bg-slate-100/50 dark:bg-[#0B0F17]/40 border-b border-slate-200 dark:border-[#334155] text-xs">
          <div className="space-y-1">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <MapPin size={13} className="text-slate-400" /> Location
            </span>
            <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
              {app.location || 'Remote / Unspecified'}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <DollarSign size={13} className="text-slate-400" /> Compensation
            </span>
            <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
              {app.salaryRange || 'Not disclosed'}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Layers size={13} className="text-slate-400" /> Target Level
            </span>
            <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
              {app.targetLevel || 'Standard'}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Calendar size={13} className="text-slate-400" /> Added
            </span>
            <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
              {app.createdAt ? format(new Date(app.createdAt), 'MMM d, yyyy') : 'Recently'}
            </p>
          </div>
        </div>

        {/* 5 Content Tabs */}
        <div className="px-5 md:px-6 pt-3 flex items-center justify-between border-b border-slate-200 dark:border-[#334155] overflow-x-auto no-scrollbar bg-white dark:bg-[#1E293B]">
          <div className="flex space-x-1 sm:space-x-3 min-w-max">
            <button
              onClick={() => setActiveTab('description')}
              className={`flex items-center gap-1.5 pb-3 px-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'description'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <FileText size={15} />
              <span>Job Description</span>
            </button>

            <button
              onClick={() => setActiveTab('notes')}
              className={`flex items-center gap-1.5 pb-3 px-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'notes'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <BookOpen size={15} />
              <span>Notes & Summary</span>
            </button>

            <button
              onClick={() => setActiveTab('tailor')}
              className={`flex items-center gap-1.5 pb-3 px-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'tailor'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <Sparkles size={15} className="text-indigo-500 dark:text-indigo-400" />
              <span>Tailor Resume</span>
            </button>

            <button
              onClick={() => setActiveTab('prep')}
              className={`flex items-center gap-1.5 pb-3 px-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'prep'
                  ? 'border-fuchsia-500 text-fuchsia-600 dark:text-fuchsia-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <BrainCircuit size={15} className="text-fuchsia-500 dark:text-fuchsia-400" />
              <span>Interview Prep</span>
            </button>

            <button
              onClick={() => setActiveTab('outreach')}
              className={`flex items-center gap-1.5 pb-3 px-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'outreach'
                  ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <Send size={15} className="text-sky-500 dark:text-sky-400" />
              <span>Draft Outreach</span>
            </button>
          </div>
        </div>

        {/* Main Body */}
        <div className="p-5 md:p-6 overflow-y-auto flex-1 font-sans text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          {/* 1. Job Description Tab */}
          {activeTab === 'description' && (
            <div className="space-y-4">
              {/* Section Header Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-sky-50/50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/30 rounded-xl">
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="text-sky-500" size={17} />
                    <span>Role Breakdown & Extracted Intelligence</span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Structured markdown overview of role qualifications, responsibilities, and tech
                    stack.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* View Mode Toggle */}
                  <div className="flex bg-slate-200 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
                    <button
                      onClick={() => setJdViewMode('extracted')}
                      className={cn(
                        'px-2.5 py-1 rounded-md font-medium transition-all text-xs',
                        jdViewMode === 'extracted'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200',
                      )}
                    >
                      Extracted Markdown
                    </button>
                    <button
                      onClick={() => setJdViewMode('raw')}
                      className={cn(
                        'px-2.5 py-1 rounded-md font-medium transition-all text-xs',
                        jdViewMode === 'raw'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200',
                      )}
                    >
                      Raw Posting
                    </button>
                  </div>

                  {/* Extract with AI button */}
                  {app.rawJobDescription && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExtractJdWithAi}
                      disabled={isExtractingJd}
                      className="h-8 text-xs gap-1.5 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Sparkles
                        size={13}
                        className={cn('text-sky-500', isExtractingJd && 'animate-spin')}
                      />
                      <span>
                        {isExtractingJd
                          ? 'Extracting...'
                          : app.extractedMarkdown
                            ? 'Re-extract'
                            : 'Extract with AI'}
                      </span>
                    </Button>
                  )}

                  {/* Copy Button */}
                  {(app.rawJobDescription || extractedMarkdownText) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyJd}
                      className="text-xs h-8 gap-1.5 text-slate-600 dark:text-slate-300 shrink-0"
                    >
                      {copiedJd ? (
                        <Check size={14} className="text-emerald-500" />
                      ) : (
                        <Copy size={14} />
                      )}
                      <span>
                        {copiedJd
                          ? 'Copied'
                          : jdViewMode === 'extracted'
                            ? 'Copy Markdown'
                            : 'Copy Raw'}
                      </span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Extraction Progress Indicator */}
              {isExtractingJd && (
                <div className="flex flex-col items-center justify-center p-10 text-slate-500 dark:text-slate-400 space-y-4 bg-slate-50 dark:bg-[#0F172A] rounded-xl border border-slate-200 dark:border-[#334155]/60">
                  <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {extractJdPhase || 'Extracting structured details with Antigravity...'}
                  </p>
                  <div className="w-64 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-500 transition-all duration-300 ease-out"
                      style={{ width: `${extractJdPercentage}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Extraction Error */}
              {extractJdError && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl text-rose-500 text-xs text-center">
                  {extractJdError}
                </div>
              )}

              {/* Content View */}
              {!isExtractingJd &&
                (jdViewMode === 'extracted' ? (
                  extractedMarkdownText ? (
                    <div className="bg-slate-50 dark:bg-[#0F172A] p-5 rounded-xl border border-slate-200 dark:border-[#334155]/60 text-xs sm:text-sm select-text leading-relaxed">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw]}
                        components={{
                          h1: ({ node, ...props }) => (
                            <h1
                              className="text-xl sm:text-2xl font-bold mt-2 mb-3 text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2.5"
                              {...props}
                            />
                          ),
                          h2: ({ node, ...props }) => (
                            <h2
                              className="text-lg sm:text-xl font-semibold mt-4 mb-2 text-slate-900 dark:text-white"
                              {...props}
                            />
                          ),
                          h3: ({ node, ...props }) => (
                            <h3
                              className="text-sm sm:text-base font-semibold mt-4 mb-2 text-sky-600 dark:text-sky-400 flex items-center gap-1.5"
                              {...props}
                            />
                          ),
                          p: ({ node, ...props }) => (
                            <p
                              className="mb-3 leading-relaxed text-slate-700 dark:text-slate-300"
                              {...props}
                            />
                          ),
                          ul: ({ node, ...props }) => (
                            <ul
                              className="list-disc pl-5 mb-4 space-y-1.5 text-slate-700 dark:text-slate-300"
                              {...props}
                            />
                          ),
                          ol: ({ node, ...props }) => (
                            <ol
                              className="list-decimal pl-5 mb-4 space-y-1.5 text-slate-700 dark:text-slate-300"
                              {...props}
                            />
                          ),
                          li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
                          strong: ({ node, ...props }) => (
                            <strong
                              className="font-semibold text-slate-900 dark:text-white"
                              {...props}
                            />
                          ),
                          code: ({ node, inline, ...props }: any) => (
                            <code
                              className="text-[11px] sm:text-xs bg-slate-200 dark:bg-slate-800 text-sky-600 dark:text-sky-300 px-1.5 py-0.5 rounded font-mono"
                              {...props}
                            />
                          ),
                          hr: ({ node, ...props }) => (
                            <hr
                              className="my-4 border-slate-200 dark:border-slate-800"
                              {...props}
                            />
                          ),
                          a: ({ node, ...props }) => (
                            <a
                              className="text-sky-500 hover:text-sky-400 underline font-medium inline-flex items-center gap-1"
                              target="_blank"
                              rel="noopener noreferrer"
                              {...props}
                            />
                          ),
                        }}
                      >
                        {extractedMarkdownText}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="text-center py-16 text-slate-400">
                      <FileText size={40} className="mx-auto mb-3 opacity-40" />
                      <p className="font-medium text-slate-600 dark:text-slate-300">
                        No Extracted Details Available
                      </p>
                      <p className="text-xs text-slate-400 mt-1 mb-4">
                        Click below to extract structured details from the job posting.
                      </p>
                      {app.rawJobDescription && (
                        <Button
                          onClick={handleExtractJdWithAi}
                          className="bg-sky-600 hover:bg-sky-500 text-white text-xs h-9 px-4 gap-1.5 shadow-sm"
                        >
                          <Sparkles size={14} />
                          <span>Extract Details with AI</span>
                        </Button>
                      )}
                    </div>
                  )
                ) : app.rawJobDescription ? (
                  <div className="whitespace-pre-wrap font-sans bg-slate-50 dark:bg-[#0F172A] p-5 rounded-xl border border-slate-200 dark:border-[#334155]/60 text-xs sm:text-sm select-text leading-relaxed">
                    {app.rawJobDescription}
                  </div>
                ) : (
                  <div className="text-center py-16 text-slate-400">
                    <FileText size={40} className="mx-auto mb-3 opacity-40" />
                    <p className="font-medium text-slate-600 dark:text-slate-300">
                      No Job Description text available
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      This application was added without a raw job description.
                    </p>
                  </div>
                ))}
            </div>
          )}

          {/* 2. Notes & Summary Tab */}
          {activeTab === 'notes' &&
            (app.notes ? (
              <div className="whitespace-pre-wrap font-sans bg-slate-50 dark:bg-[#0F172A] p-5 rounded-xl border border-slate-200 dark:border-[#334155]/60 text-xs sm:text-sm select-text leading-relaxed">
                {app.notes}
              </div>
            ) : (
              <div className="text-center py-16 text-slate-400">
                <BookOpen size={40} className="mx-auto mb-3 opacity-40" />
                <p className="font-medium text-slate-600 dark:text-slate-300">
                  No notes recorded yet
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Run an evaluation or add custom notes to track insights for this role.
                </p>
              </div>
            ))}

          {/* 3. Tailor Resume Tab */}
          {activeTab === 'tailor' && (
            <div className="space-y-6">
              {/* Section Header with Action Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl">
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="text-indigo-500" size={17} />
                    AI Resume Customization
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Align your experience bullets and cover letter with the role requirements.
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {tailorData && (
                    <Button
                      onClick={handleGeneratePdf}
                      variant="outline"
                      className="text-xs h-9 gap-1.5 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/40"
                    >
                      <FileText size={14} />
                      <span>Download PDF</span>
                    </Button>
                  )}
                  <Button
                    onClick={handleFetchTailoredResume}
                    disabled={tailorLoading}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 gap-1.5 shadow-sm"
                  >
                    <RefreshCw size={14} className={tailorLoading ? 'animate-spin' : ''} />
                    <span>{tailorData ? 'Re-tailor Resume' : 'Tailor Resume'}</span>
                  </Button>
                </div>
              </div>

              {tailorLoading ? (
                <div className="flex flex-col items-center justify-center p-12 text-slate-500 dark:text-slate-400 space-y-4">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {tailorPhase}
                  </p>
                  <div className="w-64 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 transition-all duration-300 ease-out"
                      style={{ width: `${tailorPercentage}%` }}
                    />
                  </div>
                </div>
              ) : tailorError ? (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl text-rose-500 text-xs text-center">
                  {tailorError}
                </div>
              ) : tailorData ? (
                <div className="space-y-6">
                  {(tailorData.tailoredSummary || tailorData.summary) && (
                    <div className="bg-slate-50 dark:bg-[#0F172A] p-5 rounded-xl border border-slate-200 dark:border-[#334155]/60">
                      <h5 className="text-sm font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                        <BookOpen size={16} className="text-indigo-400" />
                        Tailored Professional Summary
                      </h5>
                      <Textarea
                        defaultValue={tailorData.tailoredSummary || tailorData.summary}
                        onBlur={(e) => {
                          const newVal = e.target.value;
                          if (newVal !== (tailorData.tailoredSummary || tailorData.summary)) {
                            // save it under both keys to be safe
                            const newData = {
                              ...tailorData,
                              tailoredSummary: newVal,
                              summary: newVal,
                            };
                            setTailorData(newData);
                            updateApplication(app.id, { tailoredResumePackage: newData }).catch(
                              console.error,
                            );
                          }
                        }}
                        className="w-full text-xs sm:text-sm min-h-[60px] p-2 bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-500 rounded-md transition-colors resize-none overflow-hidden text-slate-700 dark:text-slate-300 leading-relaxed"
                        onInput={(e: any) => {
                          e.target.style.height = 'auto';
                          e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                        onFocus={(e: any) => {
                          e.target.style.height = 'auto';
                          e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                      />
                    </div>
                  )}

                  {tailorData.tailoredExperiences && tailorData.tailoredExperiences.length > 0 && (
                    <div>
                      <h5 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                        <Briefcase size={16} className="text-sky-400" />
                        Tailored Experience Bullets
                      </h5>
                      <div className="space-y-3">
                        {tailorData.tailoredExperiences.map((exp: any, i: number) => (
                          <div
                            key={i}
                            className="bg-slate-50 dark:bg-[#0F172A] p-5 rounded-xl border border-slate-200 dark:border-[#334155]/60"
                          >
                            <p className="font-medium text-slate-800 dark:text-slate-200 mb-2 text-xs border-b border-slate-200 dark:border-[#334155] pb-1.5">
                              Role / Project: {exp.company} - {exp.role} | {exp.roleDates}
                            </p>
                            <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                              {exp.tailoredBullets?.map((bullet: string, j: number) => (
                                <li key={j}>
                                  <Textarea
                                    defaultValue={bullet}
                                    onBlur={(e) => {
                                      const newVal = e.target.value;
                                      if (newVal !== bullet) {
                                        const newData = { ...tailorData };
                                        newData.tailoredExperiences[i].tailoredBullets[j] = newVal;
                                        setTailorData(newData);
                                        updateApplication(app.id, {
                                          tailoredResumePackage: newData,
                                        }).catch(console.error);
                                      }
                                    }}
                                    className="w-full text-xs sm:text-sm min-h-[40px] p-1 bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-indigo-500 rounded-md transition-colors resize-none overflow-hidden"
                                    onInput={(e: any) => {
                                      e.target.style.height = 'auto';
                                      e.target.style.height = e.target.scrollHeight + 'px';
                                    }}
                                    onFocus={(e: any) => {
                                      e.target.style.height = 'auto';
                                      e.target.style.height = e.target.scrollHeight + 'px';
                                    }}
                                  />
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {tailorData.coverLetterDraft && (
                    <div className="bg-slate-50 dark:bg-[#0F172A] p-5 rounded-xl border border-slate-200 dark:border-[#334155]/60">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-sm font-semibold text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
                          <FileText size={16} className="text-indigo-500" />
                          Targeted Cover Letter Draft
                        </h5>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(tailorData.coverLetterDraft);
                          }}
                          className="h-7 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 gap-1"
                        >
                          <Copy size={13} />
                          <span>Copy</span>
                        </Button>
                      </div>
                      <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-serif">
                        {tailorData.coverLetterDraft}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-16 text-slate-400">
                  <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 flex items-center justify-center mx-auto mb-3">
                    <Sparkles size={22} />
                  </div>
                  <h4 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
                    No Tailored Resume Generated Yet
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-5">
                    Generate customized bullet points, tailored professional summaries, and
                    role-specific cover letter drafts.
                  </p>
                  <Button
                    onClick={handleFetchTailoredResume}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 px-4 gap-1.5 shadow-sm"
                  >
                    <Sparkles size={14} />
                    <span>Tailor Resume</span>
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* 4. Interview Prep Tab */}
          {activeTab === 'prep' && (
            <div className="space-y-6">
              {/* Section Header with Action Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-fuchsia-50/50 dark:bg-fuchsia-950/20 border border-fuchsia-100 dark:border-fuchsia-900/30 rounded-xl">
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <BrainCircuit className="text-fuchsia-500" size={17} />
                    Interview Preparation & Questions
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Predict technical loop questions, architecture challenges, and behavioral
                    prompts.
                  </p>
                </div>
                <Button
                  onClick={handleFetchPrep}
                  disabled={prepLoading}
                  className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs h-9 shrink-0 gap-1.5 shadow-sm"
                >
                  <RefreshCw size={14} className={prepLoading ? 'animate-spin' : ''} />
                  <span>{prepData ? 'Re-generate Prep' : 'Generate Interview Prep'}</span>
                </Button>
              </div>

              {prepLoading ? (
                <div className="flex flex-col items-center justify-center p-12 text-slate-500 dark:text-slate-400 space-y-3">
                  <RefreshCw size={30} className="animate-spin text-fuchsia-500" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Analyzing job description & generating tailored interview questions...
                  </p>
                </div>
              ) : prepError ? (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl text-rose-500 text-xs text-center">
                  {prepError}
                </div>
              ) : prepData ? (
                <div className="space-y-6">
                  {prepData.systemDesignQuestions && prepData.systemDesignQuestions.length > 0 && (
                    <div className="space-y-3">
                      <h5 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <BrainCircuit size={16} className="text-indigo-400" />
                        System Design & Technical Architecture
                      </h5>
                      <div className="space-y-3">
                        {prepData.systemDesignQuestions.map((q: any, i: number) => (
                          <div
                            key={i}
                            className="bg-slate-50 dark:bg-[#0F172A] p-5 rounded-xl border border-slate-200 dark:border-[#334155]/60"
                          >
                            <p className="font-medium text-slate-900 dark:text-white text-xs sm:text-sm mb-2">
                              {q.question}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {q.focusAreas?.map((area: string, j: number) => (
                                <span
                                  key={j}
                                  className="text-[11px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded"
                                >
                                  {area}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {prepData.behavioralPrompts && prepData.behavioralPrompts.length > 0 && (
                    <div className="space-y-3">
                      <h5 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <Activity size={16} className="text-fuchsia-400" />
                        Behavioral & Culture Fit Prompts
                      </h5>
                      <div className="space-y-3">
                        {prepData.behavioralPrompts.map((b: any, i: number) => (
                          <div
                            key={i}
                            className="bg-slate-50 dark:bg-[#0F172A] p-5 rounded-xl border border-slate-200 dark:border-[#334155]/60"
                          >
                            <p className="font-medium text-slate-900 dark:text-white text-xs sm:text-sm mb-1.5">
                              {b.prompt}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                              Why they ask: {b.whyTheyAskThis}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-16 text-slate-400">
                  <div className="w-12 h-12 rounded-full bg-fuchsia-50 dark:bg-fuchsia-950/40 text-fuchsia-500 flex items-center justify-center mx-auto mb-3">
                    <BrainCircuit size={22} />
                  </div>
                  <h4 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
                    No Interview Prep Generated Yet
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-5">
                    Prepare for technical loops, system design scenarios, and behavioral questions
                    customized to this role.
                  </p>
                  <Button
                    onClick={handleFetchPrep}
                    className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs h-9 px-4 gap-1.5 shadow-sm"
                  >
                    <BrainCircuit size={14} />
                    <span>Interview Prep</span>
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* 5. Draft Outreach Tab */}
          {activeTab === 'outreach' && (
            <div className="space-y-6">
              {/* Section Controls with Action Button */}
              <div className="p-4 bg-sky-50/50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/30 rounded-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <Send className="text-sky-500" size={17} />
                      AI Outreach Generator
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Tailored networking messages for recruiters, hiring managers, and connections.
                    </p>
                  </div>
                  <Button
                    onClick={handleGenerateOutreach}
                    disabled={outreachLoading}
                    className="bg-sky-600 hover:bg-sky-500 text-white text-xs h-9 shrink-0 gap-1.5 shadow-sm"
                  >
                    <Send size={13} className={outreachLoading ? 'animate-pulse' : ''} />
                    <span>{outreachLoading ? 'Generating...' : 'Draft Outreach'}</span>
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-sky-100 dark:border-sky-900/30 text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-500 font-medium">Audience:</span>
                    <div className="flex bg-white dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                      {AUDIENCES.map((a) => (
                        <button
                          key={a}
                          onClick={() => setAudience(a)}
                          className={`px-2.5 py-1 rounded-md transition-colors ${
                            audience === a
                              ? 'bg-sky-500 text-white font-medium shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-slate-500 font-medium">Tone:</span>
                    <div className="flex bg-white dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                      {TONES.map((t) => (
                        <button
                          key={t}
                          onClick={() => setTone(t)}
                          className={`px-2.5 py-1 rounded-md transition-colors ${
                            tone === t
                              ? 'bg-sky-500 text-white font-medium shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {outreachLoading ? (
                <div className="flex flex-col items-center justify-center p-12 text-slate-500 dark:text-slate-400 space-y-4">
                  <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {outreachPhase}
                  </p>
                  <div className="w-64 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-500 transition-all duration-300 ease-out"
                      style={{ width: `${outreachPercentage}%` }}
                    />
                  </div>
                </div>
              ) : outreachError ? (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl text-rose-500 text-xs text-center">
                  {outreachError}
                </div>
              ) : currentDrafts && currentDrafts.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {currentDrafts.length} draft{currentDrafts.length > 1 ? 's' : ''} for{' '}
                      {audience}
                    </span>
                  </div>
                  {currentDrafts.map((d: any) => (
                    <div
                      key={d.id}
                      className="bg-slate-50 dark:bg-[#0F172A] p-5 rounded-xl border border-slate-200 dark:border-[#334155]/60 space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#334155] pb-2">
                        <div>
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            Subject: {d.subject}
                          </p>
                          <span className="text-[10px] text-slate-400">
                            {d.type || 'Custom'} •{' '}
                            {d.createdAt
                              ? formatDistanceToNow(new Date(d.createdAt)) + ' ago'
                              : 'Recent'}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleCopyDraft(
                              d.id,
                              `${d.subject ? `Subject: ${d.subject}\n\n` : ''}${d.body}`,
                            )
                          }
                          className="h-7 text-xs text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 gap-1"
                        >
                          {copiedDraftId === d.id ? (
                            <>
                              <CheckCircle2 size={13} className="text-emerald-500" />
                              <span className="text-emerald-500">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={13} />
                              <span>Copy</span>
                            </>
                          )}
                        </Button>
                      </div>
                      <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
                        {d.body}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-slate-400">
                  <div className="w-12 h-12 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-500 flex items-center justify-center mx-auto mb-3">
                    <Send size={22} />
                  </div>
                  <h4 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
                    No Outreach Drafts Yet for {audience}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-5">
                    Click "Draft Outreach" to generate a personalized message targeting this role
                    and company.
                  </p>
                  <Button
                    onClick={handleGenerateOutreach}
                    className="bg-sky-600 hover:bg-sky-500 text-white text-xs h-9 px-4 gap-1.5 shadow-sm"
                  >
                    <Send size={14} />
                    <span>Draft Outreach</span>
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-slate-200 dark:border-[#334155] flex items-center justify-between bg-slate-50/50 dark:bg-[#0F172A]/50">
          <div className="text-xs text-slate-400">
            {app.updatedAt && (
              <span>Updated {formatDistanceToNow(new Date(app.updatedAt))} ago</span>
            )}
          </div>

          <Button
            variant="default"
            size="sm"
            onClick={onClose}
            className="text-xs h-9 px-4 font-medium"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
