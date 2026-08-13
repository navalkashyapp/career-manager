import React, { useEffect, useState } from 'react';
import { FileText, X, RefreshCw, Briefcase, FileCode2, BookOpen, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useCareerOps } from '../../../hooks/useCareerOps';
import { useData } from '../../../hooks/useData';
import type { JobApplication } from '../../../types';

interface TailorModalProps {
  app: JobApplication;
  onClose: () => void;
}

export const TailorModal: React.FC<TailorModalProps> = ({ app, onClose }) => {
  const { generateTailoredResume } = useCareerOps();
  const { profile } = useData();
  const [tailorData, setTailorData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState('Initializing...');
  const [loadingPercentage, setLoadingPercentage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchTailoredResume = async () => {
      if (!profile) return;
      setLoading(true);
      setError(null);
      try {
        const data = await generateTailoredResume(
          app.rawJobDescription || '',
          profile,
          (progress) => {
            if (mounted) {
              setLoadingPhase(progress.phase);
              setLoadingPercentage(progress.percentage);
            }
          }
        );
        if (mounted) setTailorData(data);
      } catch (err: any) {
        if (mounted) setError(err.message || 'Failed to tailor resume.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    
    fetchTailoredResume();
    return () => { mounted = false; };
  }, [app, generateTailoredResume, profile]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
      <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="p-6 border-b border-slate-200 dark:border-[#334155] flex items-center justify-between bg-indigo-50/50 dark:bg-indigo-900/10 rounded-t-2xl">
          <div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="text-indigo-500" size={20} />
              Tailored Resume: {app.companyName}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">AI-generated resume adjustments optimizing for exact keyword match and impact.</p>
          </div>
          <Button 
            variant="ghost"
            size="icon"
            onClick={onClose}
          >
            <X size={20} />
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-500 dark:text-slate-400 space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              <p className="text-lg font-medium">{loadingPhase}</p>
              <div className="w-64 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-400 transition-all duration-300 ease-out"
                  style={{ width: `${loadingPercentage}%` }}
                />
              </div>
            </div>
          ) : error ? (
            <div className="text-rose-400 text-center py-8 bg-rose-50 dark:bg-rose-900/10 rounded-xl">{error}</div>
          ) : tailorData ? (
            <div className="space-y-8">
              
              <section className="bg-white dark:bg-[#0F172A] p-6 rounded-xl border border-slate-200 dark:border-[#334155] shadow-sm">
                <h4 className="text-lg font-medium text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <BookOpen size={18} className="text-indigo-400" />
                  Tailored Professional Summary
                </h4>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm">
                  {tailorData.tailoredSummary}
                </p>
              </section>

              {tailorData.tailoredExperiences && tailorData.tailoredExperiences.length > 0 && (
                <section>
                  <h4 className="text-lg font-medium text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Briefcase size={18} className="text-sky-400" />
                    Tailored Experience Bullets
                  </h4>
                  <div className="space-y-4">
                    {tailorData.tailoredExperiences.map((exp: any, i: number) => (
                      <div key={i} className="bg-slate-50 dark:bg-[#0F172A]/50 border border-slate-200 dark:border-[#334155] p-5 rounded-xl">
                        <p className="font-semibold text-slate-800 dark:text-slate-200 mb-3 text-sm border-b border-slate-200 dark:border-[#334155] pb-2">
                          Experience ID: {exp.id}
                        </p>
                        <ul className="list-disc pl-5 space-y-2">
                          {exp.tailoredBullets?.map((bullet: string, j: number) => (
                            <li key={j} className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                              {bullet}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              
              {tailorData.tailoredProjects && tailorData.tailoredProjects.length > 0 && (
                <section>
                  <h4 className="text-lg font-medium text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <FileCode2 size={18} className="text-emerald-400" />
                    Tailored Project Highlights
                  </h4>
                  <div className="space-y-4">
                    {tailorData.tailoredProjects.map((proj: any, i: number) => (
                      <div key={i} className="bg-slate-50 dark:bg-[#0F172A]/50 border border-slate-200 dark:border-[#334155] p-5 rounded-xl">
                        <p className="font-semibold text-slate-800 dark:text-slate-200 mb-3 text-sm border-b border-slate-200 dark:border-[#334155] pb-2">
                          Project ID: {proj.id}
                        </p>
                        <div className="space-y-3">
                          <div>
                            <span className="text-xs font-medium text-emerald-500 uppercase tracking-wider">Impact</span>
                            <p className="text-sm text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">{proj.tailoredImpact}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-emerald-500 uppercase tracking-wider">Architecture</span>
                            <p className="text-sm text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">{proj.tailoredArchitecture}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {tailorData.coverLetterDraft && (
                 <section className="bg-indigo-50/50 dark:bg-indigo-900/10 p-6 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                  <h4 className="text-lg font-medium text-indigo-900 dark:text-indigo-200 mb-4 flex items-center gap-2">
                    <FileText size={18} className="text-indigo-400" />
                    Cover Letter Draft
                  </h4>
                  <div className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm whitespace-pre-wrap font-serif">
                    {tailorData.coverLetterDraft}
                  </div>
                </section>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
