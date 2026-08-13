import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { AnimatePresence } from 'motion/react';
import { Badge } from '../../../components/ui/badge';
import { KanbanCard } from './KanbanCard';
import type { JobApplication, JobStage } from '../../../types';

interface ColumnProps {
  stage: JobStage;
  apps: JobApplication[];
}

export const Column: React.FC<ColumnProps> = ({ stage, apps }) => {
  const { setNodeRef } = useDroppable({ id: stage });

  return (
    <div className="w-80 flex-shrink-0 flex flex-col h-full max-h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-slate-600 dark:text-slate-300">{stage}</h3>
        <Badge variant="outline">
          {apps.length}
        </Badge>
      </div>
      <div 
        ref={setNodeRef}
        className="flex-1 space-y-4 overflow-y-auto min-h-[150px] p-1 rounded-xl bg-slate-100/50 dark:bg-[#0F172A]/50 border border-dashed border-slate-200 dark:border-[#334155]/50"
      >
        <AnimatePresence>
          {apps.map(app => (
            <KanbanCard 
              key={app.id} 
              app={app} 
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
