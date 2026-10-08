import { useQuery } from '@tanstack/react-query';
import { getApplications } from '../api/getApplications';
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

export const usePerformanceMetrics = () => {
  return useQuery({
    queryKey: ['applications', 'metrics'],
    queryFn: getApplications,
    select: (applications) => {
      if (!applications.length) return null;

      const reachedStage = (targetStage: JobStage) => {
        const targetIndex = STAGE_ORDER.indexOf(targetStage);
        return applications.filter((app) => {
          if (app.stage === 'Archived') return false;
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

      const conversionData = funnelData.map((stage, i, arr) => {
        const prevCount = i === 0 ? stage.count : arr[i - 1].count;
        const rate = prevCount > 0 ? Math.round((stage.count / prevCount) * 100) : 0;
        return { ...stage, rate, dropoff: 100 - rate };
      });

      const timeData = STAGE_ORDER.map((stage) => {
        const appsInStage = applications.filter((a) => a.stage === stage);
        const totalDays = appsInStage.reduce((sum, app) => {
          const days = (Date.now() - app.updatedAt) / (1000 * 60 * 60 * 24);
          return sum + Math.max(0, days);
        }, 0);

        const avgDays = appsInStage.length > 0 ? Math.round(totalDays / appsInStage.length) : 0;

        return {
          name: stage.replace(' Screen', '').replace(' Extended', '').replace(' Requested', ''),
          avgDays,
          count: appsInStage.length,
        };
      }).filter((d) => d.name !== 'Targeting' && d.name !== 'Archived' && d.count > 0);

      return {
        funnelData: conversionData,
        timeData,
        totalApplied: funnelData[0].count,
        totalOffers: funnelData[4].count,
        overallConversion:
          funnelData[0].count > 0
            ? Math.round((funnelData[4].count / funnelData[0].count) * 100)
            : 0,
      };
    },
  });
};
