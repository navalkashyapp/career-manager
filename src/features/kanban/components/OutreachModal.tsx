import React, { useState, useEffect } from 'react';
import { Send, X, RefreshCw, Copy, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useCareerOps } from '../../../hooks/useCareerOps';
import { useData } from '../../../hooks/useData';
import type { JobApplication } from '../../../types';

interface OutreachModalProps {
  app: JobApplication;
  onClose: () => void;
}

const TONES = ['Professional', 'Casual', 'Direct'];
const AUDIENCES = ['Recruiter', 'Friend', 'Hiring Manager'];

export const OutreachModal: React.FC<OutreachModalProps> = ({ app, onClose }) => {
  const { draftOutreach } = useCareerOps();
  const { profile } = useData();

  const [tone, setTone] = useState('Professional');
  const [audience, setAudience] = useState('Recruiter');
  const [drafts, setDrafts] = useState<any[]>(app.outreachDrafts || []);
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState('Initializing...');
  const [loadingPercentage, setLoadingPercentage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    setCopiedId(null);
    try {
      const data = (await draftOutreach(
        app.rawJobDescription || '',
        profile,
        `${tone} Outreach to ${audience}`,
        (progress) => {
          setLoadingPhase(progress.phase);
          setLoadingPercentage(progress.percentage);
        },
      )) as { subject: string; body: string };

      const newDraft = {
        id: Date.now().toString(),
        type: `Custom (${tone} to ${audience})`,
        subject: data.subject,
        body: data.body,
        createdAt: Date.now(),
      };
      setDrafts((prev) => [newDraft, ...prev]);
    } catch (err: any) {
      setError(err.message || 'Failed to generate outreach draft.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
      <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="p-6 border-b border-slate-200 dark:border-[#334155] flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Send className="text-sky-400" size={20} />
              Cold Outreach: {app.companyName}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Generate highly personalized networking messages using Gemini AI.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 w-20">
                Target:
              </span>
              <div className="flex gap-2">
                {AUDIENCES.map((a) => (
                  <Button
                    key={a}
                    variant={audience === a ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAudience(a)}
                    className={audience === a ? 'bg-sky-500 hover:bg-sky-600' : ''}
                  >
                    {a}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 w-20">
                Tone:
              </span>
              <div className="flex gap-2">
                {TONES.map((t) => (
                  <Button
                    key={t}
                    variant={tone === t ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTone(t)}
                    className={tone === t ? 'bg-sky-500 hover:bg-sky-600' : ''}
                  >
                    {t}
                  </Button>
                ))}
              </div>
              <Button
                onClick={handleGenerate}
                disabled={loading}
                className="ml-auto bg-sky-500 hover:bg-sky-600 text-white"
              >
                {loading ? (
                  <RefreshCw size={16} className="animate-spin mr-2" />
                ) : (
                  <Send size={16} className="mr-2" />
                )}
                Generate Draft
              </Button>
            </div>
          </div>

          {error && !loading && (
            <div className="text-rose-400 text-center py-4 bg-rose-50 dark:bg-rose-900/10 rounded-xl">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center p-12 text-slate-500 dark:text-slate-400 space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
              <p className="text-lg font-medium">{loadingPhase}</p>
              <div className="w-64 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-400 transition-all duration-300 ease-out"
                  style={{ width: `${loadingPercentage}%` }}
                />
              </div>
            </div>
          )}

          {drafts.length > 0 && !loading && (
            <div className="space-y-4">
              {drafts.map((d) => (
                <div
                  key={d.id}
                  className="bg-slate-50 dark:bg-[#0F172A]/50 border border-slate-200 dark:border-[#334155] rounded-xl p-6 relative"
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(d.id, `Subject: ${d.subject}\n\n${d.body}`)}
                    className="absolute top-4 right-4 text-slate-500 hover:text-sky-500 dark:text-slate-400 dark:hover:text-sky-400"
                  >
                    {copiedId === d.id ? (
                      <CheckCircle2 size={16} className="text-emerald-500" />
                    ) : (
                      <Copy size={16} />
                    )}
                  </Button>
                  <div className="space-y-4 pr-8">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        {d.type}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Subject
                      </span>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                        {d.subject}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Message Body
                      </span>
                      <div className="text-sm text-slate-700 dark:text-slate-300 mt-2 whitespace-pre-wrap leading-relaxed font-serif">
                        {d.body}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {drafts.length === 0 && !loading && !error && (
            <div className="h-48 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-[#334155] rounded-xl">
              <Send size={32} className="mb-2 text-slate-300 dark:text-slate-600" />
              <p>Select a tone and hit generate to draft your outreach.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
