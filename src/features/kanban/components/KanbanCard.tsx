import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { motion } from 'motion/react';
import { MoreHorizontal, Building2, MapPin, DollarSign, Activity, Sparkles } from 'lucide-react';
import { Target, ExternalLink } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Button } from '../../../components/ui/button';
import { useUIStore } from '../../../store/useUIStore';
import type { JobApplication } from '../../../types';

interface KanbanCardProps {
  app: JobApplication;
}

export const KanbanCard: React.FC<KanbanCardProps> = ({ app }) => {
  const { openModal } = useUIStore();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: app.id });
  
  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <motion.div
      layoutId={app.id}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] rounded-xl p-4 cursor-grab active:cursor-grabbing hover:border-indigo-500/50 transition-colors shadow-sm",
        isDragging && "z-50 opacity-80 shadow-xl ring-2 ring-indigo-500/50"
      )}
    >
      <div className="flex justify-between items-start mb-3">
        <h4 className="font-medium text-slate-900 dark:text-white text-sm leading-snug">{app.jobTitle}</h4>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-slate-600 dark:text-slate-300">
          <MoreHorizontal size={16} />
        </Button>
      </div>
      <div className="space-y-2 mb-4">
        <div className="flex items-center text-xs text-slate-500 dark:text-slate-400">
          <Building2 size={14} className="mr-1.5 text-slate-500" />
          {app.companyName}
        </div>
        <div className="flex items-center text-xs text-slate-500 dark:text-slate-400">
          <MapPin size={14} className="mr-1.5 text-slate-500" />
          {app.location}
        </div>
        {app.salaryRange && (
          <div className="flex items-center text-xs text-slate-500 dark:text-slate-400">
            <DollarSign size={14} className="mr-1.5 text-slate-500" />
            {app.salaryRange}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-[#334155]">
        <div className="flex items-center space-x-1.5 bg-indigo-500/10 px-2 py-1 rounded border border-indigo-500/20">
          <Activity size={12} className="text-indigo-400" />
          <span className="text-xs font-medium text-indigo-400">{app.matchScore}% Match</span>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="outline"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              openModal('prep', app);
            }}
            className="h-6 text-[10px] px-2 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/20 hover:text-fuchsia-400"
          >
            <Sparkles size={12} className="mr-1" />
            Prep
          </Button>
          <Button
            size="sm"
            variant="outline"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              openModal('tailor', app);
            }}
            className="h-6 text-[10px] px-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border-indigo-500/20 hover:text-indigo-400"
          >
            Tailor
          </Button>
          <Button
            size="sm"
            variant="outline"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              openModal('outreach', app);
            }}
            className="h-6 text-[10px] px-2 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border-sky-500/20 hover:text-sky-400"
          >
            Outreach
          </Button>
          <span className="text-[10px] text-slate-500 font-medium">{app.targetLevel}</span>
        </div>
      </div>
    </motion.div>
  );
};
