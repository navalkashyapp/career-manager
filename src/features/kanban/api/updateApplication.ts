import { apiUrl, apiFetch } from '../../../config/api';
import { auth } from '../../../store/firebase';

export const updateApplication = async ({ id, data }: { id: string; data: any }): Promise<void> => {
  const token = await auth.currentUser?.getIdToken();
  const response = await apiFetch(apiUrl('/api/career-ops/tracker/update'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ id, data }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to update application');
  }
};
