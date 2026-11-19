import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  FileText,
  RefreshCw,
  Loader2,
  BookOpen,
  Briefcase,
  Plus,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { Textarea } from '../../../../components/ui/textarea';
import { useCareerOps } from '../../../../hooks/useCareerOps';
import type { JobApplication, UserProfile } from '../../../../types';

interface JobResumeTabProps {
  app: JobApplication;
  profile: UserProfile;
  onUpdate: (updates: Partial<JobApplication>) => Promise<void>;
}

export const JobResumeTab: React.FC<JobResumeTabProps> = ({ app, profile, onUpdate }) => {
  const { generateTailoredResume } = useCareerOps();

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
  const [copiedCoverLetter, setCopiedCoverLetter] = useState(false);

  useEffect(() => {
    if (app.tailoredResumePackage) {
      setTailorData(app.tailoredResumePackage);
    } else if (app.tailoredResumes && app.tailoredResumes.length > 0) {
      setTailorData({ coverLetterDraft: app.tailoredResumes[0].markdown });
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
        profile?.phone,
        profile?.email,
        profile?.linkedinUrl ? profile?.linkedinUrl.replace(/^https?:\/\/(www\.)?/, '') : null,
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
            ? Object.values(profile?.coreSkills).flat().filter(Boolean)
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

      await onUpdate({
        tailoredResumePackage: tailoredPkg,
        tailoredResumes: updatedTailored,
      });
    } catch (err: any) {
      setTailorError(err.message || 'Failed to tailor resume.');
    } finally {
      setTailorLoading(false);
    }
  };

  const handleAddBullet = async (expIndex: number) => {
    if (!tailorData?.tailoredExperiences) return;
    const newExperiences = tailorData.tailoredExperiences.map((exp: any, idx: number) => {
      if (idx !== expIndex) return exp;
      const currentBullets = Array.isArray(exp.tailoredBullets) ? exp.tailoredBullets : [];
      return {
        ...exp,
        tailoredBullets: [...currentBullets, 'New bullet point'],
      };
    });

    const newData = {
      ...tailorData,
      tailoredExperiences: newExperiences,
    };

    setTailorData(newData);
    try {
      await onUpdate({
        tailoredResumePackage: newData,
      });
    } catch (err) {
      console.error('Failed to save added bullet to Firestore:', err);
    }
  };

  return (
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
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{tailorPhase}</p>
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
                    const newData = {
                      ...tailorData,
                      tailoredSummary: newVal,
                      summary: newVal,
                    };
                    setTailorData(newData);
                    onUpdate({ tailoredResumePackage: newData }).catch(console.error);
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
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        Tailored Bullets
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddBullet(i)}
                        className="h-6 px-2 text-xs text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 flex items-center gap-1 rounded"
                        title="Add bullet item"
                      >
                        <Plus size={13} />
                        <span>Add bullet</span>
                      </Button>
                    </div>
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
                                onUpdate({ tailoredResumePackage: newData }).catch(console.error);
                              }
                            }}
                            className="w-full text-xs sm:text-sm min-h-[40px] p-1 bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-indigo-500 rounded-md transition-colors resize-none overflow-hidden"
                            placeholder="Enter bullet point..."
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
                    setCopiedCoverLetter(true);
                    setTimeout(() => setCopiedCoverLetter(false), 2000);
                  }}
                  className="h-7 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 gap-1"
                >
                  {copiedCoverLetter ? (
                    <Check size={13} className="text-emerald-500" />
                  ) : (
                    <Copy size={13} />
                  )}
                  <span>{copiedCoverLetter ? 'Copied' : 'Copy'}</span>
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
            Generate customized bullet points, tailored professional summaries, and role-specific
            cover letter drafts.
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
  );
};
