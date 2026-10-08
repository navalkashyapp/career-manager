import type { JobApplication } from '../../../types';
import { apiUrl, apiFetch } from '../../../config/api';
import { getIdTokenSafe } from '../../../store/firebase';

export const getApplications = async (): Promise<JobApplication[]> => {
  const token = await getIdTokenSafe();
  if (!token) {
    return [];
  }
  const response = await apiFetch(apiUrl('/api/career-ops/tracker'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch applications');
  }
  return response.json();
};
