import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { AnimatePresence } from 'motion/react';
import { Plus } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { KanbanCard } from './KanbanCard';
import type { JobApplication, JobStage } from '../../../types';

interface ColumnProps {
  stage: JobStage;
  apps: JobApplication[];
  onAddJob?: () => void;
}

export const Column: React.FC<ColumnProps> = ({ stage, apps, onAddJob }) => {
  const { setNodeRef } = useDroppable({ id: stage });

  return (
    <div className="w-[85vw] sm:w-80 shrink-0 flex flex-col h-full max-h-full snap-center">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <h3 className="font-medium text-slate-600 dark:text-slate-300">{stage}</h3>
          <Badge variant="outline">{apps.length}</Badge>
        </div>
        {stage === 'Targeting' && onAddJob && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onAddJob}
            title="Add job to Targeting"
            className="h-7 w-7 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg"
          >
            <Plus size={15} />
          </Button>
        )}
      </div>
      <div
        ref={setNodeRef}
        className="flex-1 space-y-4 overflow-y-auto min-h-[150px] p-1 rounded-xl bg-slate-100/50 dark:bg-[#0F172A]/50 border border-dashed border-slate-200 dark:border-[#334155]/50"
      >
        <AnimatePresence>
          {apps.map((app) => (
            <KanbanCard key={app.id} app={app} />
          ))}
        </AnimatePresence>

        {apps.length === 0 && stage === 'Targeting' && onAddJob && (
          <div
            onClick={onAddJob}
            className="h-32 flex flex-col items-center justify-center p-4 text-center border border-dashed border-slate-300 dark:border-slate-800 rounded-xl hover:border-indigo-400 dark:hover:border-indigo-500 cursor-pointer transition-colors group bg-white/40 dark:bg-slate-900/20"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 mb-2 group-hover:scale-110 transition-transform">
              <Plus size={16} />
            </div>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 group-hover:text-indigo-500">
              Drop or add a job URL
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              Extract details for tracking
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
