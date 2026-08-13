import React from 'react';
import { usePerformanceMetrics } from '../hooks/usePerformanceMetrics';
import { MetricsCards } from './MetricsCards';
import { FunnelChart } from './FunnelChart';
import { TimeInStageChart } from './TimeInStageChart';

export default function PerformanceView() {
  const { data: metrics, isLoading, isError } = usePerformanceMetrics();

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse text-slate-500 font-medium">Loading metrics...</div>
      </div>
    );
  }

  if (isError || !metrics) {
    return (
      <div className="h-full flex items-center justify-center text-red-500">
        Failed to load performance metrics.
      </div>
    );
  }

  const avgTimeInStage = metrics.timeData.length 
    ? Math.round(metrics.timeData.reduce((acc, curr) => acc + curr.avgDays, 0) / metrics.timeData.length) 
    : 0;

  return (
    <div className="h-full p-8 overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">
          Interview Performance
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Visualize your application pipeline and identify bottlenecks.
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
