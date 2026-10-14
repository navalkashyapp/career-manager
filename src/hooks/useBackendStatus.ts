import { useState, useEffect, useCallback, useRef } from 'react';
import { apiUrl } from '../config/api';

export type BackendStatus = 'online' | 'offline' | 'checking';

export interface UseBackendStatusOptions {
  pollingIntervalMs?: number; // default: 15000 (15 seconds)
  timeoutMs?: number; // default: 4000 (4 seconds)
}

export function useBackendStatus(options: UseBackendStatusOptions = {}) {
  const { pollingIntervalMs = 15000, timeoutMs = 4000 } = options;
  const [status, setStatus] = useState<BackendStatus>('checking');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const isCheckingRef = useRef(false);

  const checkHealth = useCallback(async () => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const url = apiUrl('/api/health');
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          'ngrok-skip-browser-warning': 'true',
          Accept: 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        setStatus('online');
      } else {
        setStatus('offline');
      }
    } catch {
      setStatus('offline');
    } finally {
      setLastChecked(new Date());
      isCheckingRef.current = false;
    }
  }, [timeoutMs]);

  useEffect(() => {
    checkHealth();

    const intervalId = setInterval(checkHealth, pollingIntervalMs);

    const handleFocus = () => {
      checkHealth();
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleFocus);
    };
  }, [checkHealth, pollingIntervalMs]);

  return { status, lastChecked, checkNow: checkHealth };
}
