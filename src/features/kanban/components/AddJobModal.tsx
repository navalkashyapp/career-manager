import React, { useState } from 'react';
import { X, Link2, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { useCareerOps } from '../../../hooks/useCareerOps';
import { useData } from '../../../hooks/useData';
import { useQueryClient } from '@tanstack/react-query';

interface AddJobModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddJobModal({ isOpen, onClose }: AddJobModalProps) {
  const [url, setUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPhase, setProgressPhase] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const { evaluateJobUrl } = useCareerOps();
  const { profile, addApplication } = useData();
  const queryClient = useQueryClient();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    
    setIsProcessing(true);
    setError(null);
    setProgressPhase('Connecting...');
    setProgressPercent(5);

    try {
      const data: any = await evaluateJobUrl(url, profile, (progress) => {
        setProgressPhase(progress.phase);
        setProgressPercent(progress.percentage);
      });
      
      // Save to Job Evaluator History
      const saved = localStorage.getItem('careerOpsEvalHistory');
      let history = [];
      if (saved) {
        try { history = JSON.parse(saved); } catch (e) {}
      }
      const newEntry = { id: Date.now().toString(), date: Date.now(), input: url, ...data };
      const newHistory = [newEntry, ...history].slice(0, 20);
      localStorage.setItem('careerOpsEvalHistory', JSON.stringify(newHistory));

      // Add to Kanban as 'Targeting'
      await addApplication({
        id: Date.now().toString(),
        jobTitle: data.role || 'Unknown Title',
        companyName: data.company || 'Unknown Company',
        location: data.location || '',
        jobUrl: url,
        salaryRange: '',
        targetLevel: '',
        contacts: [],
        rawJobDescription: data.rawJobDescription || '',
        matchScore: data.score,
        stage: 'Targeting',
        notes: data.evaluationText || '',
        gapAnalysis: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      
      // On success, refresh Kanban data
      await queryClient.invalidateQueries({ queryKey: ['careerOpsTracker'] });
      onClose();
      setUrl('');
    } catch (err: any) {
      setError(err.message || 'Failed to process job URL.');
    } finally {
      setIsProcessing(false);
      setProgressPhase('');
      setProgressPercent(0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#0F172A] rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-[#334155] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-[#1E293B]">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl">
              <Sparkles className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Auto-Source Job</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Paste a job posting URL to analyze and score.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={isProcessing}
            className="p-2 text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Job URL</label>
              <div className="relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  type="url"
                  placeholder="https://linkedin.com/jobs/view/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isProcessing}
                  required
                  className="pl-10 w-full"
                />
              </div>
            </div>

            {error && (
              <div className="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
              </div>
            )}

            {isProcessing && (
              <div className="space-y-3 p-5 bg-slate-50 dark:bg-[#1E293B]/50 rounded-xl border border-slate-100 dark:border-[#334155]/50">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin text-indigo-500" />
                    {progressPhase}
                  </span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{progressPercent}%</span>
                </div>
                <div className="h-2 w-full bg-slate-200 dark:bg-[#334155] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-500 transition-all duration-300 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-100 dark:border-[#1E293B]">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={!url || isProcessing}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {isProcessing ? 'Sourcing...' : 'Analyze Job'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
