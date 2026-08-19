import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useCareerOps() {
  const queryClient = useQueryClient();

  const { data: trackerData, isLoading: isLoadingTracker } = useQuery({
    queryKey: ['careerOpsTracker'],
    queryFn: async () => {
      const res = await fetch('/api/career-ops/tracker');
      if (!res.ok) throw new Error('Failed to fetch tracker data');
      return res.json();
    }
  });

  const evaluateJob = async (jdText: string, profileData: any, onProgress?: (data: any) => void) => {
    console.log('[useCareerOps] Opening SSE stream for evaluateJob API...');
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      fetch('/api/career-ops/evaluate-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jdText, profileData }),
        signal: controller.signal
      }).then(async (response) => {
        console.log('[useCareerOps] /evaluate-stream Connection established.');
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
                  console.log(`[useCareerOps.evaluateJob] SSE Event Received: ${currentEvent}`, data);
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
      }).catch(reject);
    });
  };

  const evaluateJobUrl = async (url: string, profileData: any, onProgress?: (data: any) => void) => {
    console.log('[useCareerOps] Opening SSE stream for evaluateJobUrl API...');
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      fetch('/api/career-ops/evaluate-url-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, profileData }),
        signal: controller.signal
      }).then(async (response) => {
        console.log('[useCareerOps] /evaluate-url-stream Connection established.');
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
                  console.log(`[useCareerOps.evaluateJobUrl] SSE Event Received: ${currentEvent}`, data);
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
      }).catch(reject);
    });
  };

  const draftOutreach = async (jdText: string, profileData: any, messageType: string, onProgress?: (data: any) => void) => {
    return new Promise((resolve, reject) => {
      fetch('/api/career-ops/outreach-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jdText, profileData, messageType })
      }).then(async (response) => {
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
      }).catch(reject);
    });
  };

  const generateTailoredResume = async (jdText: string, profileData: any, onProgress?: (data: any) => void) => {
    return new Promise((resolve, reject) => {
      fetch('/api/career-ops/tailor-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jdText, profileData })
      }).then(async (response) => {
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
      }).catch(reject);
    });
  };

  return {
    trackerData,
    isLoadingTracker,
    evaluateJob,
    draftOutreach,
    generateTailoredResume,
    evaluateJobUrl
  };
}
