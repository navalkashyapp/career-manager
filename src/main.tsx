import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App.tsx';
import './index.css';
import { auth, getIdTokenSafe } from './store/firebase';

// Automatically append ngrok-skip-browser-warning and Authorization headers on API calls
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr =
      typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();
    if (urlStr.includes('/api/') || urlStr.includes('ngrok')) {
      const headers = new Headers(init?.headers);
      if (!headers.has('ngrok-skip-browser-warning')) {
        headers.set('ngrok-skip-browser-warning', 'true');
      }
      if (!headers.has('Authorization')) {
        try {
          const token = await getIdTokenSafe();
          if (token) {
            headers.set('Authorization', `Bearer ${token}`);
          }
        } catch (e) {
          console.warn('Could not auto-attach ID token:', e);
        }
      }
      return originalFetch(input, { ...init, headers });
    }
    return originalFetch(input, init);
  };
}

// Handle stale Vite dynamic imports after a new deployment
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    console.warn(
      'Dynamic import chunk failed (deployment version skew). Auto-reloading page...',
      event,
    );
    window.location.reload();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
