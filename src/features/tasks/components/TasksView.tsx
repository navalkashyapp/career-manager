import React, { useState } from 'react';
import { useTasks, Task } from '../../../hooks/useTasks';
import { useData } from '../../../hooks/useData';
import { JobApplication } from '../../../types';
import { CheckCircle2, Circle, Clock, Trash2, Plus, Calendar as CalendarIcon, RefreshCw } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { format } from 'date-fns';

export default function TasksView() {
  const {
    taskLists,
    selectedListId,
    setSelectedListId,
    tasks,
    loadingLists,
    loadingTasks,
    error,
    createTask,
    updateTask,
    deleteTask,
    fetchTasks
  } = useTasks();

  const { applications, updateApplication } = useData();

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !selectedListId) return;
    
    setIsCreating(true);
    try {
      await createTask(selectedListId, newTaskTitle, newTaskNotes);
      setNewTaskTitle('');
      setNewTaskNotes('');
    } finally {
      setIsCreating(false);
    }
  };

  const toggleTaskStatus = async (task: Task) => {
    if (!selectedListId) return;
    const newStatus = task.status === 'completed' ? 'needsAction' : 'completed';
    await updateTask(selectedListId, { ...task, status: newStatus });
    // Note: Automated polling service handles stage advancement when interviews are completed.
  };

  if (loadingLists && taskLists.length === 0) {
    return (
      <div className="h-full p-8 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4 text-slate-500 dark:text-slate-400">
          <RefreshCw size={32} className="animate-spin text-indigo-500" />
          <p>Loading your tasks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full p-8">
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl">
          Error: {error}
        </div>
      </div>
    );
  }

  const activeTasks = tasks.filter(t => t.status === 'needsAction');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  return (
    <div className="h-full flex flex-col p-8 overflow-hidden">
      <div className="flex items-center justify-between mb-8 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">Google Tasks</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your action items and follow-ups</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <select
            value={selectedListId || ''}
            onChange={(e) => setSelectedListId(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            {taskLists.map(list => (
              <option key={list.id} value={list.id}>{list.title}</option>
            ))}
          </select>
          <button 
            onClick={() => selectedListId && fetchTasks(selectedListId)}
            disabled={loadingTasks}
            className="p-2 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white transition-colors"
          >
            <RefreshCw size={18} className={cn(loadingTasks && "animate-spin")} />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 flex flex-col bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-[#334155] overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-[#334155] bg-slate-100/50 dark:bg-[#0F172A]/30">
            <h2 className="font-medium text-slate-900 dark:text-white flex items-center">
              <span className="bg-indigo-500/20 text-indigo-400 py-0.5 px-2.5 rounded-full text-xs mr-3">
                {activeTasks.length} Active
              </span>
              Action Items
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loadingTasks && tasks.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-slate-500 dark:text-slate-400">
                <RefreshCw size={24} className="animate-spin" />
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-slate-500">
                <CheckCircle2 size={32} className="mb-2 opacity-20" />
                <p>No tasks found in this list.</p>
              </div>
            ) : (
              <>
                {activeTasks.map(task => (
                  <div key={task.id} className="flex items-start p-4 bg-slate-100/50 dark:bg-[#0F172A]/50 rounded-xl border border-slate-200 dark:border-[#334155] group hover:border-indigo-500/30 transition-colors">
                    <button 
                      onClick={() => toggleTaskStatus(task)}
                      className="mt-0.5 mr-4 text-slate-500 hover:text-indigo-400 transition-colors flex-shrink-0"
                    >
                      <Circle size={20} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-slate-900 dark:text-white font-medium break-words">{task.title}</h4>
                      {task.notes && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 whitespace-pre-wrap break-words">{task.notes}</p>
                      )}
                      {task.due && (
                        <div className="flex items-center text-xs text-slate-500 mt-3 space-x-4">
                          <span className="flex items-center">
                            <CalendarIcon size={12} className="mr-1.5" />
                            Due: {format(new Date(task.due), 'MMM d, yyyy')}
                          </span>
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={() => selectedListId && deleteTask(selectedListId, task.id)}
                      className="ml-4 p-2 text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                
                {completedTasks.length > 0 && (
                  <div className="pt-4 mt-6 border-t border-slate-200 dark:border-[#334155]">
                    <h3 className="text-sm font-medium text-slate-500 mb-4 px-2">Completed ({completedTasks.length})</h3>
                    <div className="space-y-3 opacity-60">
                      {completedTasks.map(task => (
                        <div key={task.id} className="flex items-start p-4 bg-slate-100/50 dark:bg-[#0F172A]/30 rounded-xl border border-slate-200 dark:border-[#334155] group">
                          <button 
                            onClick={() => toggleTaskStatus(task)}
                            className="mt-0.5 mr-4 text-indigo-500 hover:text-indigo-400 transition-colors flex-shrink-0"
                          >
                            <CheckCircle2 size={20} />
                          </button>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-slate-500 dark:text-slate-400 font-medium line-through break-words">{task.title}</h4>
                          </div>
                          <button 
                            onClick={() => selectedListId && deleteTask(selectedListId, task.id)}
                            className="ml-4 p-2 text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-[#334155] p-6 h-fit">
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-6">Create Task</h3>
          <form onSubmit={handleCreateTask} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Title</label>
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="What needs to be done?"
                className="w-full bg-slate-100 dark:bg-[#0F172A] border border-slate-200 dark:border-[#334155] rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Notes (Optional)</label>
              <textarea
                value={newTaskNotes}
                onChange={(e) => setNewTaskNotes(e.target.value)}
                placeholder="Add any context or links..."
                className="w-full bg-slate-100 dark:bg-[#0F172A] border border-slate-200 dark:border-[#334155] rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors h-32 resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={isCreating || !newTaskTitle.trim() || !selectedListId}
              className="w-full flex items-center justify-center space-x-2 bg-indigo-500 hover:bg-indigo-600 text-white font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-50"
            >
              {isCreating ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <Plus size={18} />
              )}
              <span>Add to {taskLists.find(l => l.id === selectedListId)?.title || 'Tasks'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
