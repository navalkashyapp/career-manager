import React, { useState, useEffect } from 'react';
import { Send, Loader2, Copy, CheckCircle2 } from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { draftOutreach } from '../../api/draftOutreach';
import { formatDistanceToNow } from 'date-fns';
import type { JobApplication, UserProfile } from '../../../../types';

const TONES = ['Professional', 'Casual', 'Direct'];
const AUDIENCES = ['Recruiter', 'Friend', 'Hiring Manager'];

interface JobOutreachTabProps {
  app: JobApplication;
  profile: UserProfile;
  onUpdate: (updates: Partial<JobApplication>) => Promise<void>;
}

export const JobOutreachTab: React.FC<JobOutreachTabProps> = ({ app, profile, onUpdate }) => {
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

  useEffect(() => {
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
      setOutreachPhase('Analyzing Job Requirements & Candidate Fit...');
      setOutreachPercentage(30);

      const jdText =
        app.rawJobDescription ||
        (typeof app.cleanedJdJson === 'string'
          ? app.cleanedJdJson
          : JSON.stringify(app.cleanedJdJson, null, 2)) ||
        app.extractedMarkdown ||
        '';

      setOutreachPhase('Drafting & Polishing Message via Backend Agent...');
      setOutreachPercentage(65);

      const targetChannel = audience === 'Recruiter' ? 'linkedin-connection-note' : 'cold-email';

      const response = await draftOutreach({
        jdText,
        profileData: profile,
        messageType: `${tone} Outreach to ${audience}`,
        channel: targetChannel,
        recipient: {
          name: audience,
          role: audience,
          company: app.companyName || 'Target Company',
        },
      });

      setOutreachPhase('Complete');
      setOutreachPercentage(100);

      const subject =
        response.subject ||
        response.finalMessage?.subject ||
        response.draft?.subject ||
        `${tone} Introduction: ${app.jobTitle} @ ${app.companyName}`;

      const body = response.body || response.finalMessage?.body || response.draft?.body || '';

      const newDraft = {
        id: Date.now().toString(),
        type: `Custom (${tone} to ${audience})`,
        subject,
        body,
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

      await onUpdate(updatePayload);
    } catch (err: any) {
      console.error('[JobOutreachTab] Error generating outreach:', err);
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

  return (
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
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
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
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
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
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{outreachPhase}</p>
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
              {currentDrafts.length} draft{currentDrafts.length > 1 ? 's' : ''} for {audience}
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
                    {d.createdAt ? formatDistanceToNow(new Date(d.createdAt)) + ' ago' : 'Recent'}
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
            Click "Draft Outreach" to generate a personalized message targeting this role and
            company.
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
  );
};
