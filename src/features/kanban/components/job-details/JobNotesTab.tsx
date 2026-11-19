import React, { useState } from 'react';
import { BookOpen, Check } from 'lucide-react';
import { Textarea } from '../../../../components/ui/textarea';
import type { JobApplication } from '../../../../types';

interface JobNotesTabProps {
  app: JobApplication;
  onUpdate: (updates: Partial<JobApplication>) => Promise<void>;
}

export const JobNotesTab: React.FC<JobNotesTabProps> = ({ app, onUpdate }) => {
  const [notes, setNotes] = useState(app.notes || '');
  const [isSaved, setIsSaved] = useState(false);

  const handleBlur = async () => {
    if (notes !== (app.notes || '')) {
      try {
        await onUpdate({ notes });
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
      } catch (err) {
        console.error('Failed to save notes:', err);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200 dark:border-[#334155] rounded-xl flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="text-indigo-400" size={17} />
            <span>Application Notes & Strategic Insights</span>
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Record personal notes, referral context, interview schedules, and recruiter feedback.
          </p>
        </div>
        {isSaved && (
          <div className="flex items-center gap-1 text-xs text-emerald-500 font-medium">
            <Check size={14} />
            <span>Saved</span>
          </div>
        )}
      </div>

      <div className="bg-slate-50 dark:bg-[#0F172A] p-5 rounded-xl border border-slate-200 dark:border-[#334155]/60">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleBlur}
          placeholder="Add notes about conversations, interviewers, compensation details, or strategic positioning..."
          className="w-full min-h-[220px] p-3 text-xs sm:text-sm bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] rounded-lg focus:border-indigo-500 text-slate-800 dark:text-slate-200 leading-relaxed resize-y"
        />
        <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400">
          <span>Notes auto-save on blur</span>
          <span>{notes.length} characters</span>
        </div>
      </div>
    </div>
  );
};
