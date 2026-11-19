import { apiUrl, apiFetch } from '../../../config/api';
import { getIdTokenSafe } from '../../../store/firebase';
import type { UserProfile } from '../../../types';

export interface DraftOutreachParams {
  jdText: string;
  profileData?: UserProfile | any;
  messageType?: string;
  recipient?: {
    name?: string;
    role?: string;
    company?: string;
  };
  channel?: 'linkedin-connection-note' | 'linkedin-dm' | 'cold-email';
}

export interface DraftOutreachResponse {
  subject: string;
  body: string;
  finalMessage?: {
    subject: string;
    body: string;
  };
  draft?: {
    subject: string;
    body: string;
    angle?: string;
  };
  variants?: Array<{
    angle: string;
    subject: string;
    body: string;
  }>;
}

/**
 * Dispatches outreach drafting to the backend server.
 * Uses the authenticated /api/career-ops/draft-outreach route when a token exists,
 * with fallback to /api/gemini/draft-outreach.
 */
export const draftOutreach = async (
  params: DraftOutreachParams,
): Promise<DraftOutreachResponse> => {
  const token = await getIdTokenSafe();

  const endpoint = token
    ? apiUrl('/api/career-ops/draft-outreach')
    : apiUrl('/api/gemini/draft-outreach');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await apiFetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to generate outreach draft.');
  }

  return await res.json();
};
