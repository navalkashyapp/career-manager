import React, { useEffect, useState } from 'react';
import { useGmail } from '../../../hooks/useGmail';
import { useData } from '../../../hooks/useData';
import { Mail, RefreshCw, Send, Sparkles, User, X, CheckSquare, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../../lib/utils';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import {
  Card as ShadcnCard,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '../../../components/ui/card';
import { apiUrl, apiFetch } from '../../../config/api';

const EMAIL_TEMPLATES = [
  {
    id: 'follow-up',
    name: 'Follow-up on Application',
    subject: 'Following up on my application for [Role]',
    body: `Hi [Name],

I hope this email finds you well.

I am writing to follow up on my application for the [Role] position. I am very interested in this opportunity and believe my background aligns well with the team's goals.

Please let me know if you need any additional information from my end.

Best regards,
[Your Name]`,
  },
  {
    id: 'thank-you',
    name: 'Interview Thank You',
    subject: 'Thank you for your time - [Your Name]',
    body: `Hi [Name],

Thank you for taking the time to speak with me today about the [Role] position. It was great learning more about the team's focus on [Specific Topic].

I'm very excited about the opportunity to contribute to the team. Please let me know if you need anything else from me as you move forward in the process.

Best regards,
[Your Name]`,
  },
  {
    id: 'networking',
    name: 'Networking / Coffee Chat',
    subject: 'Connecting regarding [Topic/Role]',
    body: `Hi [Name],

I hope you're having a good week.

I came across your profile and was impressed by your work at [Company]. I am currently exploring opportunities in [Field/Role] and would love to learn more about your experience there.

Would you be open to a brief 15-minute chat sometime next week?

Thanks,
[Your Name]`,
  },
];

export default function Inbox() {
  const { messages, loading: gmailLoading, fetchMessages, sendEmail } = useGmail();
  const { profile, applications, loading: dataLoading, error: dataError } = useData();
  const [selectedAppId, setSelectedAppId] = useState('');
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [composeType, setComposeType] = useState<'REFERRAL' | 'FOLLOWUP' | 'THANKYOU'>('REFERRAL');

  const [summaryMsgId, setSummaryMsgId] = useState<string | null>(null);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  useEffect(() => {
    fetchMessages();
  }, []);

  const handleGenerateDraft = async () => {
    if (!selectedAppId) return;
    const app = applications.find((a) => a.id === selectedAppId);
    if (!app) return;

    setIsDrafting(true);
    try {
      const res = await apiFetch(apiUrl('/api/gemini/draft-outreach'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jdText: app.rawJobDescription,
          profileData: profile,
          messageType: composeType,
        }),
      });
      const data = await res.json();
      setComposeSubject(data.subject || '');
      setComposeBody(data.body || '');
      if (app.contacts.length > 0) {
        setComposeTo(app.contacts[0].email);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsDrafting(false);
    }
  };

  const handleSend = async () => {
    const confirmed = window.confirm(`Are you sure you want to send this email to ${composeTo}?`);
    if (!confirmed) return;

    setIsSending(true);
    try {
      await sendEmail(composeTo, composeSubject, composeBody.replace(/\n/g, '<br>'));
      alert('Email sent successfully!');
      setComposeSubject('');
      setComposeBody('');
      setComposeTo('');
    } catch (err) {
      alert('Failed to send email.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSummarize = async (msg: any) => {
    setSummaryMsgId(msg.id);
    setSummaryData(null);
    setIsSummarizing(true);
    try {
      let emailContent = msg.snippet;

      // Try to get full text if available
      if (msg.payload) {
        if (msg.payload.parts) {
          const textPart =
            msg.payload.parts.find((p: any) => p.mimeType === 'text/plain') || msg.payload.parts[0];
          if (textPart?.body?.data) {
            emailContent = atob(textPart.body.data.replace(/-/g, '+').replace(/_/g, '/'));
          }
        } else if (msg.payload.body?.data) {
          emailContent = atob(msg.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        }
      }

      const res = await apiFetch(apiUrl('/api/gemini/summarize-email'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailContent }),
      });
      const data = await res.json();
      setSummaryData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSummarizing(false);
    }
  };

  if (dataLoading) {
    return (
      <div className="h-full flex flex-col p-8 overflow-hidden animate-pulse">
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-3">
            <div className="h-8 w-48 bg-white dark:bg-[#1E293B] rounded-lg"></div>
            <div className="h-4 w-64 bg-white dark:bg-[#1E293B] rounded-lg"></div>
          </div>
          <div className="h-10 w-10 bg-white dark:bg-[#1E293B] rounded-lg"></div>
        </div>
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-0">
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl"></div>
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (dataError) {
    return <div className="p-8 text-rose-400">Error loading data: {dataError}</div>;
  }

  return (
    <div className="h-full flex flex-col p-4 md:p-8 overflow-y-auto md:overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 md:mb-8 gap-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">
            Recruiter Hub
          </h1>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 mt-1">
            Manage communications and AI outreach
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchMessages} disabled={gmailLoading}>
          <RefreshCw size={20} className={cn(gmailLoading && 'animate-spin')} />
        </Button>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 min-h-0 pb-6 md:pb-0">
        <div className="flex flex-col bg-white/50 dark:bg-[#1E293B]/50 border border-slate-200 dark:border-[#334155] rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-[#334155] bg-slate-100/50 dark:bg-[#0F172A]/50">
            <h3 className="font-medium text-slate-900 dark:text-white flex items-center space-x-2">
              <Mail size={18} className="text-slate-500 dark:text-slate-400" />
              <span>Recent Inbox (Gmail Sync)</span>
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {gmailLoading ? (
              <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                <RefreshCw size={24} className="animate-spin mb-3 text-indigo-400" />
                Loading messages...
              </div>
            ) : messages.length === 0 ? (
              <div className="p-8 text-center text-slate-500">No messages found.</div>
            ) : (
              <div className="space-y-1">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-4 rounded-xl hover:bg-slate-200 dark:hover:bg-[#334155]/50 transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-[#334155] group"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-slate-700 dark:text-slate-200 truncate pr-4">
                        {msg.from.split('<')[0]}
                      </span>
                      <span className="text-xs text-slate-500 whitespace-nowrap">
                        {msg.date ? formatDistanceToNow(new Date(msg.date)) : ''} ago
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 truncate">
                      {msg.subject}
                    </p>
                    <p className="text-xs text-slate-500 truncate mt-1 mb-3">{msg.snippet}</p>
                    <div className="flex justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSummarize(msg);
                        }}
                        className="h-8 text-xs bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border-indigo-500/20 hover:text-indigo-400"
                      >
                        <Sparkles size={14} className="mr-1.5" />
                        Summarize Thread
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col bg-white/50 dark:bg-[#1E293B]/50 border border-slate-200 dark:border-[#334155] rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-[#334155] bg-slate-100/50 dark:bg-[#0F172A]/50 flex justify-between items-center">
            <h3 className="font-medium text-slate-900 dark:text-white flex items-center space-x-2">
              <Sparkles size={18} className="text-indigo-400" />
              <span>AI Outreach Generator</span>
            </h3>
          </div>
          <div className="p-6 flex-1 overflow-y-auto space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Target Application
              </label>
              <select
                value={selectedAppId}
                onChange={(e) => setSelectedAppId(e.target.value)}
                className="w-full bg-slate-100 dark:bg-[#0F172A] border border-slate-200 dark:border-[#334155] rounded-lg px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Select an application...</option>
                {applications.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.companyName} - {app.jobTitle}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Message Type
              </label>
              <div className="flex flex-col sm:flex-row bg-slate-100 dark:bg-[#0F172A] p-1 rounded-lg border border-slate-200 dark:border-[#334155] gap-1 sm:gap-0">
                {(['REFERRAL', 'FOLLOWUP', 'THANKYOU'] as const).map((type) => (
                  <Button
                    key={type}
                    variant={composeType === type ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setComposeType(type)}
                    className="flex-1"
                  >
                    {type.charAt(0) + type.slice(1).toLowerCase()}
                  </Button>
                ))}
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleGenerateDraft}
              disabled={isDrafting || !selectedAppId}
              className="w-full bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border-indigo-500/30 hover:text-indigo-400"
            >
              <Sparkles size={16} className="mr-2" />
              {isDrafting ? 'Generating Draft...' : 'Generate AI Draft'}
            </Button>

            <div className="pt-4 border-t border-slate-200 dark:border-[#334155] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider flex-shrink-0">
                  <FileText size={14} className="inline mr-1" />
                  Quick Templates
                </span>
                <select
                  onChange={(e) => {
                    const tpl = EMAIL_TEMPLATES.find((t) => t.id === e.target.value);
                    if (tpl) {
                      setComposeSubject(tpl.subject);
                      setComposeBody(tpl.body);
                    }
                    e.target.value = ''; // reset after selection
                  }}
                  className="w-full sm:flex-1 bg-slate-100 dark:bg-[#0F172A] border border-slate-200 dark:border-[#334155] rounded-lg px-3 py-2 sm:py-1.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Select a template to autofill...</option>
                  {EMAIL_TEMPLATES.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                type="text"
                placeholder="To (Email Address)"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
              />
              <Input
                type="text"
                placeholder="Subject"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
              />
              <Textarea
                placeholder="Message Body"
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                rows={8}
                className="resize-none leading-relaxed"
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleSend}
                  disabled={isSending || !composeTo || !composeSubject || !composeBody}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                >
                  <Send size={16} className="mr-2" />
                  {isSending ? 'Sending...' : 'Send Email'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {summaryMsgId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-200 dark:border-[#334155] flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="text-indigo-400" size={20} />
                  AI Thread Summary
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                  Generated from your email communication
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSummaryMsgId(null)}>
                <X size={20} />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {isSummarizing ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 py-12">
                  <RefreshCw size={32} className="animate-spin text-indigo-500 mb-4" />
                  <p>Analyzing email content and extracting action items...</p>
                </div>
              ) : summaryData ? (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                      Overview
                    </h4>
                    <p className="text-slate-700 dark:text-slate-200 leading-relaxed bg-slate-100/50 dark:bg-[#0F172A]/50 p-4 rounded-xl border border-slate-200 dark:border-[#334155]">
                      {summaryData.summary}
                    </p>
                  </div>

                  {summaryData.actionItems && summaryData.actionItems.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                        Action Items
                      </h4>
                      <ul className="space-y-3">
                        {summaryData.actionItems.map((item: string, i: number) => (
                          <li
                            key={i}
                            className="flex items-start bg-slate-100/50 dark:bg-[#0F172A]/50 p-3 rounded-xl border border-slate-200 dark:border-[#334155]"
                          >
                            <CheckSquare
                              size={18}
                              className="text-emerald-400 mt-0.5 mr-3 flex-shrink-0"
                            />
                            <span className="text-slate-700 dark:text-slate-200">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-rose-400 text-center py-8">
                  Failed to generate summary. Please try again.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
