import React, { useState, useRef } from 'react';
import { useData } from '../../../hooks/useData';
import {
  FileText,
  Wand2,
  Search,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Save,
  History,
  SplitSquareHorizontal,
  Trash2,
  CloudUpload,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../../lib/utils';
import { ResumeVersion } from '../../../types';
import { getAccessToken } from '../../../store/firebase';
import html2pdf from 'html2pdf.js';
import { Button } from '../../../components/ui/button';
import { Textarea } from '../../../components/ui/textarea';
import { Badge } from '../../../components/ui/badge';
import { apiUrl, apiFetch } from '../../../config/api';

export default function ResumeStudio() {
  const { profile, updateProfile, loading, error } = useData();
  const [activeTab, setActiveTab] = useState<'tailor' | 'compare'>('tailor');

  // Tailor State
  const [jdText, setJdText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<{
    resumeMarkdown: string;
    matchScore: number;
    missingKeywords: string[];
    technicalSkills?: string[];
  } | null>(null);

  // Compare State
  const [v1, setV1] = useState<string>('');
  const [v2, setV2] = useState<string>('');

  // Saving State
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const resumeRef = useRef<HTMLDivElement>(null);

  const handleTailor = async () => {
    if (!jdText.trim()) return;
    setIsAnalyzing(true);

    try {
      const res = await apiFetch(apiUrl('/api/gemini/tailor-resume'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jdText, profileData: profile }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveVersion = async () => {
    if (!result) return;
    const name = prompt('Enter a name for this resume version (e.g. Google TPM):');
    if (!name) return;

    setIsSaving(true);
    try {
      const newVersion: ResumeVersion = {
        id: Date.now().toString(),
        name,
        timestamp: Date.now(),
        markdown: result.resumeMarkdown,
      };

      const updatedVersions = [...(profile?.resumeVersions || []), newVersion];
      await updateProfile({ resumeVersions: updatedVersions });
      alert('Version saved successfully!');
    } catch (e) {
      console.error(e);
      alert('Failed to save version.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteVersion = async (id: string) => {
    if (!confirm('Are you sure you want to delete this version?')) return;
    try {
      const updatedVersions = (profile?.resumeVersions || []).filter((v) => v.id !== id);
      await updateProfile({ resumeVersions: updatedVersions });
      if (v1 === id) setV1('');
      if (v2 === id) setV2('');
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportDrive = async () => {
    if (!result || !resumeRef.current) return;
    setIsExporting(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');

      // Generate PDF Blob
      const element = resumeRef.current;

      // We want to temporarily ensure text is dark for PDF if they are in dark mode
      const isDarkMode = document.documentElement.classList.contains('dark');
      const originalClasses = element.className;
      if (isDarkMode) {
        element.classList.remove(
          'dark:prose-invert',
          'text-white',
          'dark:text-white',
          'dark:bg-[#1E293B]',
        );
        element.classList.add('text-slate-900', 'bg-white');
      }

      const opt = {
        margin: 0.5,
        filename: 'resume.pdf',
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as const },
      };

      const pdfBlob = await html2pdf().set(opt).from(element).output('blob');

      // Revert classes
      if (isDarkMode) {
        element.className = originalClasses;
      }

      // Check for folder
      let folderId = null;
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent("name='Job Applications' and mimeType='application/vnd.google-apps.folder' and trashed=false")}&fields=files(id)`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        folderId = searchData.files[0].id;
      } else {
        // Create folder
        const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Job Applications',
            mimeType: 'application/vnd.google-apps.folder',
          }),
        });
        const createData = await createRes.json();
        folderId = createData.id;
      }

      // Upload file
      const metadata = {
        name: `Resume_Tailored_${Date.now()}.pdf`,
        parents: [folderId],
      };

      const formData = new FormData();
      formData.append(
        'metadata',
        new Blob([JSON.stringify(metadata)], { type: 'application/json' }),
      );
      formData.append('file', pdfBlob);

      await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      alert('Resume exported to Drive successfully!');
    } catch (e) {
      console.error(e);
      alert('Failed to export to Drive. Make sure you accepted the Drive permissions.');
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col p-8 overflow-hidden animate-pulse">
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-3">
            <div className="h-8 w-48 bg-white/50 dark:bg-[#1E293B]/50 rounded-lg"></div>
            <div className="h-4 w-64 bg-white/50 dark:bg-[#1E293B]/50 rounded-lg"></div>
          </div>
        </div>
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-0">
          <div className="bg-white/50 dark:bg-[#1E293B]/50 rounded-2xl"></div>
          <div className="bg-white/50 dark:bg-[#1E293B]/50 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="p-8 text-rose-400">Error loading data: {error}</div>;
  }

  const savedVersions = profile?.resumeVersions || [];
  const version1 = savedVersions.find((v) => v.id === v1);
  const version2 = savedVersions.find((v) => v.id === v2);

  return (
    <div className="h-full flex flex-col p-8 overflow-hidden">
      <div className="flex items-center justify-between mb-8 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">
            AI Resume Studio
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Tailor your profile and manage resume versions
          </p>
        </div>

        <div className="flex bg-slate-100 dark:bg-[#0F172A] p-1 rounded-lg border border-slate-200 dark:border-[#334155]">
          <Button
            variant={activeTab === 'tailor' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('tailor')}
          >
            <Wand2 size={16} className="mr-2" />
            Tailor
          </Button>
          <Button
            variant={activeTab === 'compare' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('compare')}
          >
            <History size={16} className="mr-2" />
            History & Compare
          </Button>
        </div>
      </div>

      {activeTab === 'tailor' ? (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-0">
          <div className="flex flex-col bg-white/50 dark:bg-[#1E293B]/50 border border-slate-200 dark:border-[#334155] rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-[#334155] bg-slate-100/50 dark:bg-[#0F172A]/50 flex items-center justify-between">
              <h3 className="font-medium text-slate-900 dark:text-white flex items-center space-x-2">
                <Search size={18} className="text-slate-500 dark:text-slate-400" />
                <span>Target Job Description</span>
              </h3>
              <Button
                onClick={handleTailor}
                disabled={isAnalyzing || !jdText.trim()}
                className="bg-indigo-500 hover:bg-indigo-600 text-white"
              >
                <Wand2 size={16} className="mr-2" />
                {isAnalyzing ? 'Analyzing...' : 'Tailor Resume'}
              </Button>
            </div>
            <Textarea
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="Paste the full job description here..."
              className="flex-1 w-full bg-transparent resize-none p-6 border-0 focus-visible:ring-0 shadow-none text-slate-600 dark:text-slate-300 leading-relaxed rounded-none"
            />
          </div>

          <div className="flex flex-col space-y-6 overflow-y-auto">
            {result ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="bg-white/50 dark:bg-[#1E293B]/50 border border-slate-200 dark:border-[#334155] rounded-2xl p-6 grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-4 uppercase tracking-wider">
                      ATS Match Score
                    </h3>
                    <div className="flex items-end space-x-3">
                      <span
                        className={cn(
                          'text-5xl font-semibold tracking-tighter',
                          result.matchScore > 85
                            ? 'text-emerald-400'
                            : result.matchScore > 70
                              ? 'text-amber-400'
                              : 'text-rose-400',
                        )}
                      >
                        {result.matchScore}%
                      </span>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-4 uppercase tracking-wider">
                      Missing Keywords
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {result.missingKeywords.map((kw) => (
                        <Badge
                          key={kw}
                          variant="destructive"
                          className="bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20 font-normal"
                        >
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-white/50 dark:bg-[#1E293B]/50 border border-slate-200 dark:border-[#334155] rounded-2xl overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-slate-200 dark:border-[#334155] bg-slate-100/50 dark:bg-[#0F172A]/50 flex items-center justify-between">
                    <h3 className="font-medium text-slate-900 dark:text-white flex items-center space-x-2">
                      <FileText size={18} className="text-slate-500 dark:text-slate-400" />
                      <span>Tailored Markdown Resume</span>
                    </h3>
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleExportDrive}
                        disabled={isExporting}
                        className="text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border-transparent hover:border-transparent"
                      >
                        <CloudUpload size={14} className="mr-1.5" />
                        {isExporting ? 'Exporting...' : 'Export to Drive'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigator.clipboard.writeText(result.resumeMarkdown)}
                        className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-500/10"
                      >
                        Copy
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSaveVersion}
                        disabled={isSaving}
                        className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border-transparent hover:border-transparent"
                      >
                        <Save size={14} className="mr-1.5" />
                        Save
                      </Button>
                    </div>
                  </div>
                  <div className="p-8 overflow-y-auto bg-white dark:bg-[#1E293B] text-slate-900 dark:text-white prose prose-sm dark:prose-invert max-w-none">
                    <div
                      ref={resumeRef}
                      className="bg-white dark:bg-[#1E293B] text-slate-900 dark:text-white prose prose-sm dark:prose-invert max-w-none p-4"
                    >
                      <ReactMarkdown>{result.resumeMarkdown}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12 border border-dashed border-slate-200 dark:border-[#334155] rounded-2xl bg-white/50 dark:bg-[#1E293B]/20">
                <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mb-6">
                  <Wand2 size={32} className="text-indigo-400" />
                </div>
                <h3 className="text-xl font-medium text-slate-900 dark:text-white mb-2">
                  AI-Powered Optimization
                </h3>
                <p className="text-slate-500 dark:text-slate-400 max-w-sm">
                  Paste a Job Description and let Gemini analyze the requirements, score your
                  profile, and generate a tailored resume.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 space-y-6">
          {savedVersions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 border border-dashed border-slate-200 dark:border-[#334155] rounded-2xl bg-white/50 dark:bg-[#1E293B]/20">
              <History size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
              <h3 className="text-xl font-medium text-slate-900 dark:text-white mb-2">
                No Saved Versions
              </h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-sm">
                You haven't saved any tailored resumes yet. Go back to the Tailor tab to generate
                and save your first version.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-shrink-0">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Version 1 (Left)
                  </label>
                  <select
                    value={v1}
                    onChange={(e) => setV1(e.target.value)}
                    className="w-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] rounded-lg px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Select a version...</option>
                    {savedVersions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({new Date(v.timestamp).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Version 2 (Right)
                  </label>
                  <select
                    value={v2}
                    onChange={(e) => setV2(e.target.value)}
                    className="w-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] rounded-lg px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Select a version to compare...</option>
                    {savedVersions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({new Date(v.timestamp).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-0">
                {/* Panel 1 */}
                <div className="flex flex-col bg-white/50 dark:bg-[#1E293B]/50 border border-slate-200 dark:border-[#334155] rounded-2xl overflow-hidden">
                  {version1 ? (
                    <>
                      <div className="p-4 border-b border-slate-200 dark:border-[#334155] bg-slate-100/50 dark:bg-[#0F172A]/50 flex items-center justify-between">
                        <h3 className="font-medium text-slate-900 dark:text-white flex items-center space-x-2">
                          <FileText size={18} className="text-slate-500 dark:text-slate-400" />
                          <span>{version1.name}</span>
                        </h3>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigator.clipboard.writeText(version1.markdown)}
                            className="text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10"
                          >
                            Copy
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteVersion(version1.id)}
                            className="h-8 w-8 text-rose-500 dark:text-rose-400 hover:bg-rose-500/10"
                            title="Delete Version"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                      <div className="p-8 overflow-y-auto bg-white dark:bg-[#1E293B] text-slate-900 dark:text-white prose prose-sm dark:prose-invert max-w-none flex-1">
                        <ReactMarkdown>{version1.markdown}</ReactMarkdown>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-transparent border-t border-slate-200 dark:border-transparent">
                      Select a version above to display
                    </div>
                  )}
                </div>

                {/* Panel 2 */}
                <div className="flex flex-col bg-white/50 dark:bg-[#1E293B]/50 border border-slate-200 dark:border-[#334155] rounded-2xl overflow-hidden">
                  {version2 ? (
                    <>
                      <div className="p-4 border-b border-slate-200 dark:border-[#334155] bg-slate-100/50 dark:bg-[#0F172A]/50 flex items-center justify-between">
                        <h3 className="font-medium text-slate-900 dark:text-white flex items-center space-x-2">
                          <FileText size={18} className="text-slate-500 dark:text-slate-400" />
                          <span>{version2.name}</span>
                        </h3>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigator.clipboard.writeText(version2.markdown)}
                            className="text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10"
                          >
                            Copy
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteVersion(version2.id)}
                            className="h-8 w-8 text-rose-500 dark:text-rose-400 hover:bg-rose-500/10"
                            title="Delete Version"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                      <div className="p-8 overflow-y-auto bg-white dark:bg-[#1E293B] text-slate-900 dark:text-white prose prose-sm dark:prose-invert max-w-none flex-1">
                        <ReactMarkdown>{version2.markdown}</ReactMarkdown>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-transparent border-t border-slate-200 dark:border-transparent">
                      Select a version above to compare
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
