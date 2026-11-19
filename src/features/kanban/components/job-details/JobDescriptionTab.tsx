import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { FileText, Sparkles, Copy, Check, Loader2 } from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { useCareerOps } from '../../../../hooks/useCareerOps';
import { cn } from '../../../../lib/utils';
import type { JobApplication } from '../../../../types';

interface JobDescriptionTabProps {
  app: JobApplication;
  onUpdate: (updates: Partial<JobApplication>) => Promise<void>;
}

export function formatExtractedMarkdown(app: JobApplication): string {
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

  const title = app.jobTitle || cleaned?.jobTitle || 'Target Role';
  const company = app.companyName || cleaned?.companyName || 'Target Company';
  sections.push(`## ${title} @ ${company}\n`);

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

  const summary = cleaned?.jobSummary || cleaned?.roleSummary;
  if (summary) {
    sections.push(`### 📋 Role Overview\n${summary}\n`);
  }

  const reqs = cleaned?.keyRequirements || cleaned?.requirements;
  if (Array.isArray(reqs) && reqs.length > 0) {
    sections.push(`### 🎯 Key Requirements & Qualifications\n`);
    reqs.forEach((r: string) => sections.push(`- ${r}`));
    sections.push('');
  }

  const responsibilities = cleaned?.responsibilities || cleaned?.coreResponsibilities;
  if (Array.isArray(responsibilities) && responsibilities.length > 0) {
    sections.push(`### 💼 Core Responsibilities\n`);
    responsibilities.forEach((r: string) => sections.push(`- ${r}`));
    sections.push('');
  }

  const stack = cleaned?.techStack || cleaned?.preferredSkills;
  if (Array.isArray(stack) && stack.length > 0) {
    sections.push(`### 🛠️ Tech Stack & Key Skills\n`);
    stack.forEach((s: string) => sections.push(`- \`${s}\``));
    sections.push('');
  }

  if (sections.length <= 4 && app.notes) {
    const formattedNotes = app.notes
      .replace(/^Executive Summary:/im, '### 📋 Executive Summary\n')
      .replace(/^Key Requirements:/im, '### 🎯 Key Requirements\n')
      .replace(/^• /gm, '- ');
    sections.push(formattedNotes);
  }

  if (sections.length <= 4 && app.rawJobDescription) {
    sections.push(`### 📄 Job Description\n${app.rawJobDescription}`);
  }

  return sections.join('\n');
}

export const JobDescriptionTab: React.FC<JobDescriptionTabProps> = ({ app, onUpdate }) => {
  const { extractJobFromUrl } = useCareerOps();
  const [jdViewMode, setJdViewMode] = useState<'extracted' | 'raw'>('extracted');
  const [copiedJd, setCopiedJd] = useState(false);
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
    if (!app.rawJobDescription && !app.jobUrl) return;
    setIsExtractingJd(true);
    setExtractJdError(null);
    setExtractJdPhase('Analyzing job description with Antigravity...');
    setExtractJdPercentage(20);
    try {
      const isSavedTextBlocked =
        app.rawJobDescription &&
        /you have been blocked|sorry, you have been blocked|cloudflare ray id/i.test(
          app.rawJobDescription,
        );

      const payload =
        isSavedTextBlocked && app.jobUrl
          ? { url: app.jobUrl }
          : app.jobUrl && !app.rawJobDescription
            ? { url: app.jobUrl }
            : { jdText: app.rawJobDescription, url: app.jobUrl };

      const data = await extractJobFromUrl(payload, (p) => {
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

      await onUpdate({
        cleanedJdJson: data,
        extractedMarkdown: generatedMarkdown,
        ...(data.rawJobDescription ? { rawJobDescription: data.rawJobDescription } : {}),
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

  return (
    <div className="space-y-4">
      {/* Section Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-sky-50/50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/30 rounded-xl">
        <div>
          <h4 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="text-sky-500" size={17} />
            <span>Role Breakdown & Extracted Intelligence</span>
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Structured markdown overview of role qualifications, responsibilities, and tech stack.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex bg-slate-200 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setJdViewMode('extracted')}
              className={cn(
                'px-2.5 py-1 rounded-md font-medium transition-all text-xs cursor-pointer',
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
                'px-2.5 py-1 rounded-md font-medium transition-all text-xs cursor-pointer',
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
              {copiedJd ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              <span>
                {copiedJd ? 'Copied' : jdViewMode === 'extracted' ? 'Copy Markdown' : 'Copy Raw'}
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
                    <strong className="font-semibold text-slate-900 dark:text-white" {...props} />
                  ),
                  code: ({ node, inline, ...props }: any) => (
                    <code
                      className="text-[11px] sm:text-xs bg-slate-200 dark:bg-slate-800 text-sky-600 dark:text-sky-300 px-1.5 py-0.5 rounded font-mono"
                      {...props}
                    />
                  ),
                  hr: ({ node, ...props }) => (
                    <hr className="my-4 border-slate-200 dark:border-slate-800" {...props} />
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
  );
};
