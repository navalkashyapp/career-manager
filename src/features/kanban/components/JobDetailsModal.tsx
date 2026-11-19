import React, { useState } from 'react';
import {
  X,
  Building2,
  MapPin,
  DollarSign,
  Layers,
  Calendar,
  ExternalLink,
  Sparkles,
  FileText,
  Activity,
  BrainCircuit,
  Send,
  BookOpen,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { useData } from '../../../hooks/useData';
import { useKanban } from '../hooks/useKanban';
import { formatDistanceToNow, format } from 'date-fns';
import type { JobApplication, JobStage } from '../../../types';

import { JobDescriptionTab } from './job-details/JobDescriptionTab';
import { JobNotesTab } from './job-details/JobNotesTab';
import { JobResumeTab } from './job-details/JobResumeTab';
import { JobInterviewPrepTab } from './job-details/JobInterviewPrepTab';
import { JobOutreachTab } from './job-details/JobOutreachTab';

export type DetailsTabType = 'description' | 'notes' | 'tailor' | 'prep' | 'outreach';

interface JobDetailsModalProps {
  app: JobApplication;
  onClose: () => void;
  initialTab?: DetailsTabType;
}

const ALL_STAGES: JobStage[] = [
  'Targeting',
  'Referral Requested',
  'Applied',
  'Recruiter Screen',
  'Technical Loop',
  'Onsite',
  'Offer Extended',
  'Archived',
];

export const JobDetailsModal: React.FC<JobDetailsModalProps> = ({
  app,
  onClose,
  initialTab = 'description',
}) => {
  const { updateStage } = useKanban();
  const { profiles, updateApplication } = useData();
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [activeTab, setActiveTab] = useState<DetailsTabType>(initialTab);

  const defaultProfile = profiles.find((p) => p.isDefault) || profiles[0];
  const activeProfile = selectedProfileId
    ? profiles.find((p) => p.id === selectedProfileId) || defaultProfile
    : defaultProfile;

  const handleUpdate = async (updates: Partial<JobApplication>) => {
    if (app.id) {
      await updateApplication(app.id, updates);
    }
  };

  const handleStageChange = (newStage: JobStage) => {
    updateStage(app.id, newStage);
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[100] sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#1E293B] sm:border border-slate-200 dark:border-[#334155] sm:rounded-2xl w-full h-[100dvh] sm:h-auto max-w-4xl sm:max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 md:p-6 border-b border-slate-200 dark:border-[#334155] flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50 dark:bg-[#0F172A]/50 relative">
          {/* Mobile Close Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute top-3 right-3 md:hidden text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <X size={20} />
          </Button>

          <div className="space-y-1.5 flex-1 min-w-0 pr-8 md:pr-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 font-medium"
              >
                {app.stage}
              </Badge>
              {app.matchScore && app.matchScore > 0 && (
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                >
                  <Activity size={12} className="mr-1" />
                  {app.matchScore}% Match
                </Badge>
              )}
              {app.jobUrl && (
                <a
                  href={app.jobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <ExternalLink size={12} />
                  <span>View Original Posting</span>
                </a>
              )}
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
              {app.jobTitle}
            </h2>
            <div className="flex items-center text-sm font-medium text-slate-600 dark:text-slate-300">
              <Building2 size={16} className="mr-1.5 text-slate-400" />
              <span>{app.companyName}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0 self-start md:self-center">
            <select
              value={app.stage}
              onChange={(e) => handleStageChange(e.target.value as JobStage)}
              className="text-xs py-1.5 px-2.5 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              {ALL_STAGES.map((s) => (
                <option key={s} value={s}>
                  Move to: {s}
                </option>
              ))}
            </select>
            <select
              value={activeProfile?.id || ''}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              className="text-xs py-1.5 px-2.5 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.profileName || (p.isDefault ? 'Main Profile' : 'Untitled Profile')}
                </option>
              ))}
            </select>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="hidden md:flex text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
            >
              <X size={20} />
            </Button>
          </div>
        </div>

        {/* Quick Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 md:p-5 bg-slate-100/50 dark:bg-[#0B0F17]/40 border-b border-slate-200 dark:border-[#334155] text-xs">
          <div className="space-y-1">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <MapPin size={13} className="text-slate-400" /> Location
            </span>
            <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
              {app.location || 'Remote / Unspecified'}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <DollarSign size={13} className="text-slate-400" /> Compensation
            </span>
            <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
              {app.salaryRange || 'Not disclosed'}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Layers size={13} className="text-slate-400" /> Target Level
            </span>
            <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
              {app.targetLevel || 'Standard'}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Calendar size={13} className="text-slate-400" /> Added
            </span>
            <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
              {app.createdAt ? format(new Date(app.createdAt), 'MMM d, yyyy') : 'Recently'}
            </p>
          </div>
        </div>

        {/* 5 Content Tabs */}
        <div className="px-5 md:px-6 pt-3 flex items-center justify-between border-b border-slate-200 dark:border-[#334155] overflow-x-auto no-scrollbar bg-white dark:bg-[#1E293B]">
          <div className="flex space-x-1 sm:space-x-3 min-w-max">
            <button
              onClick={() => setActiveTab('description')}
              className={`flex items-center gap-1.5 pb-3 px-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === 'description'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <FileText size={15} />
              <span>Job Description</span>
            </button>

            <button
              onClick={() => setActiveTab('notes')}
              className={`flex items-center gap-1.5 pb-3 px-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === 'notes'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <BookOpen size={15} />
              <span>Notes & Summary</span>
            </button>

            <button
              onClick={() => setActiveTab('tailor')}
              className={`flex items-center gap-1.5 pb-3 px-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === 'tailor'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <Sparkles size={15} className="text-indigo-500 dark:text-indigo-400" />
              <span>Tailor Resume</span>
            </button>

            <button
              onClick={() => setActiveTab('prep')}
              className={`flex items-center gap-1.5 pb-3 px-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === 'prep'
                  ? 'border-fuchsia-500 text-fuchsia-600 dark:text-fuchsia-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <BrainCircuit size={15} className="text-fuchsia-500 dark:text-fuchsia-400" />
              <span>Interview Prep</span>
            </button>

            <button
              onClick={() => setActiveTab('outreach')}
              className={`flex items-center gap-1.5 pb-3 px-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === 'outreach'
                  ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <Send size={15} className="text-sky-500 dark:text-sky-400" />
              <span>Draft Outreach</span>
            </button>
          </div>
        </div>

        {/* Main Body with Active Sub-Component */}
        <div className="p-5 md:p-6 overflow-y-auto flex-1 font-sans text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          {activeTab === 'description' && <JobDescriptionTab app={app} onUpdate={handleUpdate} />}

          {activeTab === 'notes' && <JobNotesTab app={app} onUpdate={handleUpdate} />}

          {activeTab === 'tailor' && (
            <JobResumeTab app={app} profile={activeProfile} onUpdate={handleUpdate} />
          )}

          {activeTab === 'prep' && <JobInterviewPrepTab app={app} onUpdate={handleUpdate} />}

          {activeTab === 'outreach' && (
            <JobOutreachTab app={app} profile={activeProfile} onUpdate={handleUpdate} />
          )}
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-slate-200 dark:border-[#334155] flex items-center justify-between bg-slate-50/50 dark:bg-[#0F172A]/50">
          <div className="text-xs text-slate-400">
            {app.updatedAt && (
              <span>Updated {formatDistanceToNow(new Date(app.updatedAt))} ago</span>
            )}
          </div>

          <Button
            variant="default"
            size="sm"
            onClick={onClose}
            className="text-xs h-9 px-4 font-medium cursor-pointer"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
