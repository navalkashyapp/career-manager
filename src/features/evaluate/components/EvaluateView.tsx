import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useCareerOps } from '../../../hooks/useCareerOps';
import { useData } from '../../../hooks/useData';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { Search, History, Clock, Trash2, Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';

export default function EvaluateView() {
  const { profile, addApplication } = useData();
  const navigate = useNavigate();
  const { evaluateJob, evaluateJobUrl } = useCareerOps();

  const [evalInput, setEvalInput] = useState('');
  const [evalResult, setEvalResult] = useState<any>(null);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [progressPhase, setProgressPhase] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [history, setHistory] = useState<any[]>([]);

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('careerOpsEvalHistory');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse eval history', e);
      }
    }
  }, []);

  const saveToHistory = (result: any, input: string) => {
    const newEntry = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      input,
      result
    };
    const newHistory = [newEntry, ...history].slice(0, 20); // Keep last 20
    setHistory(newHistory);
    localStorage.setItem('careerOpsEvalHistory', JSON.stringify(newHistory));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('careerOpsEvalHistory');
  };

  const deleteHistoryItem = (id: string) => {
    const newHistory = history.filter(item => item.id !== id);
    setHistory(newHistory);
    localStorage.setItem('careerOpsEvalHistory', JSON.stringify(newHistory));
  };

  const handleEvaluate = async () => {
    if (!evalInput.trim()) return;
    console.log('[EvaluateView] Starting evaluation for input:', evalInput.substring(0, 50) + '...');
    setEvalError(null);
    setEvalResult(null);
    setEvalLoading(true);
    setProgressPhase('Connecting...');
    setProgressPercent(5);
    try {
      const isUrl = evalInput.trim().startsWith('http://') || evalInput.trim().startsWith('https://');
      console.log(`[EvaluateView] Input detected as ${isUrl ? 'URL' : 'Raw Text'}`);

      const onProgress = (progress: any) => {
        setProgressPhase(progress.phase);
        setProgressPercent(progress.percentage);
      };

      let data;
      if (isUrl) {
        console.log('[EvaluateView] Invoking evaluateJobUrl hook...');
        data = await evaluateJobUrl(evalInput.trim(), onProgress);
      } else {
        console.log('[EvaluateView] Invoking evaluateJob hook...');
        data = await evaluateJob(evalInput.trim(), onProgress);
      }

      console.log('[EvaluateView] Evaluation complete. Data received:', data);
      setEvalResult(data);
      saveToHistory(data, evalInput.trim());
    } catch (err: any) {
      console.error('[EvaluateView] Evaluation failed with error:', err);
      let msg = err.message || 'Failed to evaluate job';
      try {
        const parsed = JSON.parse(msg);
        if (Array.isArray(parsed) && parsed[0]?.message) {
          msg = parsed.map((e: any) => e.message).join(', ');
        }
      } catch (e) { }
      setEvalError(msg);
    } finally {
      setEvalLoading(false);
      setProgressPhase('');
      setProgressPercent(0);
    }
  };

  const handleAddTargetList = async (result: any) => {
    if (!result) return;
    console.log('[EvaluateView] Adding evaluated job to Kanban Target list:', result.company, result.role);
    try {
      const isUrl = evalInput.trim().startsWith('http://') || evalInput.trim().startsWith('https://');
      
      await addApplication({
        id: Date.now().toString(),
        jobTitle: result.role || 'Unknown Title',
        companyName: result.company || 'Unknown Company',
        location: result.location || '',
        jobUrl: isUrl ? evalInput.trim() : undefined,
        salaryRange: '',
        targetLevel: '',
        contacts: [],
        rawJobDescription: '',
        matchScore: result.score,
        stage: 'Targeting',
        notes: result.evaluationText || '',
        gapAnalysis: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      navigate('/applications');
    } catch (err: any) {
      setEvalError(err.message || 'Failed to save application');
    }
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-8 overflow-y-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <Search className="w-8 h-8 text-indigo-500" />
            Job Evaluator
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Analyze job descriptions and evaluate your match score.</p>
        </div>
      </div>

      <Card className="mb-8 border-slate-200 dark:border-[#334155] bg-white/50 dark:bg-[#1E293B]/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-lg">New Evaluation</CardTitle>
          <CardDescription>Paste a Job URL or raw text to get started.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4">
            <Input
              type="text"
              placeholder="Paste Job Description URL or Text here..."
              value={evalInput}
              onChange={(e) => setEvalInput(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={handleEvaluate}
              disabled={evalLoading || !evalInput.trim()}
              className="w-full sm:w-auto px-6"
            >
              {evalLoading ? 'Evaluating...' : 'Evaluate'}
            </Button>
          </div>

          {evalError && <div className="text-red-400 mb-4 text-sm">{evalError}</div>}

          {evalLoading && (
            <div className="mb-4 space-y-3 p-5 bg-slate-50 dark:bg-[#1E293B]/50 rounded-xl border border-slate-100 dark:border-[#334155]/50">
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

          {evalResult && (
            <div className="bg-[#0F172A] p-4 rounded-xl border border-[#334155] text-slate-200 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-4">
                <div>
                  <h3 className="font-semibold text-xl">{evalResult?.role || 'Unknown'}</h3>
                  <p className="text-slate-400">{evalResult?.company || 'Unknown'}</p>
                </div>
                <div className="text-left sm:text-right bg-slate-800/50 sm:bg-transparent p-3 sm:p-0 rounded-lg">
                  <span className="text-sm text-slate-400 block mb-1">Match Score</span>
                  <span className="text-3xl font-bold text-indigo-400">{evalResult?.score || 'N/A'} <span className="text-lg text-slate-500">/ 5.0</span></span>
                </div>
              </div>

              <div className="mb-4 bg-slate-800/50 p-3 rounded-lg border border-slate-700 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0">
                <div className="flex items-center">
                  <span className="font-semibold text-slate-200 mr-2">Archetype: </span>
                  <span className="text-slate-400">{evalResult?.archetype || 'N/A'}</span>
                </div>
                <span className="hidden sm:inline mx-3 text-slate-600">|</span>
                <div className="flex items-center">
                  <span className="font-semibold text-slate-200 mr-2">Legitimacy: </span>
                  <span className="text-slate-400">{evalResult?.legitimacy || 'N/A'}</span>
                </div>
              </div>

              {evalResult.evaluationText && (
                <div className="mt-4 border-t border-[#334155] pt-4">
                  <h4 className="font-semibold mb-2 text-slate-200">Detailed Report:</h4>
                  <div className="text-sm text-slate-300 max-h-200 overflow-y-auto bg-slate-900 p-4 rounded-lg border border-slate-800">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mt-4 mb-2 text-slate-100 border-b border-slate-700 pb-2" {...props} />,
                        h2: ({ node, ...props }) => <h2 className="text-xl font-semibold mt-4 mb-2 text-slate-100" {...props} />,
                        h3: ({ node, ...props }) => <h3 className="text-lg font-medium mt-3 mb-2 text-slate-200" {...props} />,
                        p: ({ node, ...props }) => <div className="mb-3 leading-relaxed" {...props} />,
                        ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-3 space-y-1" {...props} />,
                        ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-3 space-y-1" {...props} />,
                        li: ({ node, ...props }) => <li className="text-slate-300" {...props} />,
                        strong: ({ node, ...props }) => <strong className="font-semibold text-slate-200" {...props} />,
                        table: ({ node, ...props }) => <div className="overflow-x-auto mb-4"><table className="w-full text-left border-collapse" {...props} /></div>,
                        th: ({ node, ...props }) => <th className="border-b border-slate-700 py-2 px-3 font-semibold text-slate-200 bg-slate-800/50" {...props} />,
                        td: ({ node, ...props }) => <td className="border-b border-slate-800 py-2 px-3 align-top" {...props} />,
                        code: ({ node, inline, ...props }: any) =>
                          inline ? (
                            <code className="bg-black/40 px-1.5 py-0.5 rounded text-indigo-300 font-mono text-xs" {...props} />
                          ) : (
                            <pre className="bg-black/40 p-3 rounded-lg overflow-x-auto mb-3 font-mono text-xs border border-slate-800"><code className="text-indigo-300" {...props} /></pre>
                          ),
                        blockquote: ({ node, ...props }) => <blockquote className="border-l-2 border-indigo-500 pl-4 py-1 my-3 bg-indigo-500/5 text-slate-300 italic rounded-r-lg" {...props} />
                      }}
                    >
                      {evalResult?.evaluationText || evalResult?.report || ''}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <Button
                  onClick={() => handleAddTargetList(evalResult)}
                  variant="default"
                  className="bg-emerald-500 hover:bg-emerald-600 text-white"
                >
                  + Add to Target List
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History Section */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <History className="w-5 h-5 text-slate-500" />
          Past Searches
        </h2>
        {history.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearHistory} className="text-slate-500 hover:text-rose-500">
            Clear History
          </Button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="text-center py-12 bg-white/30 dark:bg-[#1E293B]/30 rounded-xl border border-slate-200 dark:border-[#334155] border-dashed">
          <Clock className="w-8 h-8 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">No past searches yet. Evaluate a job to see it here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((entry) => (
            <Card key={entry.id} className="bg-white/50 dark:bg-[#1E293B]/50 backdrop-blur-md border-slate-200 dark:border-[#334155] overflow-hidden">
              <div className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                  <div>
                    <h3 className="font-semibold text-lg text-slate-900 dark:text-white">
                      {entry.result?.role || 'Unknown Title'}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400">
                      {entry.result?.company || 'Unknown Company'}
                    </p>
                    <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {entry.timestamp && !isNaN(new Date(entry.timestamp).getTime()) ? formatDistanceToNow(new Date(entry.timestamp)) : 'a while'} ago
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1 border border-indigo-100 dark:border-indigo-500/20">
                      Match: {entry.result?.score || 'N/A'}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteHistoryItem(entry.id)}
                      className="text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 h-8 w-8 rounded-full"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#0F172A] p-4 rounded-lg border border-slate-100 dark:border-[#334155]">
                  <p className="mb-2"><span className="font-semibold text-slate-900 dark:text-white">Archetype:</span> {entry.result?.archetype || 'N/A'}</p>
                  <p><span className="font-semibold text-slate-900 dark:text-white">Legitimacy:</span> {entry.result?.legitimacy || 'N/A'}</p>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEvalInput(entry.input);
                      setEvalResult(entry.result);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Load in Evaluator
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="bg-emerald-500 hover:bg-emerald-600 text-white"
                    onClick={() => handleAddTargetList(entry.result)}
                  >
                    + Add to Target List
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
