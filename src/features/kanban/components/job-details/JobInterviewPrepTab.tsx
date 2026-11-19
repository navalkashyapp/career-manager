import React, { useState, useEffect } from 'react';
import { BrainCircuit, Activity, RefreshCw } from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { prepInterview } from '../../api/prepInterview';
import type { JobApplication } from '../../../../types';

interface JobInterviewPrepTabProps {
  app: JobApplication;
  onUpdate: (updates: Partial<JobApplication>) => Promise<void>;
}

export const JobInterviewPrepTab: React.FC<JobInterviewPrepTabProps> = ({ app, onUpdate }) => {
  const [prepData, setPrepData] = useState<any>(app.interviewPrep || null);
  const [prepLoading, setPrepLoading] = useState(false);
  const [prepError, setPrepError] = useState<string | null>(null);

  useEffect(() => {
    if (app.interviewPrep) {
      setPrepData(app.interviewPrep);
    }
  }, [app]);

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

      await onUpdate({
        interviewPrep: prepPayload,
      });
    } catch (err: any) {
      setPrepError(err.message || 'Failed to generate interview prep.');
    } finally {
      setPrepLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Section Header with Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-fuchsia-50/50 dark:bg-fuchsia-950/20 border border-fuchsia-100 dark:border-fuchsia-900/30 rounded-xl">
        <div>
          <h4 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <BrainCircuit className="text-fuchsia-500" size={17} />
            Interview Preparation & Questions
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Predict technical loop questions, architecture challenges, and behavioral prompts.
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
  );
};
