import { useMemo } from 'react';
import type { JobApplication } from '../../../types';

export interface Nudge {
  app: JobApplication;
  reason: string;
  suggestedAction: string;
  urgency: 'high' | 'medium' | 'low';
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export const useSmartFollowUp = (applications: JobApplication[]) => {
  const nudges = useMemo(() => {
    const alerts: Nudge[] = [];
    const now = Date.now();

    applications.forEach(app => {
      const daysSinceUpdate = (now - app.updatedAt) / MS_PER_DAY;

      if (app.stage === 'Applied' && daysSinceUpdate > 7) {
        alerts.push({
          app,
          reason: `It's been ${Math.floor(daysSinceUpdate)} days since you applied.`,
          suggestedAction: 'Send a cold outreach to a recruiter or hiring manager to get your resume pulled from the pile.',
          urgency: 'medium'
        });
      }

      if (app.stage === 'Recruiter Screen' && daysSinceUpdate > 4) {
        alerts.push({
          app,
          reason: `It's been ${Math.floor(daysSinceUpdate)} days since your Recruiter Screen.`,
          suggestedAction: 'Send a polite follow-up asking about next steps.',
          urgency: 'high'
        });
      }

      if (app.stage === 'Technical Loop' && daysSinceUpdate > 5) {
        alerts.push({
          app,
          reason: `It's been ${Math.floor(daysSinceUpdate)} days since your Technical Loop.`,
          suggestedAction: 'Send a thank you note and reiterate your interest while you wait for results.',
          urgency: 'high'
        });
      }
      
      if (app.stage === 'Offer Extended' && daysSinceUpdate > 2) {
        alerts.push({
          app,
          reason: `You have a pending offer for ${Math.floor(daysSinceUpdate)} days.`,
          suggestedAction: 'Ensure you respond or negotiate before the deadline expires!',
          urgency: 'high'
        });
      }
    });

    return alerts.sort((a, b) => {
      if (a.urgency === 'high' && b.urgency !== 'high') return -1;
      if (a.urgency !== 'high' && b.urgency === 'high') return 1;
      return 0;
    });
  }, [applications]);

  return { nudges };
};
