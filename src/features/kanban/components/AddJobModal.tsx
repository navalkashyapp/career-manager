import React, { useState } from 'react';
import {
  X,
  Link as LinkIcon,
  Sparkles,
  Building2,
  Briefcase,
  MapPin,
  DollarSign,
  Layers,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileText,
  Loader2,
  ArrowRight,
  GraduationCap,
  Globe,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Badge } from '../../../components/ui/badge';
import { useCareerOps } from '../../../hooks/useCareerOps';
import { useKanban } from '../hooks/useKanban';
import type { JobApplication } from '../../../types';

interface AddJobModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface ExtractedJobData {
  pageType: 'single-posting' | 'listing-page' | 'unknown';
  detectedPostings?: { title: string; url?: string }[];
  companyName: string;
  companyDescription: string;
  roleTitle: string;
  jobTitle: string;
  roleDescription: string;
  jobSummary?: string;
  location: string;
  remotePolicy: 'remote' | 'hybrid' | 'on-site' | 'unknown';
  employmentType: string;
  targetLevel: string;
  experienceLevel?: string;
  salary: {
    raw: string;
    min?: number;
    max?: number;
    currency?: string;
    period?: 'year' | 'month' | 'hour' | 'unknown';
  };
  salaryRange: string;
  requirements: string[];
  keyRequirements: string[];
  niceToHaves: string[];
  qualifications: string[];
  fieldConfidence: Record<string, 'high' | 'medium' | 'low'>;
  warnings: string[];
  responsibilities?: string[];
  benefits?: string[];
  techStack?: string[];
  rawJobDescription: string;
  jobUrl: string;
  extractedMarkdown?: string;
}

