import type { JobApplication } from '../../../types';

export const getApplications = async (): Promise<JobApplication[]> => {
  const response = await fetch('/api/career-ops/tracker');
  if (!response.ok) {
    throw new Error('Failed to fetch applications');
  }
  return response.json();
};
