import React, { useState, useEffect } from 'react';
import {
  X,
  Globe,
  Plus,
  Play,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Trash2,
  Loader2,
  RefreshCw,
  Building2,
  Layers,
  ArrowRight,
  Sparkles,
  Server,
  Zap,
  Check,
  Bell,
  BellOff,
  BellRing,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { useData } from '../../../hooks/useData';
import { useCareerOps } from '../../../hooks/useCareerOps';
import { useUIStore } from '../../../store/useUIStore';
import { apiUrl, apiFetch } from '../../../config/api';
import { PushNotificationClient } from '../../../lib/services/PushNotificationClient';
import type { JobUrlEntry, JobApplication } from '../../../types';

interface JobUrlsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const JobUrlsModal: React.FC<JobUrlsModalProps> = ({ isOpen, onClose }) => {
  const { jobUrls, addJobUrl, updateJobUrl, deleteJobUrl, addApplication, applications } =
    useData();
  const { extractJobFromUrl } = useCareerOps();
  const { openModal } = useUIStore();

  const [inputUrl, setInputUrl] = useState('');
  const [inputCompany, setInputCompany] = useState('');
  const [inputRole, setInputRole] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Bulk add toggle
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkUrls, setBulkUrls] = useState('');

  // Traversal state
  const [traversingId, setTraversingId] = useState<string | null>(null);
  const [isTraversingAll, setIsTraversingAll] = useState(false);
  const [traversalProgress, setTraversalProgress] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'failed'>(
    'all',
  );

  // Backend worker status
  const [workerStatus, setWorkerStatus] = useState<any>(null);
  const [isTriggeringServer, setIsTriggeringServer] = useState(false);
  const [serverMessage, setServerMessage] = useState<string | null>(null);

  // Push notifications state
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushStatusMessage, setPushStatusMessage] = useState<string | null>(null);

  const checkPushSubscription = async () => {
    if (!PushNotificationClient.isSupported()) return;
    try {
      const sub = await PushNotificationClient.getCurrentSubscription();
      setIsPushSubscribed(!!sub);
    } catch {
      setIsPushSubscribed(false);
    }
  };

  const handleTogglePush = async () => {
    setPushLoading(true);
    setPushStatusMessage(null);
    try {
      if (isPushSubscribed) {
        const res = await PushNotificationClient.unsubscribe();
        if (res.success) {
          setIsPushSubscribed(false);
          setPushStatusMessage('Daily job import push notifications disabled.');
        } else {
          setPushStatusMessage(res.error || 'Failed to disable notifications.');
        }
      } else {
        const res = await PushNotificationClient.subscribe();
        if (res.success) {
          setIsPushSubscribed(true);
          setPushStatusMessage(
            'Daily job import notifications enabled! You will be notified when backend completes imports.',
          );
        } else {
          setPushStatusMessage(res.error || 'Failed to enable push notifications.');
        }
      }
    } catch (err: any) {
      setPushStatusMessage(err.message || 'Error configuring notifications');
    } finally {
      setPushLoading(false);
    }
  };

  const handleSendTestPush = async () => {
    setPushLoading(true);
    setPushStatusMessage(null);
    try {
      const res = await PushNotificationClient.sendTestNotification();
      if (res.success) {
        setPushStatusMessage('Test notification sent! Check your screen or notification tray.');
      } else {
        setPushStatusMessage(res.error || 'Failed to send test push notification.');
      }
    } catch (err: any) {
      setPushStatusMessage(err.message || 'Failed to send test push notification.');
    } finally {
      setPushLoading(false);
    }
  };

  const fetchWorkerStatus = async () => {
    try {
      const res = await apiFetch(apiUrl('/api/career-ops/job-urls/status'));
      if (res.ok) {
        const data = await res.json();
        setWorkerStatus(data);
      }
    } catch {
      // Backend may be offline or in preview mode
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchWorkerStatus();
      checkPushSubscription();
      const interval = setInterval(fetchWorkerStatus, 15000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const handleTriggerServerSweep = async () => {
    setIsTriggeringServer(true);
    setServerMessage(null);
    try {
      const res = await apiFetch(apiUrl('/api/career-ops/job-urls/trigger'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceAll: true }),
      });
      if (res.ok) {
        setServerMessage(
          'Backend server sweep started! Processing pending URLs one by one in the background.',
        );
        setTimeout(() => fetchWorkerStatus(), 2000);
      } else {
        setServerMessage('Failed to trigger backend sweep.');
      }
    } catch (err: any) {
      setServerMessage('Backend server unavailable: ' + err.message);
    } finally {
      setIsTriggeringServer(false);
    }
  };

  if (!isOpen) return null;

  const handleAddSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    if (!inputUrl.trim()) {
      setAddError('Please enter a job URL.');
      return;
    }

    try {
      new URL(inputUrl.trim());
    } catch {
      setAddError('Please enter a valid URL (including https://).');
      return;
    }

    setIsAdding(true);
    try {
      await addJobUrl(inputUrl.trim(), {
        company: inputCompany.trim() || undefined,
        targetRole: inputRole.trim() || undefined,
      });
      setInputUrl('');
      setInputCompany('');
      setInputRole('');
    } catch (err: any) {
      setAddError(err.message || 'Failed to add job URL to Firestore.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddBulk = async () => {
    setAddError(null);
    const lines = bulkUrls
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      setAddError('Please enter at least one URL.');
      return;
    }

    setIsAdding(true);
    let addedCount = 0;
    try {
      for (const line of lines) {
        try {
          new URL(line);
          await addJobUrl(line);
          addedCount++;
        } catch {
          // skip invalid lines or log
        }
      }
      setBulkUrls('');
      setIsBulkMode(false);
    } catch (err: any) {
      setAddError(err.message || 'Failed to bulk-add URLs.');
    } finally {
      setIsAdding(false);
    }
  };

  const traverseSingleUrl = async (entry: JobUrlEntry) => {
    setTraversingId(entry.id);
    await updateJobUrl(entry.id, {
      status: 'traversing',
      lastTraversedAt: Date.now(),
      error: undefined,
    });

    try {
      // Step 1: Pre-check URL to filter out alert lists and search pages
      const lowerUrl = entry.url.toLowerCase();
      if (
        lowerUrl.includes('/jobs/search') ||
        lowerUrl.includes('/jobs/collections') ||
        lowerUrl.includes('/jobs/jam/manage') ||
        lowerUrl.includes('/jobs/tracker') ||
        lowerUrl.includes('/search-results')
      ) {
        throw new Error(
          'This URL points to a search list or alert management page, not an individual job vacancy.',
        );
      }

      setTraversalProgress(`Extracting: ${entry.url}`);
      const data = await extractJobFromUrl({ url: entry.url });

      // Step 2: Validate page type and content authenticity
      if (data.pageType === 'listing-page') {
        throw new Error('This link points to a job listing board, not an individual job posting.');
      }

      const roleTitle = data.roleTitle || data.jobTitle || entry.targetRole || 'Target Role';
      if (/job alert|search result|job digest|manage alert|recommended job/i.test(roleTitle)) {
        throw new Error(
          'Extracted title indicates an alert digest or search query, not a specific role.',
        );
      }

      const reqs = data.keyRequirements || data.requirements || [];
      const resps = data.responsibilities || [];
      const hasContent =
        reqs.length > 0 || resps.length > 0 || (data.jobSummary && data.jobSummary.length > 80);

      if (!hasContent) {
        throw new Error(
          'The webpage does not contain identifiable job requirements or responsibilities.',
        );
      }

      const companyName = data.companyName || entry.company || 'Target Company';
      const salaryRaw = data.salaryRange || data.salary?.raw || 'Competitive';

      const generatedMarkdown =
        data.extractedMarkdown ||
        [
          `## ${roleTitle} @ ${companyName}\n`,
          `**Location:** ${data.location || entry.location || 'Remote'}  •  **Level:** ${data.targetLevel || 'Senior'}  •  **Compensation:** ${salaryRaw}\n`,
          `🔗 [View Original Job Posting](${entry.url})\n`,
          '---\n',
          data.jobSummary ? `### 📋 Role Overview\n${data.jobSummary}\n` : '',
          reqs.length
            ? `### 🎯 Key Requirements & Qualifications\n${reqs.map((r: string) => `- ${r}`).join('\n')}\n`
            : '',
          data.responsibilities?.length
            ? `### 💼 Core Responsibilities\n${data.responsibilities.map((r: string) => `- ${r}`).join('\n')}\n`
            : '',
          data.techStack?.length
            ? `### 🛠️ Tech Stack & Key Skills\n${data.techStack.map((s: string) => `- \`${s}\``).join('\n')}\n`
            : '',
        ]
          .filter(Boolean)
          .join('\n');

      const appId = 'app-' + Date.now();
      const newApp: JobApplication = {
        id: appId,
        jobTitle: roleTitle,
        companyName: companyName,
        location: data.location || entry.location || 'Remote',
        jobUrl: entry.url,
        salaryRange: salaryRaw,
        targetLevel: data.targetLevel || 'Senior',
        stage: 'Targeting',
        matchScore: 85,
        rawJobDescription: data.rawJobDescription || '',
        extractedMarkdown: generatedMarkdown,
        cleanedJdJson: data,
        notes: `Auto-traversed from Firestore job URL queue on ${new Date().toLocaleDateString()}.`,
        contacts: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await addApplication(newApp);

      await updateJobUrl(entry.id, {
        status: 'completed',
        applicationId: appId,
        company: companyName,
        targetRole: roleTitle,
        location: data.location,
        lastTraversedAt: Date.now(),
        error: undefined,
      });
    } catch (err: any) {
      console.error('Failed to traverse job URL:', err);
      await updateJobUrl(entry.id, {
        status: 'failed',
        error: err.message || 'Failed to extract job posting',
        lastTraversedAt: Date.now(),
      });
    } finally {
      setTraversingId(null);
      setTraversalProgress('');
    }
  };

  const handleTraverseAllPending = async () => {
    const pendingList = jobUrls.filter((j) => j.status === 'pending' || j.status === 'failed');
    if (pendingList.length === 0) return;

    setIsTraversingAll(true);
    for (let i = 0; i < pendingList.length; i++) {
      const item = pendingList[i];
      setTraversalProgress(
        `Processing ${i + 1}/${pendingList.length}: ${item.company || item.url}`,
      );
      await traverseSingleUrl(item);
      // Wait 1.5s between requests
      await new Promise((res) => setTimeout(res, 1500));
    }
    setIsTraversingAll(false);
    setTraversalProgress('');
  };

  const filteredUrls = jobUrls.filter((j) => {
    if (statusFilter === 'all') return true;
    return j.status === statusFilter;
  });

  const pendingCount = jobUrls.filter((j) => j.status === 'pending').length;
  const completedCount = jobUrls.filter((j) => j.status === 'completed').length;
  const failedCount = jobUrls.filter((j) => j.status === 'failed').length;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4">
      <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-[#334155] flex items-center justify-between bg-slate-50/50 dark:bg-[#0F172A]/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 dark:text-indigo-400">
              <Globe size={20} />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Firestore Job URLs Queue</span>
                <Badge
                  variant="outline"
                  className="bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 text-xs"
                >
                  {jobUrls.length} total
                </Badge>
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                Manage target job URLs stored in Firestore and traverse them to automatically
                extract & ingest roles into Career Manager.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <X size={20} />
          </Button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Backend Auto-Ingest Worker Banner */}
          <div className="bg-gradient-to-r from-indigo-50/70 via-blue-50/50 to-slate-50 dark:from-indigo-950/20 dark:via-blue-950/15 dark:to-slate-900 border border-indigo-200/60 dark:border-indigo-800/50 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-lg bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0">
                <Server size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-900 dark:text-white">
                    Backend Auto-Ingest Engine
                  </span>
                  {workerStatus?.isProcessing ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                      <Loader2 size={11} className="animate-spin" /> Ingesting one-by-one
                    </span>
                  ) : workerStatus?.isRunning ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />{' '}
                      Active (Every {Math.round((workerStatus.pollIntervalMs || 120000) / 60000)}m)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                      Autonomous Ingest
                    </span>
                  )}
                </div>
                <p className="text-slate-600 dark:text-slate-300 text-xs mt-1">
                  Backend server periodically monitors this Firestore queue, scraping each job
                  posting with Playwright and Gemini to automatically populate the{' '}
                  <strong>Targeting</strong> lane.
                </p>
                {workerStatus?.currentJob && (
                  <p className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-1 font-mono truncate max-w-md">
                    Processing: {workerStatus.currentJob.company || 'Job'} -{' '}
                    {workerStatus.currentJob.url}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTriggerServerSweep}
                disabled={isTriggeringServer || workerStatus?.isProcessing}
                className="bg-white dark:bg-[#1E293B] border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-xs h-8 gap-1.5 shadow-2xs"
              >
                {isTriggeringServer ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Zap size={13} className="text-amber-500" />
                )}
                <span>{isTriggeringServer ? 'Starting...' : 'Trigger Server Ingest'}</span>
              </Button>
            </div>
          </div>

          {/* Daily Import Push Notifications Banner */}
          <div className="bg-gradient-to-r from-blue-50/70 via-slate-50 to-indigo-50/50 dark:from-slate-900/90 dark:via-slate-900 dark:to-indigo-950/30 border border-blue-200/70 dark:border-blue-900/50 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start space-x-3">
              <div
                className={`p-2 rounded-lg mt-0.5 shrink-0 ${
                  isPushSubscribed
                    ? 'bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                }`}
              >
                {isPushSubscribed ? <BellRing size={18} /> : <BellOff size={18} />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-900 dark:text-white">
                    Daily Import Push Notifications
                  </span>
                  {isPushSubscribed ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />{' '}
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                      Disabled
                    </span>
                  )}
                </div>
                <p className="text-slate-600 dark:text-slate-300 text-xs mt-1">
                  Get notified directly on your browser or device as soon as the daily job import
                  queue completes.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isPushSubscribed && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSendTestPush}
                  disabled={pushLoading}
                  className="bg-white dark:bg-[#1E293B] border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs h-8 gap-1.5"
                >
                  <Bell size={13} />
                  <span>Send Test</span>
                </Button>
              )}
              <Button
                type="button"
                variant={isPushSubscribed ? 'outline' : 'default'}
                size="sm"
                onClick={handleTogglePush}
                disabled={pushLoading}
                className={
                  isPushSubscribed
                    ? 'border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs h-8'
                    : 'bg-blue-600 hover:bg-blue-500 text-white text-xs h-8 gap-1.5'
                }
              >
                {pushLoading ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : isPushSubscribed ? (
                  <BellOff size={13} />
                ) : (
                  <Bell size={13} />
                )}
                <span>
                  {pushLoading
                    ? 'Updating...'
                    : isPushSubscribed
                      ? 'Turn Off'
                      : 'Enable Daily Push'}
                </span>
              </Button>
            </div>
          </div>

          {pushStatusMessage && (
            <div className="flex items-start space-x-3 p-3 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl text-blue-700 dark:text-blue-300 text-xs">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <div className="flex-1">{pushStatusMessage}</div>
            </div>
          )}

          {serverMessage && (
            <div className="flex items-start space-x-3 p-3 bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl text-indigo-700 dark:text-indigo-300 text-xs">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <div className="flex-1">{serverMessage}</div>
            </div>
          )}

          {addError && (
            <div className="flex items-start space-x-3 p-3.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-400 text-sm">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <div className="flex-1">{addError}</div>
            </div>
          )}

          {/* Add Job URL Input Form */}
          <div className="bg-slate-50 dark:bg-[#0F172A] p-4 rounded-xl border border-slate-200 dark:border-[#334155]/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Plus size={14} className="text-indigo-500" />
                Add Job URL to Traverse List
              </span>
              <button
                type="button"
                onClick={() => setIsBulkMode(!isBulkMode)}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {isBulkMode ? 'Switch to Single URL' : 'Switch to Bulk Paste'}
              </button>
            </div>

            {!isBulkMode ? (
              <form onSubmit={handleAddSingle} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-6">
                    <Input
                      placeholder="https://company.com/careers/job/12345"
                      value={inputUrl}
                      onChange={(e) => setInputUrl(e.target.value)}
                      className="text-xs h-9 bg-white dark:bg-[#1E293B]"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <Input
                      placeholder="Company (optional)"
                      value={inputCompany}
                      onChange={(e) => setInputCompany(e.target.value)}
                      className="text-xs h-9 bg-white dark:bg-[#1E293B]"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <Input
                      placeholder="Target Role (optional)"
                      value={inputRole}
                      onChange={(e) => setInputRole(e.target.value)}
                      className="text-xs h-9 bg-white dark:bg-[#1E293B]"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isAdding || !inputUrl.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-8 px-4"
                  >
                    {isAdding ? (
                      <Loader2 size={13} className="animate-spin mr-1.5" />
                    ) : (
                      <Plus size={13} className="mr-1.5" />
                    )}
                    Add URL to Firestore
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                <Textarea
                  placeholder="Paste multiple job URLs (one per line)..."
                  value={bulkUrls}
                  onChange={(e) => setBulkUrls(e.target.value)}
                  className="text-xs min-h-[90px] bg-white dark:bg-[#1E293B]"
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={handleAddBulk}
                    size="sm"
                    disabled={isAdding || !bulkUrls.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-8 px-4"
                  >
                    {isAdding ? (
                      <Loader2 size={13} className="animate-spin mr-1.5" />
                    ) : (
                      <Plus size={13} className="mr-1.5" />
                    )}
                    Add All URLs
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            {/* Filter Tabs */}
            <div className="flex bg-slate-100 dark:bg-[#0F172A] p-0.5 rounded-lg text-xs w-fit">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  statusFilter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                All ({jobUrls.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  statusFilter === 'pending'
                    ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Pending ({pendingCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('completed')}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  statusFilter === 'completed'
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Completed ({completedCount})
              </button>
              {failedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('failed')}
                  className={`px-3 py-1 rounded-md font-medium transition-all ${
                    statusFilter === 'failed'
                      ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  Failed ({failedCount})
                </button>
              )}
            </div>

            {/* Action Button: Traverse All Pending */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTraverseAllPending}
              disabled={
                isTraversingAll || traversingId !== null || pendingCount + failedCount === 0
              }
              className="border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs h-8 gap-1.5"
            >
              {isTraversingAll ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>{traversalProgress || 'Traversing URLs...'}</span>
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  <span>Traverse All Pending ({pendingCount + failedCount})</span>
                </>
              )}
            </Button>
          </div>

          {/* URLs List */}
          {filteredUrls.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs space-y-1">
              <Globe size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="font-medium text-slate-600 dark:text-slate-400">
                No job URLs found in this view.
              </p>
              <p>Add URLs above to build your automated ingestion list.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredUrls.map((entry) => {
                const isTraversingThis = traversingId === entry.id;
                const createdApp = entry.applicationId
                  ? applications.find((a) => a.id === entry.applicationId)
                  : null;

                return (
                  <div
                    key={entry.id}
                    className="p-3.5 bg-white dark:bg-[#0B0F17] rounded-xl border border-slate-200 dark:border-[#334155]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-indigo-300 dark:hover:border-indigo-900/60 transition-colors shadow-2xs"
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {entry.company && (
                          <Badge
                            variant="outline"
                            className="text-xs font-semibold py-0.5 px-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                          >
                            <Building2 size={11} className="mr-1 text-slate-400" />
                            {entry.company}
                          </Badge>
                        )}
                        <span className="font-medium text-xs text-slate-900 dark:text-white truncate">
                          {entry.targetRole || 'Target Role'}
                        </span>
                        {entry.location && (
                          <span className="text-[11px] text-slate-400 hidden md:inline">
                            • {entry.location}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <a
                          href={entry.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 dark:text-indigo-400 hover:underline truncate max-w-md inline-flex items-center gap-1"
                        >
                          <span className="truncate">{entry.url}</span>
                          <ExternalLink size={11} className="shrink-0" />
                        </a>
                      </div>

                      {entry.error && (
                        <p className="text-[11px] text-rose-500 dark:text-rose-400 mt-1 flex items-center gap-1">
                          <AlertCircle size={12} className="shrink-0" />
                          <span>{entry.error}</span>
                        </p>
                      )}
                    </div>

                    {/* Status & Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {/* Status Badges */}
                      {entry.status === 'completed' && (
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50 text-[11px] py-1 px-2 flex items-center gap-1"
                        >
                          <CheckCircle2 size={12} />
                          <span>Traversed & Ingested</span>
                        </Badge>
                      )}

                      {entry.status === 'pending' && (
                        <Badge
                          variant="outline"
                          className="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800/50 text-[11px] py-1 px-2"
                        >
                          Pending Traversal
                        </Badge>
                      )}

                      {entry.status === 'traversing' && (
                        <Badge
                          variant="outline"
                          className="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-800/50 text-[11px] py-1 px-2 flex items-center gap-1"
                        >
                          <Loader2 size={12} className="animate-spin" />
                          <span>Traversing...</span>
                        </Badge>
                      )}

                      {entry.status === 'failed' && (
                        <Badge
                          variant="outline"
                          className="bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-800/50 text-[11px] py-1 px-2"
                        >
                          Failed
                        </Badge>
                      )}

                      {/* Traverse / Retry Button */}
                      {(entry.status === 'pending' || entry.status === 'failed') && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => traverseSingleUrl(entry)}
                          disabled={isTraversingThis || isTraversingAll}
                          className="h-7 px-2.5 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded"
                          title="Traverse URL and add to Career Manager"
                        >
                          {isTraversingThis ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Play size={12} className="fill-indigo-500" />
                          )}
                          <span className="ml-1">
                            {entry.status === 'failed' ? 'Retry' : 'Traverse'}
                          </span>
                        </Button>
                      )}

                      {/* View Ingested App Button */}
                      {entry.status === 'completed' && createdApp && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            onClose();
                            openModal('details', createdApp);
                          }}
                          className="h-7 px-2 text-xs text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded flex items-center gap-1"
                          title="Open application card"
                        >
                          <span>View Job</span>
                          <ArrowRight size={12} />
                        </Button>
                      )}

                      {/* Delete URL Button */}
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteJobUrl(entry.id)}
                        disabled={isTraversingThis}
                        className="h-7 w-7 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded"
                        title="Delete URL"
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-[#334155] bg-slate-50/50 dark:bg-[#0F172A]/50 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div>
            <span>All entries are synced directly with your personal Firestore collection.</span>
          </div>
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
