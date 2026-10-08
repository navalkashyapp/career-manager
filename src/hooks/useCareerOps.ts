import { useQuery, useQueryClient } from '@tanstack/react-query';
import { auth, getIdTokenSafe } from '../store/firebase';
import { apiUrl, apiFetch } from '../config/api';

export function useCareerOps() {
  const queryClient = useQueryClient();

  const { data: trackerData, isLoading: isLoadingTracker } = useQuery({
    queryKey: ['careerOpsTracker'],
    queryFn: async () => {
      const token = await getIdTokenSafe();
      if (!token) return null;
      const res = await apiFetch(apiUrl('/api/career-ops/tracker'), {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!res.ok) throw new Error('Failed to fetch tracker data');
      return res.json();
    },
  });

  const evaluateJob = async (
    docId: string,
    jdText: string,
    profileData: any,
    onProgress?: (data: any) => void,
  ) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    return new Promise(async (resolve, reject) => {
      const controller = new AbortController();
      apiFetch(apiUrl('/api/career-ops/evaluate'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + (await user.getIdToken()),
        },
        body: JSON.stringify({ docId, userId: user.uid, jdText, profileData }),
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.body) throw new Error('No readable stream');
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let currentEvent = 'message';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim() === '') {
                currentEvent = 'message';
              } else if (line.startsWith('event: ')) {
                currentEvent = line.replace('event: ', '').trim();
              } else if (line.startsWith('data: ')) {
                const dataStr = line.replace('data: ', '').trim();
                if (dataStr) {
                  try {
                    const data = JSON.parse(dataStr);
                    if (currentEvent === 'progress' && onProgress) {
                      onProgress(data);
                    } else if (currentEvent === 'firestore_ready') {
                      resolve(data.result || data);
                    } else if (currentEvent === 'error') {
                      reject(new Error(data.message));
                    }
                  } catch (e) {}
                }
              }
            }
          }
        })
        .catch(reject);
    });
  };

  const evaluateJobUrl = async (
    docId: string,
    url: string,
    profileData: any,
    onProgress?: (data: any) => void,
  ) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    return new Promise(async (resolve, reject) => {
      const controller = new AbortController();
      apiFetch(apiUrl('/api/career-ops/evaluate-url'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + (await user.getIdToken()),
        },
        body: JSON.stringify({ docId, userId: user.uid, url, profileData }),
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.body) throw new Error('No readable stream');
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let currentEvent = 'message';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim() === '') {
                currentEvent = 'message';
              } else if (line.startsWith('event: ')) {
                currentEvent = line.replace('event: ', '').trim();
              } else if (line.startsWith('data: ')) {
                const dataStr = line.replace('data: ', '').trim();
                if (dataStr) {
                  try {
                    const data = JSON.parse(dataStr);
                    if (currentEvent === 'progress' && onProgress) {
                      onProgress(data);
                    } else if (currentEvent === 'firestore_ready') {
                      resolve(data.result || data);
                    } else if (currentEvent === 'error') {
                      reject(new Error(data.message));
                    }
                  } catch (e) {}
                }
              }
            }
          }
        })
        .catch(reject);
    });
  };

  const generateTailoredResume = async (
    jdText: string,
    profileData: any,
    onProgress?: (data: any) => void,
  ) => {
    return new Promise(async (resolve, reject) => {
      apiFetch(apiUrl('/api/career-ops/tailor-stream'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + (await auth.currentUser?.getIdToken()),
        },
        body: JSON.stringify({ jdText, profileData }),
      })
        .then(async (response) => {
          if (!response.body) throw new Error('No readable stream');
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let currentEvent = 'message';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim() === '') {
                currentEvent = 'message';
              } else if (line.startsWith('event: ')) {
                currentEvent = line.replace('event: ', '').trim();
              } else if (line.startsWith('data: ')) {
                const dataStr = line.replace('data: ', '').trim();
                if (dataStr) {
                  try {
                    const data = JSON.parse(dataStr);
                    if (currentEvent === 'progress' && onProgress) {
                      onProgress(data);
                    } else if (currentEvent === 'result') {
                      resolve(data);
                    } else if (currentEvent === 'error') {
                      reject(new Error(data.message));
                    }
                  } catch (e) {}
                }
              }
            }
          }
        })
        .catch(reject);
    });
  };

  const extractJobFromUrl = async (
    options: { url?: string; jdText?: string },
    onProgress?: (data: { phase: string; percentage: number }) => void,
  ): Promise<{
    companyName: string;
    companyDescription?: string;
    roleTitle?: string;
    jobTitle: string;
    roleDescription?: string;
    location: string;
    salaryRange: string;
    salary?: {
      raw: string;
      min?: number;
      max?: number;
      currency?: string;
      period?: 'year' | 'month' | 'hour' | 'unknown';
    };
    targetLevel: string;
    experienceLevel?: string;
    department?: string;
    requirements?: string[];
    keyRequirements: string[];
    niceToHaves?: string[];
    qualifications?: string[];
    responsibilities?: string[];
    benefits?: string[];
    remotePolicy?: 'remote' | 'hybrid' | 'on-site' | 'unknown';
    employmentType?: string;
    jobSummary?: string;
    rawJobDescription: string;
    jobUrl: string;
    pageType?: 'single-posting' | 'listing-page' | 'unknown';
    detectedPostings?: { title: string; url?: string }[];
    fieldConfidence?: Record<string, 'high' | 'medium' | 'low'>;
    warnings?: string[];
    techStack?: string[];
    extractedMarkdown?: string;
  }> => {
    const token = await getIdTokenSafe();

    return new Promise(async (resolve, reject) => {
      apiFetch(apiUrl('/api/career-ops/extract-job-url'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        body: JSON.stringify(options),
      })
        .then(async (response) => {
          if (!response.body) throw new Error('No readable stream from server');
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let currentEvent = 'message';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim() === '') {
                currentEvent = 'message';
              } else if (line.startsWith('event: ')) {
                currentEvent = line.replace('event: ', '').trim();
              } else if (line.startsWith('data: ')) {
                const dataStr = line.replace('data: ', '').trim();
                if (dataStr) {
                  try {
                    const data = JSON.parse(dataStr);
                    if (currentEvent === 'progress' && onProgress) {
                      onProgress(data);
                    } else if (currentEvent === 'done') {
                      resolve(data);
                    } else if (currentEvent === 'error') {
                      reject(new Error(data.message));
                    }
                  } catch (e) {}
                }
              }
            }
          }
        })
        .catch(reject);
    });
  };

  return {
    trackerData,
    isLoadingTracker,
    evaluateJob,
    generateTailoredResume,
    evaluateJobUrl,
    extractJobFromUrl,
  };
}
