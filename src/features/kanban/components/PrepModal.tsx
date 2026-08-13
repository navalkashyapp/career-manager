import React, { useEffect, useState } from 'react';
import { Sparkles, X, RefreshCw, BrainCircuit, MessageSquare } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useKanban } from '../hooks/useKanban';
import type { JobApplication } from '../../../types';

interface PrepModalProps {
  app: JobApplication;
  onClose: () => void;
}

export const PrepModal: React.FC<PrepModalProps> = ({ app, onClose }) => {
  const { generatePrep } = useKanban();
  const [prepData, setPrepData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchPrep = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await generatePrep({
          jdText: app.rawJobDescription,
          companyName: app.companyName
        });
        if (mounted) setPrepData(data);
      } catch (err: any) {
        if (mounted) setError(err.message || 'Failed to generate prep material.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    
    fetchPrep();
    return () => { mounted = false; };
  }, [app, generatePrep]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
      <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="p-6 border-b border-slate-200 dark:border-[#334155] flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="text-fuchsia-400" size={20} />
              Interview Prep: {app.companyName}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">AI-generated questions based on JD and domain</p>
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
            <div className="h-full flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 py-12">
              <RefreshCw size={32} className="animate-spin text-fuchsia-500 mb-4" />
              <p>Analyzing job description and generating questions...</p>
            </div>
          ) : error ? (
            <div className="text-rose-400 text-center py-8">{error}</div>
          ) : prepData ? (
            <div className="space-y-8">
              {prepData.systemDesignQuestions && prepData.systemDesignQuestions.length > 0 && (
                <section>
                  <h4 className="text-lg font-medium text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <BrainCircuit size={18} className="text-indigo-400" />
                    System Design & Technical
                  </h4>
                  <div className="space-y-4">
                    {prepData.systemDesignQuestions.map((q: any, i: number) => (
                      <div key={i} className="bg-slate-100/50 dark:bg-[#0F172A]/50 border border-slate-200 dark:border-[#334155] p-4 rounded-xl">
                        <p className="font-medium text-slate-900 dark:text-white mb-3">{q.question}</p>
                        <div className="flex flex-wrap gap-2">
                          {q.focusAreas?.map((area: string, j: number) => (
                            <span key={j} className="text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-1 rounded">
                              {area}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              
              {prepData.behavioralPrompts && prepData.behavioralPrompts.length > 0 && (
                <section>
                  <h4 className="text-lg font-medium text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <MessageSquare size={18} className="text-fuchsia-400" />
                    Behavioral & Leadership
                  </h4>
                  <div className="space-y-4">
                    {prepData.behavioralPrompts.map((b: any, i: number) => (
                      <div key={i} className="bg-slate-100/50 dark:bg-[#0F172A]/50 border border-slate-200 dark:border-[#334155] p-4 rounded-xl">
                        <p className="font-medium text-slate-900 dark:text-white mb-2">{b.prompt}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          <span className="text-slate-600 dark:text-slate-300 font-medium">Why they ask this: </span>
                          {b.whyTheyAskThis}
                        </p>
                      </div>
                    ))}
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
