import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Trash2,
  ExternalLink,
  Loader2,
  Sparkles,
  X,
  RefreshCw,
  Info,
} from 'lucide-react';
import { apiUrl, apiFetch } from '../../config/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';

interface GeminiKeyMetadata {
  keyCount: number;
  maskedKeys: string[];
  updatedAt?: string;
  source: 'firestore' | 'environment' | 'none';
  ownerUid: string;
}

interface GeminiKeysModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeysUpdated?: () => void;
}

export default function GeminiKeysModal({ isOpen, onClose, onKeysUpdated }: GeminiKeysModalProps) {
  const [metadata, setMetadata] = useState<GeminiKeyMetadata | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

  // Form fields
  const [primaryKey, setPrimaryKey] = useState('');
  const [secondaryKey, setSecondaryKey] = useState('');
  const [showPrimary, setShowPrimary] = useState(false);
  const [showSecondary, setShowSecondary] = useState(false);

  // Verification state
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    valid: boolean;
    message?: string;
  } | null>(null);

  // Save / Delete states
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const fetchKeyMetadata = async () => {
    setIsLoadingMetadata(true);
    setFeedback(null);
    try {
      const res = await apiFetch(apiUrl('/api/gemini/keys'));
      if (res.ok) {
        const data = await res.json();
        setMetadata(data);
      }
    } catch (err: any) {
      console.error('Failed to load Gemini key metadata:', err);
    } finally {
      setIsLoadingMetadata(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchKeyMetadata();
      setPrimaryKey('');
      setSecondaryKey('');
      setVerificationResult(null);
      setFeedback(null);
    }
  }, [isOpen]);

  const handleTestKey = async () => {
    const keyToTest = primaryKey.trim();
    if (!keyToTest) {
      setVerificationResult({
        valid: false,
        message: 'Please enter a Primary Gemini API Key to test.',
      });
      return;
    }

    setIsVerifying(true);
    setVerificationResult(null);
    try {
      const res = await apiFetch(apiUrl('/api/gemini/keys/verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: keyToTest }),
      });
      const data = await res.json();
      if (data.valid) {
        setVerificationResult({
          valid: true,
          message: 'Key verified successfully with Google Gemini API!',
        });
      } else {
        setVerificationResult({
          valid: false,
          message: data.error || 'API key failed verification.',
        });
      }
    } catch (err: any) {
      setVerificationResult({
        valid: false,
        message: err.message || 'Network error verifying key.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPrimary = primaryKey.trim();
    const cleanSecondary = secondaryKey.trim();

    if (!cleanPrimary) {
      setFeedback({
        type: 'error',
        message: 'Primary Gemini API Key is required.',
      });
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      const apiKeys = [cleanPrimary, cleanSecondary].filter(Boolean);
      const res = await apiFetch(apiUrl('/api/gemini/keys'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKeys, validate: true }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save Gemini API keys.');
      }

      setFeedback({
        type: 'success',
        message: 'Gemini API keys updated successfully and cached for instant use.',
      });
      setMetadata(data);
      setPrimaryKey('');
      setSecondaryKey('');
      setVerificationResult(null);
      if (onKeysUpdated) onKeysUpdated();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'An unexpected error occurred while saving keys.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevertDefaults = async () => {
    if (
      !confirm(
        'Are you sure you want to delete your custom Gemini API keys and revert to system environment defaults?',
      )
    ) {
      return;
    }

    setIsDeleting(true);
    setFeedback(null);
    try {
      const res = await apiFetch(apiUrl('/api/gemini/keys'), {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to remove custom keys.');
      }

      setFeedback({
        type: 'success',
        message: 'Reverted to system environment API keys.',
      });
      setMetadata(data);
      setPrimaryKey('');
      setSecondaryKey('');
      setVerificationResult(null);
      if (onKeysUpdated) onKeysUpdated();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to delete custom keys.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 overflow-hidden z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                <KeyRound size={20} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  Gemini API Key Settings
                  <Sparkles size={16} className="text-amber-400" />
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Manage keys for resume tailoring, job evaluations, and agents
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg p-1.5 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Current Status Banner */}
          <div className="my-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-750">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Active Key Configuration
              </span>
              <button
                onClick={fetchKeyMetadata}
                disabled={isLoadingMetadata}
                title="Refresh key status"
                className="text-slate-400 hover:text-indigo-400 text-xs flex items-center gap-1 transition-colors"
              >
                <RefreshCw size={12} className={isLoadingMetadata ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>

            {isLoadingMetadata ? (
              <div className="flex items-center space-x-2 py-2 text-sm text-slate-500">
                <Loader2 size={16} className="animate-spin text-indigo-500" />
                <span>Checking API key status...</span>
              </div>
            ) : metadata ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {metadata.source === 'firestore' ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <ShieldCheck size={12} />
                        Custom Firestore Secrets
                      </Badge>
                    ) : metadata.source === 'environment' ? (
                      <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1">
                        <Info size={12} />
                        Server Environment Defaults
                      </Badge>
                    ) : (
                      <Badge className="bg-rose-500/10 text-rose-500 border border-rose-500/20">
                        No Keys Found
                      </Badge>
                    )}
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      ({metadata.keyCount} {metadata.keyCount === 1 ? 'key' : 'keys'} active)
                    </span>
                  </div>

                  {metadata.updatedAt && (
                    <span className="text-[11px] text-slate-400">
                      Updated {new Date(metadata.updatedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {metadata.maskedKeys.length > 0 && (
                  <div className="pt-2 flex flex-wrap gap-2">
                    {metadata.maskedKeys.map((masked, index) => (
                      <span
                        key={index}
                        className="px-2.5 py-1 text-xs font-mono rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 shadow-2xs"
                      >
                        {index === 0 ? 'Primary: ' : 'Fallback: '}
                        {masked}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Unable to load key status.</p>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSaveKeys} className="space-y-4">
            {/* Primary Key Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Primary Gemini API Key <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleTestKey}
                  disabled={isVerifying || !primaryKey.trim()}
                  className="text-xs font-medium text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 disabled:opacity-50 flex items-center gap-1 transition-colors"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Testing...
                    </>
                  ) : (
                    'Verify Key'
                  )}
                </button>
              </div>

              <div className="relative">
                <Input
                  type={showPrimary ? 'text' : 'password'}
                  value={primaryKey}
                  onChange={(e) => {
                    setPrimaryKey(e.target.value);
                    setVerificationResult(null);
                  }}
                  placeholder="AIzaSy..."
                  className="pr-10 font-mono text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPrimary(!showPrimary)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPrimary ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Verification Feedback Banner */}
              {verificationResult && (
                <div
                  className={`mt-2 p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                    verificationResult.valid
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {verificationResult.valid ? (
                    <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  )}
                  <span>{verificationResult.message}</span>
                </div>
              )}
            </div>

            {/* Secondary / Fallback Key Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Secondary / Fallback API Key{' '}
                  <span className="text-xs text-slate-400 font-normal">(Optional)</span>
                </label>
              </div>

              <div className="relative">
                <Input
                  type={showSecondary ? 'text' : 'password'}
                  value={secondaryKey}
                  onChange={(e) => setSecondaryKey(e.target.value)}
                  placeholder="AIzaSy... (used automatically if primary hits quota 429)"
                  className="pr-10 font-mono text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                />
                <button
                  type="button"
                  onClick={() => setShowSecondary(!showSecondary)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showSecondary ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                Rotates automatically if the primary key experiences high demand (503) or rate
                limits.
              </p>
            </div>

            {/* Google AI Studio Helper Link */}
            <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between">
              <span>Need a new or replacement API key?</span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 shrink-0 ml-2"
              >
                Get API Key on Google AI Studio
                <ExternalLink size={12} />
              </a>
            </div>

            {/* Global Error/Success Message */}
            {feedback && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  feedback.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                }`}
              >
                {feedback.type === 'success' ? (
                  <CheckCircle2 size={16} className="shrink-0" />
                ) : (
                  <AlertCircle size={16} className="shrink-0" />
                )}
                <span>{feedback.message}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
              {metadata?.source === 'firestore' ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRevertDefaults}
                  disabled={isDeleting || isSaving}
                  className="text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-1.5"
                >
                  {isDeleting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                  Revert to System Defaults
                </Button>
              ) : (
                <div />
              )}

              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  disabled={isSaving}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSaving || !primaryKey.trim()}
                  className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-1.5"
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Saving & Applying...
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={14} />
                      Save & Apply Keys
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
