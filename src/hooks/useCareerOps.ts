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

  const evaluateJob = async (jdText: string, onProgress?: (data: any) => void) => {
    console.log('[useCareerOps] Opening SSE stream for evaluateJob API...');
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      fetch('/api/career-ops/evaluate-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jdText }),
        signal: controller.signal
      }).then(async (response) => {
        console.log('[useCareerOps] /evaluate-stream Connection established.');
        if (!response.body) throw new Error('No readable stream');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep the last incomplete line in buffer

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith('data: ')) {
              const dataStr = line.replace('data: ', '').trim();
              if (dataStr) {
                try {
                  const data = JSON.parse(dataStr);
                  // Look at the previous line for the event type
                  const eventTypeLine = lines[i-1];
                  if (eventTypeLine && eventTypeLine.startsWith('event: ')) {
                    const eventType = eventTypeLine.replace('event: ', '').trim();
                    console.log(`[useCareerOps.evaluateJob] SSE Event Received: ${eventType}`, data);
                    if (eventType === 'progress' && onProgress) {
                      onProgress(data);
                    } else if (eventType === 'result') {
                      resolve(data);
                    } else if (eventType === 'error') {
                      reject(new Error(data.message));
                    }
                  }
                } catch (e) {
                  // Ignore parse errors for incomplete chunks
                }
              }
            }
          }
        }
      }).catch(reject);
    });
  };

  const evaluateJobUrl = async (url: string, onProgress?: (data: any) => void) => {
    console.log('[useCareerOps] Opening SSE stream for evaluateJobUrl API...');
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      fetch('/api/career-ops/evaluate-url-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: controller.signal
      }).then(async (response) => {
        console.log('[useCareerOps] /evaluate-url-stream Connection established.');
        if (!response.body) throw new Error('No readable stream');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith('data: ')) {
              const dataStr = line.replace('data: ', '').trim();
              if (dataStr) {
                try {
                  const data = JSON.parse(dataStr);
                  const eventTypeLine = lines[i-1];
                  if (eventTypeLine && eventTypeLine.startsWith('event: ')) {
                    const eventType = eventTypeLine.replace('event: ', '').trim();
                    console.log(`[useCareerOps.evaluateJobUrl] SSE Event Received: ${eventType}`, data);
                    if (eventType === 'progress' && onProgress) {
                      onProgress(data);
                    } else if (eventType === 'result') {
                      resolve(data);
                    } else if (eventType === 'error') {
                      reject(new Error(data.message));
                    }
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

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; 

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith('data: ')) {
              const dataStr = line.replace('data: ', '').trim();
              if (dataStr) {
                try {
                  const data = JSON.parse(dataStr);
                  const eventTypeLine = lines[i-1];
                  if (eventTypeLine && eventTypeLine.startsWith('event: ')) {
                    const eventType = eventTypeLine.replace('event: ', '').trim();
                    if (eventType === 'progress' && onProgress) {
                      onProgress(data);
                    } else if (eventType === 'result') {
                      resolve(data);
                    } else if (eventType === 'error') {
                      reject(new Error(data.message));
                    }
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

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; 

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith('data: ')) {
              const dataStr = line.replace('data: ', '').trim();
              if (dataStr) {
                try {
                  const data = JSON.parse(dataStr);
                  const eventTypeLine = lines[i-1];
                  if (eventTypeLine && eventTypeLine.startsWith('event: ')) {
                    const eventType = eventTypeLine.replace('event: ', '').trim();
                    if (eventType === 'progress' && onProgress) {
                      onProgress(data);
                    } else if (eventType === 'result') {
                      resolve(data);
                    } else if (eventType === 'error') {
                      reject(new Error(data.message));
                    }
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
