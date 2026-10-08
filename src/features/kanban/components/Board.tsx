import React, { useState } from 'react';
import { useKanban } from '../hooks/useKanban';
import type { JobStage, JobApplication } from '../../../types';
import {
  DndContext,
  DragEndEvent,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Search, Filter, Plus, AlertCircle } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Column } from './Column';
import { TableView } from './TableView';
import { AddJobModal } from './AddJobModal';
import { JobDetailsModal } from './JobDetailsModal';

import { useUIStore } from '../../../store/useUIStore';

const STAGES: JobStage[] = [
  'Targeting',
  'Referral Requested',
  'Applied',
  'Recruiter Screen',
  'Technical Loop',
  'Onsite',
  'Offer Extended',
  'Archived',
];

export default function Board() {
  const { applications, updateStage, isLoading, error } = useKanban();
  const [view, setView] = useState<'kanban' | 'table'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobStage | 'All'>('All');
  const [isAddJobOpen, setIsAddJobOpen] = useState(false);

  const { activeModal, activeApp, openModal, closeModal } = useUIStore();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const stage = over.id as JobStage;
      updateStage(active.id as string, stage);
    }
  };

  const filteredApplications = applications.filter((app: JobApplication) => {
    const matchesSearch =
      app.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.jobTitle.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || app.stage === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="h-full flex flex-col p-8 animate-pulse">
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-3">
            <div className="h-8 w-48 bg-white dark:bg-[#1E293B] rounded-lg"></div>
            <div className="h-4 w-32 bg-white dark:bg-[#1E293B] rounded-lg"></div>
          </div>
          <div className="flex space-x-4">
            <div className="h-10 w-32 bg-white dark:bg-[#1E293B] rounded-lg"></div>
            <div className="h-10 w-24 bg-white dark:bg-[#1E293B] rounded-lg"></div>
          </div>
        </div>
        <div className="flex-1 flex space-x-6 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-80 flex-shrink-0 flex flex-col h-full space-y-4">
              <div className="h-6 w-32 bg-white dark:bg-[#1E293B] rounded-md"></div>
              <div className="flex-1 bg-slate-100/50 dark:bg-[#0F172A]/50 rounded-xl border border-dashed border-slate-200 dark:border-[#334155]/50 p-2 space-y-4">
                <div className="h-32 bg-white dark:bg-[#1E293B] rounded-xl"></div>
                <div className="h-32 bg-white dark:bg-[#1E293B] rounded-xl"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 mb-4">
          <AlertCircle size={24} />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
          Error Loading Board
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors"
        >
          Reload Page
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 md:p-8">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-6 md:mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">
            Applications
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Pipeline & Progress Tracking</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 dark:text-slate-400"
            />
            <Input
              type="text"
              placeholder="Search company or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-full sm:w-64"
            />
          </div>

          <div className="relative hidden sm:block">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as JobStage | 'All')}
              className="appearance-none pl-9 pr-8 py-2 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="All">All Stages</option>
              {STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
            <Filter
              size={16}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none"
            />
          </div>

          <div className="bg-white dark:bg-[#1E293B] p-1 rounded-lg border border-slate-200 dark:border-[#334155] flex">
            <Button
              variant="ghost"
              size="sm"
              className={
                view === 'kanban'
                  ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400'
                  : 'text-slate-500 dark:text-slate-400'
              }
              onClick={() => setView('kanban')}
            >
              Board
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={
                view === 'table'
                  ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400'
                  : 'text-slate-500 dark:text-slate-400'
              }
              onClick={() => setView('table')}
            >
              Table
            </Button>
          </div>

          <Button
            onClick={() => setIsAddJobOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white flex items-center space-x-1.5 shadow-sm"
          >
            <Plus size={16} />
            <span>Add a job</span>
          </Button>
        </div>
      </div>

      {view === 'kanban' ? (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
          <div className="flex-1 overflow-x-auto pb-4 snap-x snap-mandatory">
            <div className="flex space-x-4 md:space-x-6 h-full items-start w-max">
              {STAGES.filter((stage) => statusFilter === 'All' || stage === statusFilter).map(
                (stage) => (
                  <Column
                    key={stage}
                    stage={stage}
                    apps={filteredApplications.filter((a) => a.stage === stage)}
                    onAddJob={() => setIsAddJobOpen(true)}
                  />
                ),
              )}
            </div>
          </div>
        </DndContext>
      ) : (
        <TableView applications={filteredApplications} />
      )}

      <AddJobModal isOpen={isAddJobOpen} onClose={() => setIsAddJobOpen(false)} />

      {activeModal && activeApp && (
        <JobDetailsModal
          app={applications.find((a) => a.id === activeApp.id) || activeApp}
          onClose={closeModal}
          initialTab={
            activeModal === 'prep'
              ? 'prep'
              : activeModal === 'tailor'
                ? 'tailor'
                : activeModal === 'outreach'
                  ? 'outreach'
                  : 'description'
          }
        />
      )}
    </div>
  );
}
