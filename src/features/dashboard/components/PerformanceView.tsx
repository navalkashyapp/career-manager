import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePerformanceMetrics } from '../hooks/usePerformanceMetrics';
import { MetricsCards } from './MetricsCards';
import { FunnelChart } from './FunnelChart';
import { TimeInStageChart } from './TimeInStageChart';
import { Button } from '../../../components/ui/button';
import { BarChart3, PlusCircle } from 'lucide-react';

export default function PerformanceView() {
  const { data: metrics, isLoading, isError } = usePerformanceMetrics();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-slate-500 font-medium">Loading Firestore performance metrics...</div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="h-full flex items-center justify-center p-8 text-center">
        <div className="max-w-md bg-rose-500/10 border border-rose-500/20 rounded-xl p-6 text-rose-400">
          <p className="font-semibold text-lg mb-1">Failed to load performance metrics</p>
          <p className="text-sm opacity-80 mb-4">
            An error occurred while fetching your applications from Firestore.
          </p>
          <Button variant="outline" onClick={() => window.location.reload()} className="text-xs">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!metrics || metrics.totalApplied === 0) {
    return (
      <div className="h-full p-8 flex flex-col items-center justify-center text-center">
        <div className="p-4 bg-indigo-500/10 text-indigo-400 rounded-2xl mb-4">
          <BarChart3 size={40} />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          No Applications in Pipeline
        </h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md mb-6 text-sm">
          Add target roles to your Kanban board to start tracking conversion funnel metrics, stage
          survival rates, and bottleneck durations in real time.
        </p>
        <Button onClick={() => navigate('/board')} className="flex items-center gap-2">
          <PlusCircle size={16} />
          Go to Kanban Board
        </Button>
      </div>
    );
  }

  const avgTimeInStage = metrics.timeData.length
    ? Math.round(
        metrics.timeData.reduce((acc, curr) => acc + curr.avgDays, 0) / metrics.timeData.length,
      )
    : 0;

  return (
    <div className="h-full p-8 overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">
          Interview Performance
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Real-time Firestore application pipeline metrics, conversion rates, and stage bottlenecks.
        </p>
      </div>

      <MetricsCards
        totalApplied={metrics.totalApplied}
        overallConversion={metrics.overallConversion}
        avgTimeInStage={avgTimeInStage}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <FunnelChart data={metrics.funnelData} />
        <TimeInStageChart data={metrics.timeData} />
      </div>
    </div>
  );
}
