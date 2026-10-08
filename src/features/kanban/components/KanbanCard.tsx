import React, { useState, useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { motion } from 'motion/react';
import { Trash2, Building2, MapPin, DollarSign, Activity, Sparkles, Calendar } from 'lucide-react';
import { Target, ExternalLink } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { cn } from '../../../lib/utils';
import { Button } from '../../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../components/ui/dialog';
import { useUIStore } from '../../../store/useUIStore';
import { useData } from '../../../hooks/useData';
import type { JobApplication } from '../../../types';

interface KanbanCardProps {
  app: JobApplication;
}

export const KanbanCard: React.FC<KanbanCardProps> = ({ app }) => {
  const { openModal } = useUIStore();
  const { deleteApplication, updateApplication } = useData();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: app.id });
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleClick = (e: React.MouseEvent) => {
    if (pointerStartRef.current) {
      const dx = Math.abs(e.clientX - pointerStartRef.current.x);
      const dy = Math.abs(e.clientY - pointerStartRef.current.y);
      if (dx > 6 || dy > 6) {
        return; // user dragged, don't open modal
      }
    }
    openModal('details', app);
  };

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
        'bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] rounded-xl p-4 cursor-pointer hover:border-indigo-500/50 hover:shadow-md transition-all shadow-sm',
        isDragging && 'z-50 opacity-80 shadow-xl ring-2 ring-indigo-500/50 cursor-grabbing',
      )}
      onPointerDownCapture={handlePointerDown}
      onClick={handleClick}
    >
      <div className="flex justify-between items-start mb-3">
        <h4
          className="font-medium text-slate-900 dark:text-white text-sm leading-snug hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            openModal('details', app);
          }}
        >
          {app.jobTitle}
        </h4>
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="h-6 w-6 text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-rose-500/10"
            >
              <Trash2 size={14} />
            </Button>
          </DialogTrigger>
          <DialogContent
            className="sm:max-w-[425px] border-slate-200 dark:border-[#334155] bg-white dark:bg-[#1E293B]"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <DialogHeader>
              <DialogTitle className="text-slate-900 dark:text-white">
                Delete Application
              </DialogTitle>
              <DialogDescription className="text-slate-500 dark:text-slate-400">
                Are you sure you want to delete this application for{' '}
                <strong>{app.companyName}</strong>? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4 sm:space-x-2">
              <Button
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDeleteDialogOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="bg-rose-500 hover:bg-rose-600 text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDeleteDialogOpen(false);
                  deleteApplication(app.id);
                }}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center min-w-0">
            <Building2 size={14} className="mr-1.5 text-slate-500 shrink-0" />
            <span className="truncate">{app.companyName}</span>
          </div>
          {app.jobUrl && (
            <a
              href={app.jobUrl}
              target="_blank"
              rel="noopener noreferrer"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              title="Open job posting"
              className="ml-1 text-slate-400 hover:text-indigo-500 transition-colors p-0.5"
            >
              <ExternalLink size={12} />
            </a>
          )}
        </div>
        <div className="flex items-center text-xs text-slate-500 dark:text-slate-400">
          <MapPin size={14} className="mr-1.5 text-slate-500 shrink-0" />
          <span className="truncate">{app.location || 'Remote / Unspecified'}</span>
        </div>
        {app.salaryRange && (
          <div className="flex items-center text-xs text-slate-500 dark:text-slate-400">
            <DollarSign size={14} className="mr-1.5 text-slate-500 shrink-0" />
            <span className="truncate">{app.salaryRange}</span>
          </div>
        )}
        <div
          className="flex items-center text-xs text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800"
          onPointerDown={(e) => {
            // Let the datepicker handle its own pointer events without dragging
            e.stopPropagation();
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Calendar size={14} className="mr-1.5 text-slate-500 shrink-0" />
          <DatePicker
            selected={app.nextEventDate ? new Date(app.nextEventDate + 'T12:00:00') : null}
            onChange={(date: Date | null) => {
              try {
                if (date) {
                  const yyyy = date.getFullYear();
                  const mm = String(date.getMonth() + 1).padStart(2, '0');
                  const dd = String(date.getDate()).padStart(2, '0');
                  updateApplication(app.id, { nextEventDate: `${yyyy}-${mm}-${dd}` });
                } else {
                  updateApplication(app.id, { nextEventDate: undefined });
                }
              } catch (err) {
                console.error('Failed to update next event date:', err);
              }
            }}
            customInput={
              <input
                className="bg-transparent border-none text-xs p-0 focus:ring-0 text-slate-600 dark:text-slate-300 w-full cursor-pointer"
                placeholder="Next event date"
              />
            }
            dateFormat="MMM d, yyyy"
            isClearable
            portalId="root"
          />
        </div>
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-[#334155]">
        {app.matchScore && app.matchScore > 0 ? (
          <div className="flex items-center space-x-1.5 bg-indigo-500/10 px-2 py-1 rounded border border-indigo-500/20">
            <Activity size={12} className="text-indigo-400" />
            <span className="text-xs font-medium text-indigo-400">{app.matchScore}% Match</span>
          </div>
        ) : (
          <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800/80 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
            <Target size={12} className="text-slate-400" />
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Targeting
            </span>
          </div>
        )}
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
