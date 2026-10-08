import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { useCareerOps } from '../../../hooks/useCareerOps';
import { useData } from '../../../hooks/useData';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '../../../components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import {
  Search,
  History,
  Clock,
  Trash2,
  Loader2,
  LayoutList,
  LayoutGrid,
  Eye,
  EyeOff,
} from 'lucide-react';
import { cn } from '../../../lib/utils';

export default function EvaluateView() {
  const {
    profile,
    addApplication,
    searchHistory,
    addSearchHistory,
    deleteSearchHistory,
    clearSearchHistory,
  } = useData();
  const navigate = useNavigate();
  const { evaluateJob, evaluateJobUrl } = useCareerOps();

  const [evalInput, setEvalInput] = useState('');
  const [evalResult, setEvalResult] = useState<any>(null);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [progressPhase, setProgressPhase] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [isReportVisible, setIsReportVisible] = useState(true);
  const [isTableView, setIsTableView] = useState(false);

  // Migrate history from localStorage to Firestore
  useEffect(() => {
    const saved = localStorage.getItem('careerOpsEvalHistory');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        parsed.forEach((entry: any) => {
          const ts = entry.timestamp || Date.now();
          addSearchHistory({
            id: entry.id || ts.toString(),
            timestamp: ts,
            input: entry.input || '',
            result: entry.result || null,
          });
        });
        localStorage.removeItem('careerOpsEvalHistory');
      } catch (e) {
        console.error('Failed to migrate eval history', e);
      }
    }
  }, [addSearchHistory]);

  const normalizeResult = (res: any) => {
    if (!res) return null;
    let curr = res;
    while (
      curr &&
      curr.result &&
      typeof curr.result === 'object' &&
      !curr.evaluationText &&
      !curr.role
    ) {
      curr = curr.result;
    }
    return curr;
  };

  const saveToHistory = async (docId: string, rawResult: any, input: string) => {
    const ts = parseInt(docId, 10) || Date.now();
    const result = normalizeResult(rawResult);
    await addSearchHistory({
      id: docId,
      timestamp: ts,
      input,
      result,
    });
  };

  const clearHistory = async () => {
    await clearSearchHistory();
  };

  const deleteHistoryItem = async (id: string) => {
    await deleteSearchHistory(id);
  };

  const handleEvaluate = async () => {
    if (!evalInput.trim()) return;
    console.log(
      '[EvaluateView] Starting evaluation for input:',
      evalInput.substring(0, 50) + '...',
    );
    setEvalError(null);
    setEvalResult(null);
    setEvalLoading(true);
    setProgressPhase('Connecting...');
    setProgressPercent(5);
    try {
      const isUrl =
        evalInput.trim().startsWith('http://') || evalInput.trim().startsWith('https://');
      console.log(`[EvaluateView] Input detected as ${isUrl ? 'URL' : 'Raw Text'}`);

      const onProgress = (progress: any) => {
        setProgressPhase(progress.phase);
        setProgressPercent(progress.percentage);
      };

      let data;
      const docId = Date.now().toString();
      if (isUrl) {
        console.log('[EvaluateView] Invoking evaluateJobUrl hook...');
        data = await evaluateJobUrl(docId, evalInput.trim(), profile, onProgress);
      } else {
        console.log('[EvaluateView] Invoking evaluateJob hook...');
        data = await evaluateJob(docId, evalInput.trim(), profile, onProgress);
      }

      console.log('[EvaluateView] Evaluation complete. Data received:', data);
      const cleanResult = normalizeResult(data);
      console.log('[EvaluateView] Normalized result:', cleanResult);
      setEvalResult(cleanResult);
      saveToHistory(docId, cleanResult, evalInput.trim());
    } catch (err: any) {
      console.error('[EvaluateView] Evaluation failed with error:', err);
      let msg = err.message || 'Failed to evaluate job';
      try {
        const parsed = JSON.parse(msg);
        if (Array.isArray(parsed) && parsed[0]?.message) {
          msg = parsed.map((e: any) => e.message).join(', ');
        }
      } catch (e) {}
      setEvalError(msg);
    } finally {
      setEvalLoading(false);
      setProgressPhase('');
      setProgressPercent(0);
    }
  };

  const handleAddTargetList = async (rawResult: any) => {
    const result = normalizeResult(rawResult);
    if (!result) return;
    console.log(
      '[EvaluateView] Adding evaluated job to Kanban Target list:',
      result.company,
      result.role,
    );
    try {
      const isUrl =
        evalInput.trim().startsWith('http://') || evalInput.trim().startsWith('https://');
      const evalText = result.evaluationText || result.report || result.notes || '';

      let coverLetterMarkdown = '';
      const clMatch = evalText.match(/## Cover Letter Draft[\s\S]*?(?=##|$)/i);
      if (clMatch) coverLetterMarkdown = clMatch[0].trim();

      let outreachDrafts: any[] = [];
      const outreachMatch = evalText.match(/## H\) Outreach Messages[\s\S]*?(?=\n##\s|$)/i);
      if (outreachMatch) {
        const text = outreachMatch[0];
        const parts = text.split(/(?:\n|^)(?:###\s*)?\d\.\s*.*?(?:\n|$)/);
        if (parts.length > 1) {
          outreachDrafts = parts.slice(1).map((p: string, i: number) => {
            const types = ['Recruiter', 'Friend', 'Hiring Manager'];
            const bodyText = p.replace(/^>\s?/gm, '').trim();
            // Optional: try to extract a Subject if the AI provided one
            let subject = 'Outreach Draft';
            let body = bodyText.replace(/\n---$/, '').trim();
            const subjMatch = bodyText.match(/^(?:\*\*)?Subject:(?:\*\*)?\s*(.*)(?:\n|$)/i);
            if (subjMatch) {
              subject = subjMatch[1].trim();
              body = body.replace(/^(?:\*\*)?Subject:(?:\*\*)?\s*(.*)(?:\n|$)/i, '').trim();
            }
            return {
              id: Date.now().toString() + '-' + i,
              type: types[i] || 'Network',
              subject,
              body,
              createdAt: Date.now(),
            };
          });
        }
      }

      const tailoredResumes = coverLetterMarkdown
        ? [
            {
              id: Date.now().toString(),
              markdown: coverLetterMarkdown,
              createdAt: Date.now(),
              keywordsTargeted: [],
            },
          ]
        : [];

      await addApplication({
        id: Date.now().toString(),
        jobTitle: result.role || 'Unknown Title',
        companyName: result.company || 'Unknown Company',
        location: result.location || '',
        jobUrl: isUrl ? evalInput.trim() : '',
        salaryRange: '',
        targetLevel: '',
        contacts: [],
        rawJobDescription: result.rawJobDescription || (!isUrl ? evalInput.trim() : ''),
        matchScore: result.score,
        stage: 'Targeting',
        notes: evalText,
        tailoredResumes,
        outreachDraftsRecruiter: outreachDrafts,
        gapAnalysis: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
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
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Analyze job descriptions and evaluate your match score.
          </p>
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
                <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                  {progressPercent}%
                </span>
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
                  <span className="text-3xl font-bold text-indigo-400">
                    {evalResult?.score || 'N/A'}{' '}
                    <span className="text-lg text-slate-500">/ 5.0</span>
                  </span>
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

              {(evalResult?.evaluationText || evalResult?.report || evalResult?.notes) && (
                <div className="mt-4 border-t border-[#334155] pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-slate-200">Detailed Report:</h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsReportVisible(!isReportVisible)}
                      className="flex items-center gap-2 h-8 text-xs border-slate-700 hover:bg-slate-800 hover:text-slate-200"
                    >
                      {isReportVisible ? (
                        <>
                          <EyeOff className="w-3 h-3" /> Hide
                        </>
                      ) : (
                        <>
                          <Eye className="w-3 h-3" /> Show
                        </>
                      )}
                    </Button>
                  </div>
                  {isReportVisible && (
                    <div className="text-sm text-slate-300 max-h-200 overflow-y-auto bg-slate-900 p-4 rounded-lg border border-slate-800">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw]}
                        components={{
                          h1: ({ node, ...props }) => (
                            <h1
                              className="text-2xl font-bold mt-4 mb-2 text-slate-100 border-b border-slate-700 pb-2"
                              {...props}
                            />
                          ),
                          h2: ({ node, ...props }) => (
                            <h2
                              className="text-xl font-semibold mt-4 mb-2 text-slate-100"
                              {...props}
                            />
                          ),
                          h3: ({ node, ...props }) => (
                            <h3
                              className="text-lg font-medium mt-3 mb-2 text-slate-200"
                              {...props}
                            />
                          ),
                          p: ({ node, ...props }) => (
                            <div className="mb-3 leading-relaxed" {...props} />
                          ),
                          ul: ({ node, ...props }) => (
                            <ul className="list-disc pl-5 mb-3 space-y-1" {...props} />
                          ),
                          ol: ({ node, ...props }) => (
                            <ol className="list-decimal pl-5 mb-3 space-y-1" {...props} />
                          ),
                          li: ({ node, ...props }) => <li className="text-slate-300" {...props} />,
                          strong: ({ node, ...props }) => (
                            <strong className="font-semibold text-slate-200" {...props} />
                          ),
                          table: ({ node, ...props }) => (
                            <div className="overflow-x-auto mb-4">
                              <table className="w-full text-left border-collapse" {...props} />
                            </div>
                          ),
                          th: ({ node, ...props }) => (
                            <th
                              className="border-b border-slate-700 py-2 px-3 font-semibold text-slate-200 bg-slate-800/50"
                              {...props}
                            />
                          ),
                          td: ({ node, ...props }) => (
                            <td
                              className="border-b border-slate-800 py-2 px-3 align-top"
                              {...props}
                            />
                          ),
                          code: ({ node, inline, ...props }: any) =>
                            inline ? (
                              <code
                                className="bg-black/40 px-1.5 py-0.5 rounded text-indigo-300 font-mono text-xs"
                                {...props}
                              />
                            ) : (
                              <pre className="bg-black/40 p-3 rounded-lg overflow-x-auto mb-3 font-mono text-xs border border-slate-800">
                                <code className="text-indigo-300" {...props} />
                              </pre>
                            ),
                          blockquote: ({ node, ...props }) => (
                            <blockquote
                              className="border-l-2 border-indigo-500 pl-4 py-1 my-3 bg-indigo-500/5 text-slate-300 italic rounded-r-lg"
                              {...props}
                            />
                          ),
                        }}
                      >
                        {evalResult?.evaluationText || evalResult?.report || ''}
                      </ReactMarkdown>
                    </div>
                  )}
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
        <div className="flex items-center gap-2">
          {searchHistory.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTableView(!isTableView)}
              className="text-slate-600 dark:text-slate-300 flex items-center gap-2 h-8"
            >
              {isTableView ? (
                <>
                  <LayoutGrid className="w-4 h-4" /> Cards
                </>
              ) : (
                <>
                  <LayoutList className="w-4 h-4" /> Table
                </>
              )}
            </Button>
          )}
          {searchHistory.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearHistory}
              className="text-slate-500 hover:text-rose-500 h-8"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {searchHistory.length === 0 ? (
        <div className="text-center py-12 bg-white/30 dark:bg-[#1E293B]/30 rounded-xl border border-slate-200 dark:border-[#334155] border-dashed">
          <Clock className="w-8 h-8 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">
            No past searches yet. Evaluate a job to see it here.
          </p>
        </div>
      ) : isTableView ? (
        <div className="bg-white/50 dark:bg-[#1E293B]/50 backdrop-blur-md rounded-xl border border-slate-200 dark:border-[#334155] overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="p-3 text-sm font-semibold text-slate-900 dark:text-white">Role</th>
                <th className="p-3 text-sm font-semibold text-slate-900 dark:text-white">
                  Company
                </th>
                <th className="p-3 text-sm font-semibold text-slate-900 dark:text-white">Match</th>
                <th className="p-3 text-sm font-semibold text-slate-900 dark:text-white">Date</th>
                <th className="p-3 text-sm font-semibold text-slate-900 dark:text-white text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {searchHistory.map((entry) => {
                const r = normalizeResult(entry.result);
                return (
                  <tr
                    key={entry.id}
                    className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                  >
                    <td className="p-3 text-sm text-slate-800 dark:text-slate-200 font-medium">
                      {r?.role || 'Unknown Title'}
                    </td>
                    <td className="p-3 text-sm text-slate-600 dark:text-slate-400">
                      {r?.company || 'Unknown Company'}
                    </td>
                    <td className="p-3 text-sm">
                      <span className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded text-xs font-semibold border border-indigo-100 dark:border-indigo-500/20">
                        {r?.score || 'N/A'}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-slate-500">
                      {entry.timestamp && !isNaN(new Date(entry.timestamp).getTime())
                        ? formatDistanceToNow(new Date(entry.timestamp)) + ' ago'
                        : 'a while ago'}
                    </td>
                    <td className="p-3 text-sm text-right flex justify-end items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={() => {
                          setEvalInput(entry.input);
                          setEvalResult(r);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        Load
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteHistoryItem(entry.id)}
                        className="text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 h-7 w-7 rounded-full"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          {searchHistory.map((entry) => {
            const r = normalizeResult(entry.result);
            return (
              <Card
                key={entry.id}
                className="bg-white/50 dark:bg-[#1E293B]/50 backdrop-blur-md border-slate-200 dark:border-[#334155] overflow-hidden"
              >
                <div className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                    <div>
                      <h3 className="font-semibold text-lg text-slate-900 dark:text-white">
                        {r?.role || 'Unknown Title'}
                      </h3>
                      <p className="text-slate-600 dark:text-slate-400">
                        {r?.company || 'Unknown Company'}
                      </p>
                      <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {entry.timestamp && !isNaN(new Date(entry.timestamp).getTime())
                          ? formatDistanceToNow(new Date(entry.timestamp))
                          : 'a while'}{' '}
                        ago
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1 border border-indigo-100 dark:border-indigo-500/20">
                        Match: {r?.score || 'N/A'}
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
                    <p className="mb-2">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        Archetype:
                      </span>{' '}
                      {r?.archetype || 'N/A'}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        Legitimacy:
                      </span>{' '}
                      {r?.legitimacy || 'N/A'}
                    </p>
                  </div>

                  <div className="mt-4 flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEvalInput(entry.input);
                        setEvalResult(r);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      Load in Evaluator
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-emerald-500 hover:bg-emerald-600 text-white"
                      onClick={() => handleAddTargetList(r)}
                    >
                      + Add to Target List
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
