export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:3000';
  }
  const envUrl = (import.meta as any).env?.VITE_BACKEND_URL;
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }
  return '';
}

export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    const response = await fetch(input, init);
    return response;
  } catch (error: any) {
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error(
        'The backend server is currently unavailable. Please ensure it is running and try again.',
      );
    }
    throw error;
  }
}
