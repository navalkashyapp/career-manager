import { useMemo } from 'react';
import { useData } from '../../../hooks/useData';
import type { JobStage } from '../../../types';

const STAGE_ORDER: JobStage[] = [
  'Targeting',
  'Referral Requested',
  'Applied',
  'Recruiter Screen',
  'Technical Loop',
  'Onsite',
  'Offer Extended',
];

export interface FunnelStageMetric {
  name: string;
  count: number;
  color: string;
  rate: number;
  dropoff: number;
}

export interface TimeInStageMetric {
  name: string;
  avgDays: number;
  count: number;
}

export interface PerformanceMetricsResult {
  funnelData: FunnelStageMetric[];
  timeData: TimeInStageMetric[];
  totalApplied: number;
  totalOffers: number;
  overallConversion: number;
}

export const usePerformanceMetrics = () => {
  const { applications, loading, error } = useData();

  const metrics = useMemo<PerformanceMetricsResult | null>(() => {
    if (!applications || applications.length === 0) return null;

    // Filter out archived applications for active pipeline funnel
    const activeApps = applications.filter((app) => app.stage !== 'Archived');

    const reachedStage = (targetStage: JobStage) => {
      const targetIndex = STAGE_ORDER.indexOf(targetStage);
      return activeApps.filter((app) => {
        return STAGE_ORDER.indexOf(app.stage) >= targetIndex;
      }).length;
    };

    const funnelData = [
      { name: 'Applied', count: reachedStage('Applied'), color: '#3b82f6' },
      { name: 'Recruiter', count: reachedStage('Recruiter Screen'), color: '#8b5cf6' },
      { name: 'Tech Loop', count: reachedStage('Technical Loop'), color: '#ec4899' },
      { name: 'Onsite', count: reachedStage('Onsite'), color: '#f59e0b' },
      { name: 'Offer', count: reachedStage('Offer Extended'), color: '#10b981' },
    ];

    const conversionData: FunnelStageMetric[] = funnelData.map((stage, i, arr) => {
      const prevCount = i === 0 ? stage.count : arr[i - 1].count;
      const rate = prevCount > 0 ? Math.round((stage.count / prevCount) * 100) : 0;
      return { ...stage, rate, dropoff: 100 - rate };
    });

    const timeData: TimeInStageMetric[] = STAGE_ORDER.map((stage) => {
      const appsInStage = applications.filter((a) => a.stage === stage);
      const totalDays = appsInStage.reduce((sum, app) => {
        // Robust timestamp handling: prioritize updatedAt, then createdAt, fallback to Date.now()
        const rawTime = app.updatedAt ?? app.createdAt;
        const timestamp =
          typeof rawTime === 'number' && !isNaN(rawTime)
            ? rawTime
            : typeof rawTime === 'string' && !isNaN(new Date(rawTime).getTime())
              ? new Date(rawTime).getTime()
              : Date.now();

        const days = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
        return sum + Math.max(0, isNaN(days) ? 0 : days);
      }, 0);

      const avgDays = appsInStage.length > 0 ? Math.round(totalDays / appsInStage.length) : 0;

      return {
        name: stage.replace(' Screen', '').replace(' Extended', '').replace(' Requested', ''),
        avgDays,
        count: appsInStage.length,
      };
    }).filter((d) => d.name !== 'Targeting' && d.name !== 'Archived' && d.count > 0);

    const totalPipelineCount = activeApps.length;
    const appliedCount = funnelData[0].count;
    const totalOffers = funnelData[4].count;
    const overallConversion = appliedCount > 0 ? Math.round((totalOffers / appliedCount) * 100) : 0;

    return {
      funnelData: conversionData,
      timeData,
      totalApplied: totalPipelineCount,
      totalOffers,
      overallConversion,
    };
  }, [applications]);

  return {
    data: metrics,
    isLoading: loading,
    isError: !!error,
  };
};