export const AddJobModal: React.FC<AddJobModalProps> = ({ isOpen, onClose }) => {
  const { extractJobFromUrl } = useCareerOps();
  const { addApplication } = useKanban();

  const [mode, setMode] = useState<'url' | 'text'>('url');
  const [url, setUrl] = useState('');
  const [pastedText, setPastedText] = useState('');

  const [isExtracting, setIsExtracting] = useState(false);
  const [progressPhase, setProgressPhase] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Extracted preview state with full JobPostingMetadata mapping
  const [extractedData, setExtractedData] = useState<ExtractedJobData | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleExtract = async () => {
    setError(null);
    if (mode === 'url') {
      if (!url.trim()) {
        setError('Please enter or drop a valid job posting URL.');
        return;
      }
      try {
        new URL(url.trim());
      } catch {
        setError('Please enter a valid URL (including https://).');
        return;
      }
    } else {
      if (!pastedText.trim() || pastedText.trim().length < 40) {
        setError('Please paste the job description text (at least 40 characters).');
        return;
      }
    }

    setIsExtracting(true);
    setProgressPercent(15);
    setProgressPhase(
      mode === 'url' ? 'Connecting to job posting URL...' : 'Analyzing job description...',
    );

    try {
      const payload = mode === 'url' ? { url: url.trim() } : { jdText: pastedText.trim() };
      const data = await extractJobFromUrl(payload, (p) => {
        setProgressPhase(p.phase);
        setProgressPercent(p.percentage);
      });

      const roleTitle = data.roleTitle || data.jobTitle || '';
      const salaryRaw = data.salaryRange || data.salary?.raw || '';
      const reqs = data.keyRequirements || data.requirements || [];

      setExtractedData({
        pageType: data.pageType || 'single-posting',
        detectedPostings: data.detectedPostings || [],
        companyName: data.companyName || '',
        companyDescription: data.companyDescription || '',
        roleTitle: roleTitle,
        jobTitle: roleTitle,
        roleDescription: data.roleDescription || data.jobSummary || '',
        jobSummary: data.roleDescription || data.jobSummary || '',
        location: data.location || '',
        remotePolicy: data.remotePolicy || 'unknown',
        employmentType: data.employmentType || '',
        targetLevel: data.targetLevel || data.experienceLevel || '',
        experienceLevel: data.experienceLevel || data.targetLevel || '',
        salary: data.salary || { raw: salaryRaw },
        salaryRange: salaryRaw,
        requirements: reqs,
        keyRequirements: reqs,
        niceToHaves: data.niceToHaves || [],
        qualifications: data.qualifications || [],
        fieldConfidence: data.fieldConfidence || {},
        warnings: data.warnings || [],
        responsibilities: data.responsibilities || [],
        benefits: data.benefits || [],
        techStack: data.techStack || [],
        rawJobDescription: data.rawJobDescription || pastedText || '',
        jobUrl: data.jobUrl || url || '',
        extractedMarkdown: data.extractedMarkdown,
      });
    } catch (err: any) {
      console.error('Failed to extract job details:', err);
      setError(
        err.message ||
          'Failed to extract job details. You can switch to "Paste Text" if the site blocks scraping.',
      );
    } finally {
      setIsExtracting(false);
      setProgressPhase('');
      setProgressPercent(0);
    }
  };

  const removeItem = (
    field: 'keyRequirements' | 'niceToHaves' | 'qualifications',
    index: number,
  ) => {
    if (!extractedData) return;
    const updated = [...(extractedData[field] || [])];
    updated.splice(index, 1);
    setExtractedData({
      ...extractedData,
      [field]: updated,
      ...(field === 'keyRequirements' ? { requirements: updated } : {}),
    });
  };

  const renderConfidenceBadge = (fieldName: string) => {
    const conf = extractedData?.fieldConfidence?.[fieldName];
    if (!conf) return null;
    const styles = {
      high: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
      low: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
    };
    return (
      <span
        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wider ${styles[conf] || ''}`}
      >
        {conf} conf
      </span>
    );
  };

  const handleSaveToTargeting = async () => {
    if (!extractedData) return;
    setIsSaving(true);
    try {
      const markdownOverview =
        extractedData.extractedMarkdown ||
        [
          `## ${extractedData.jobTitle || extractedData.roleTitle || 'Role'} @ ${extractedData.companyName || 'Company'}\n`,
          [
            extractedData.location ? `**Location:** ${extractedData.location}` : '',
            extractedData.targetLevel ? `**Level:** ${extractedData.targetLevel}` : '',
            extractedData.salaryRange ? `**Compensation:** ${extractedData.salaryRange}` : '',
            extractedData.remotePolicy && extractedData.remotePolicy !== 'unknown'
              ? `**Remote Policy:** ${extractedData.remotePolicy}`
              : '',
            extractedData.employmentType ? `**Type:** ${extractedData.employmentType}` : '',
          ]
            .filter(Boolean)
            .join('  •  ') + '\n',
          extractedData.jobUrl ? `🔗 [View Original Job Posting](${extractedData.jobUrl})\n` : '',
          '---\n',
          extractedData.companyDescription
            ? `### 🏢 About ${extractedData.companyName || 'the Company'}\n${extractedData.companyDescription}\n`
            : '',
          extractedData.roleDescription || extractedData.jobSummary
            ? `### 📋 Role Overview\n${extractedData.roleDescription || extractedData.jobSummary}\n`
            : '',
          extractedData.qualifications?.length
            ? `### 🎓 Qualifications\n${extractedData.qualifications.map((q: string) => `- ${q}`).join('\n')}\n`
            : '',
          extractedData.keyRequirements?.length
            ? `### 🎯 Key Requirements\n${extractedData.keyRequirements.map((r: string) => `- ${r}`).join('\n')}\n`
            : '',
          extractedData.niceToHaves?.length
            ? `### 🌟 Nice To Haves\n${extractedData.niceToHaves.map((r: string) => `- ${r}`).join('\n')}\n`
            : '',
          extractedData.responsibilities?.length
            ? `### 💼 Core Responsibilities\n${extractedData.responsibilities.map((r: string) => `- ${r}`).join('\n')}\n`
            : '',
          extractedData.techStack?.length
            ? `### 🛠️ Tech Stack & Key Skills\n${extractedData.techStack.map((s: string) => `- \`${s}\``).join('\n')}\n`
            : '',
          extractedData.benefits?.length
            ? `### 🎁 Benefits\n${extractedData.benefits.map((r: string) => `- ${r}`).join('\n')}\n`
            : '',
        ]
          .filter(Boolean)
          .join('\n');

      const newApp: JobApplication = {
        id: Date.now().toString(),
        jobTitle:
          extractedData.jobTitle.trim() || extractedData.roleTitle.trim() || 'Untitled Role',
        companyName: extractedData.companyName.trim() || 'Unknown Company',
        location: extractedData.location.trim(),
        salaryRange: extractedData.salaryRange.trim(),
        targetLevel: extractedData.targetLevel.trim(),
        jobUrl: extractedData.jobUrl.trim(),
        rawJobDescription: extractedData.rawJobDescription.trim(),
        cleanedJdJson: {
          ...extractedData,
          pageType: extractedData.pageType,
          companyName: extractedData.companyName,
          companyDescription: extractedData.companyDescription,
          roleTitle: extractedData.roleTitle || extractedData.jobTitle,
          jobTitle: extractedData.jobTitle,
          roleDescription: extractedData.roleDescription || extractedData.jobSummary,
          jobSummary: extractedData.roleDescription || extractedData.jobSummary,
          location: extractedData.location,
          remotePolicy: extractedData.remotePolicy,
          employmentType: extractedData.employmentType,
          salary: extractedData.salary,
          salaryRange: extractedData.salaryRange,
          requirements: extractedData.keyRequirements,
          keyRequirements: extractedData.keyRequirements,
          niceToHaves: extractedData.niceToHaves,
          qualifications: extractedData.qualifications,
          fieldConfidence: extractedData.fieldConfidence,
          warnings: extractedData.warnings,
        },
        extractedMarkdown: markdownOverview,
        matchScore: 0, // Unscored / pending evaluation
        stage: 'Targeting',
        notes: [
          extractedData.roleDescription || extractedData.jobSummary
            ? `Executive Summary:\n${extractedData.roleDescription || extractedData.jobSummary}`
            : '',
          extractedData.companyDescription
            ? `Company Background:\n${extractedData.companyDescription}`
            : '',
          extractedData.keyRequirements?.length
            ? `Key Requirements:\n${extractedData.keyRequirements.map((r) => `• ${r}`).join('\n')}`
            : '',
          extractedData.qualifications?.length
            ? `Qualifications:\n${extractedData.qualifications.map((q) => `• ${q}`).join('\n')}`
            : '',
          extractedData.niceToHaves?.length
            ? `Nice to Haves:\n${extractedData.niceToHaves.map((n) => `• ${n}`).join('\n')}`
            : '',
          extractedData.warnings?.length
            ? `Extraction Notes & Warnings:\n${extractedData.warnings.map((w) => `⚠️ ${w}`).join('\n')}`
            : '',
        ]
          .filter(Boolean)
          .join('\n\n'),
        contacts: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await addApplication(newApp);
      handleClose();
    } catch (err: any) {
      console.error('Failed to add job application:', err);
      setError(err.message || 'Failed to save application to Targeting lane.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setUrl('');
    setPastedText('');
    setExtractedData(null);
    setError(null);
    setIsExtracting(false);
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4">
      <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-[#334155] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 dark:text-indigo-400">
              <Briefcase size={20} />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Add a Job</h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                Drop a job URL to extract full role and company parameters with Antigravity
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <X size={20} />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="flex items-start space-x-3 p-3.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-400 text-sm">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-medium">Extraction error: </span>
                {error}
              </div>
            </div>
          )}

          {!extractedData ? (
            <>
              {/* Tabs */}
              <div className="flex bg-slate-100 dark:bg-[#0F172A] p-1 rounded-xl border border-slate-200 dark:border-[#334155]/60 max-w-xs">
                <button
                  type="button"
                  onClick={() => {
                    setMode('url');
                    setError(null);
                  }}
                  className={`flex-1 flex items-center justify-center space-x-2 py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${
                    mode === 'url'
                      ? 'bg-white dark:bg-[#1E293B] text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <LinkIcon size={14} />
                  <span>Job URL</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('text');
                    setError(null);
                  }}
                  className={`flex-1 flex items-center justify-center space-x-2 py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${
                    mode === 'text'
                      ? 'bg-white dark:bg-[#1E293B] text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <FileText size={14} />
                  <span>Paste Text</span>
                </button>
              </div>

              {mode === 'url' ? (
                <div className="space-y-3">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Job Posting URL
                  </label>
                  <div className="relative">
                    <LinkIcon
                      size={18}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <Input
                      type="url"
                      placeholder="https://boards.greenhouse.io/company/jobs/... or LinkedIn / Lever / Ashby URL"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isExtracting) handleExtract();
                      }}
                      disabled={isExtracting}
                      className="pl-10 h-11 text-sm bg-slate-50 dark:bg-[#0F172A] border-slate-200 dark:border-[#334155]"
                    />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Drop or paste any public job posting link. The agent will fetch the page and
                    extract key role metadata.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Raw Job Description Text
                  </label>
                  <Textarea
                    placeholder="Paste the job description text here..."
                    rows={8}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    disabled={isExtracting}
                    className="text-sm bg-slate-50 dark:bg-[#0F172A] border-slate-200 dark:border-[#334155]"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Use this if the job is behind an internal corporate intranet or login wall.
                  </p>
                </div>
              )}

              {/* Progress Indicator */}
              {isExtracting && (
                <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-500/20 rounded-xl space-y-3 animate-pulse">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" />
                      {progressPhase || 'Extracting job profile...'}
                    </span>
                    <span className="text-indigo-500 font-semibold">{progressPercent}%</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 dark:bg-indigo-500 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Extracted Preview Mode */
            <div className="space-y-6">
              {/* Extraction Status & Badges */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl text-emerald-700 dark:text-emerald-400 text-xs">
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 size={16} /> Details extracted by Career Agent
                </span>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-[11px] font-normal"
                  >
                    {extractedData.pageType === 'listing-page'
                      ? 'Listing Page'
                      : extractedData.pageType === 'single-posting'
                        ? 'Single Job Posting'
                        : 'Posting Page'}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-indigo-500/40 text-indigo-600 dark:text-indigo-400 text-[11px] font-normal"
                  >
                    Targeting Lane
                  </Badge>
                </div>
              </div>

              {/* Listing Page Alert (pageType === 'listing-page') */}
              {extractedData.pageType === 'listing-page' && (
                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/30 rounded-xl space-y-2 text-xs text-amber-800 dark:text-amber-300">
                  <div className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-400">
                    <AlertTriangle size={16} />
                    <span>Listing Page Detected</span>
                  </div>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300/90 leading-relaxed">
                    This URL appears to be a jobs directory or multi-role listing page rather than
                    an individual posting.
                  </p>
                  {extractedData.detectedPostings && extractedData.detectedPostings.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      <span className="text-[11px] font-medium text-amber-800 dark:text-amber-200">
                        Detected Postings on this page ({extractedData.detectedPostings.length}):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {extractedData.detectedPostings.map((p, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() =>
                              setExtractedData({
                                ...extractedData,
                                jobTitle: p.title,
                                roleTitle: p.title,
                                jobUrl: p.url || extractedData.jobUrl,
                              })
                            }
                            className="text-[11px] px-2.5 py-1 rounded-md bg-amber-100/80 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-800/60 text-amber-900 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700 flex items-center gap-1.5 transition-all"
                          >
                            <span>{p.title}</span>
                            <ArrowRight size={10} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Extraction Warnings Banner (warnings) */}
              {extractedData.warnings && extractedData.warnings.length > 0 && (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs space-y-1.5 text-amber-700 dark:text-amber-300">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle size={15} className="text-amber-500 shrink-0" />
                    <span>Extraction Warnings ({extractedData.warnings.length})</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-amber-800 dark:text-amber-300/90 leading-relaxed">
                    {extractedData.warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Primary Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* companyName & confidence */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                      <Building2 size={14} className="text-slate-400" /> Company Name
                    </label>
                    {renderConfidenceBadge('companyName')}
                  </div>
                  <Input
                    value={extractedData.companyName}
                    placeholder="e.g. Acme Corp"
                    onChange={(e) =>
                      setExtractedData({ ...extractedData, companyName: e.target.value })
                    }
                    className="h-9 text-sm bg-slate-50 dark:bg-[#0F172A]"
                  />
                </div>

                {/* roleTitle & confidence */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                      <Briefcase size={14} className="text-slate-400" /> Role / Job Title
                    </label>
                    {renderConfidenceBadge('roleTitle')}
                  </div>
                  <Input
                    value={extractedData.jobTitle}
                    placeholder="e.g. Senior Software Engineer"
                    onChange={(e) =>
                      setExtractedData({
                        ...extractedData,
                        jobTitle: e.target.value,
                        roleTitle: e.target.value,
                      })
                    }
                    className="h-9 text-sm bg-slate-50 dark:bg-[#0F172A]"
                  />
                </div>

                {/* location & confidence */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                      <MapPin size={14} className="text-slate-400" /> Location
                    </label>
                    {renderConfidenceBadge('location')}
                  </div>
                  <Input
                    value={extractedData.location}
                    placeholder="e.g. San Francisco, CA / Remote"
                    onChange={(e) =>
                      setExtractedData({ ...extractedData, location: e.target.value })
                    }
                    className="h-9 text-sm bg-slate-50 dark:bg-[#0F172A]"
                  />
                </div>

                {/* salary & confidence */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                      <DollarSign size={14} className="text-slate-400" /> Salary / Compensation
                    </label>
                    {renderConfidenceBadge('salary')}
                  </div>
                  <Input
                    value={extractedData.salaryRange}
                    placeholder="e.g. $180k - $220k"
                    onChange={(e) =>
                      setExtractedData({
                        ...extractedData,
                        salaryRange: e.target.value,
                        salary: { ...extractedData.salary, raw: e.target.value },
                      })
                    }
                    className="h-9 text-sm bg-slate-50 dark:bg-[#0F172A]"
                  />
                  {(extractedData.salary?.currency || extractedData.salary?.period) && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Parsed: {extractedData.salary.currency || 'USD'}{' '}
                      {extractedData.salary.min
                        ? `$${extractedData.salary.min.toLocaleString()}`
                        : ''}
                      {extractedData.salary.max
                        ? ` - $${extractedData.salary.max.toLocaleString()}`
                        : ''}{' '}
                      {extractedData.salary.period ? `per ${extractedData.salary.period}` : ''}
                    </p>
                  )}
                </div>

                {/* remotePolicy */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Globe size={14} className="text-slate-400" /> Remote Policy
                  </label>
                  <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-[#0F172A] rounded-lg border border-slate-200 dark:border-[#334155]">
                    {(['remote', 'hybrid', 'on-site', 'unknown'] as const).map((policy) => (
                      <button
                        key={policy}
                        type="button"
                        onClick={() => setExtractedData({ ...extractedData, remotePolicy: policy })}
                        className={`py-1 text-xs rounded font-medium capitalize transition-all ${
                          extractedData.remotePolicy === policy
                            ? 'bg-white dark:bg-[#1E293B] text-indigo-600 dark:text-indigo-400 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        {policy}
                      </button>
                    ))}
                  </div>
                </div>

                {/* employmentType */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Briefcase size={14} className="text-slate-400" /> Employment Type
                  </label>
                  <Input
                    value={extractedData.employmentType}
                    placeholder="e.g. Full-time, Contract, Part-time"
                    onChange={(e) =>
                      setExtractedData({ ...extractedData, employmentType: e.target.value })
                    }
                    className="h-9 text-sm bg-slate-50 dark:bg-[#0F172A]"
                  />
                </div>

                {/* targetLevel */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Layers size={14} className="text-slate-400" /> Seniority / Target Level
                  </label>
                  <Input
                    value={extractedData.targetLevel}
                    placeholder="e.g. Staff TPM / Senior / Lead"
                    onChange={(e) =>
                      setExtractedData({
                        ...extractedData,
                        targetLevel: e.target.value,
                        experienceLevel: e.target.value,
                      })
                    }
                    className="h-9 text-sm bg-slate-50 dark:bg-[#0F172A]"
                  />
                </div>
              </div>

              {/* roleDescription */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <FileText size={14} className="text-slate-400" /> Role Description & Overview
                  </label>
                  <span className="text-[11px] text-slate-400">Summarized role summary</span>
                </div>
                <Textarea
                  value={extractedData.roleDescription}
                  rows={3}
                  placeholder="Extracted role description and mission overview..."
                  onChange={(e) =>
                    setExtractedData({
                      ...extractedData,
                      roleDescription: e.target.value,
                      jobSummary: e.target.value,
                    })
                  }
                  className="text-xs bg-slate-50 dark:bg-[#0F172A] border-slate-200 dark:border-[#334155] leading-relaxed"
                />
              </div>

              {/* companyDescription */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Building2 size={14} className="text-slate-400" /> Company Description
                  </label>
                  <span className="text-[11px] text-slate-400">Company mission & background</span>
                </div>
                <Textarea
                  value={extractedData.companyDescription}
                  rows={2}
                  placeholder="Company background, domain, and overview..."
                  onChange={(e) =>
                    setExtractedData({ ...extractedData, companyDescription: e.target.value })
                  }
                  className="text-xs bg-slate-50 dark:bg-[#0F172A] border-slate-200 dark:border-[#334155] leading-relaxed"
                />
              </div>

              {/* requirements (keyRequirements) & confidence */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    <span>Key Requirements</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {extractedData.keyRequirements.length}
                    </Badge>
                  </label>
                  {renderConfidenceBadge('requirements')}
                </div>
                {extractedData.keyRequirements.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2.5 bg-slate-50 dark:bg-[#0F172A] rounded-xl border border-slate-200 dark:border-[#334155]/60">
                    {extractedData.keyRequirements.map((req, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 text-[11px] bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] px-2.5 py-1 rounded-md text-slate-700 dark:text-slate-300 shadow-xs"
                      >
                        <span>{req}</span>
                        <button
                          type="button"
                          onClick={() => removeItem('keyRequirements', idx)}
                          className="text-slate-400 hover:text-rose-500"
                          title="Remove requirement"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    No specific requirements extracted.
                  </p>
                )}
              </div>

              {/* qualifications */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <GraduationCap size={14} className="text-sky-500" />
                    <span>Qualifications</span>
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-300"
                    >
                      {extractedData.qualifications.length}
                    </Badge>
                  </label>
                </div>
                {extractedData.qualifications.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2.5 bg-slate-50 dark:bg-[#0F172A] rounded-xl border border-slate-200 dark:border-[#334155]/60">
                    {extractedData.qualifications.map((item, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 text-[11px] bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200/60 dark:border-sky-800/40 px-2.5 py-1 rounded-md text-sky-700 dark:text-sky-300 shadow-xs"
                      >
                        <span>{item}</span>
                        <button
                          type="button"
                          onClick={() => removeItem('qualifications', idx)}
                          className="text-sky-400 hover:text-rose-500"
                          title="Remove qualification"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    No formal qualifications separated.
                  </p>
                )}
              </div>

              {/* niceToHaves */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-purple-500" />
                    <span>Nice-To-Haves / Bonus</span>
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300"
                    >
                      {extractedData.niceToHaves.length}
                    </Badge>
                  </label>
                </div>
                {extractedData.niceToHaves.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2.5 bg-slate-50 dark:bg-[#0F172A] rounded-xl border border-slate-200 dark:border-[#334155]/60">
                    {extractedData.niceToHaves.map((item, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 text-[11px] bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40 px-2.5 py-1 rounded-md text-purple-700 dark:text-purple-300 shadow-xs"
                      >
                        <span>{item}</span>
                        <button
                          type="button"
                          onClick={() => removeItem('niceToHaves', idx)}
                          className="text-purple-400 hover:text-rose-500"
                          title="Remove nice-to-have"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No nice-to-haves identified.</p>
                )}
              </div>

              {/* Raw JD character footer info */}
              <div className="p-3 bg-slate-100/70 dark:bg-slate-800/40 rounded-xl text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>
                  Raw Job Description:{' '}
                  <strong>{extractedData.rawJobDescription.length.toLocaleString()}</strong>{' '}
                  characters
                </span>
                <span className="text-slate-400">Evaluation: Pending</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 dark:border-[#334155] flex items-center justify-between bg-slate-50/50 dark:bg-[#0F172A]/50">
          {!extractedData ? (
            <>
              <Button
                variant="ghost"
                onClick={handleClose}
                disabled={isExtracting}
                className="text-slate-600 dark:text-slate-400"
              >
                Cancel
              </Button>
              <Button
                onClick={handleExtract}
                disabled={isExtracting || (mode === 'url' ? !url.trim() : !pastedText.trim())}
                className="bg-indigo-600 hover:bg-indigo-500 text-white flex items-center space-x-2"
              >
                {isExtracting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Extracting...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Extract with Career Agent</span>
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setExtractedData(null)}
                disabled={isSaving}
                className="text-slate-600 dark:text-slate-300"
              >
                Re-extract
              </Button>
              <Button
                onClick={handleSaveToTargeting}
                disabled={isSaving}
                className="bg-indigo-600 hover:bg-indigo-500 text-white flex items-center space-x-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Adding to Targeting...</span>
                  </>
                ) : (
                  <>
                    <span>Add to Targeting Lane</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
