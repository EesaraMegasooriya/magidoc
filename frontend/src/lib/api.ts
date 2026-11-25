import axios from 'axios';
import { useAuth } from '../store/auth';

/** Header the server requires on state-changing requests (cross-site requests can't add it → CSRF protection). */
export const CLIENT_HEADER = 'X-MagiDoc-Client';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 90_000,
  // Sends the HttpOnly session cookie (also when the API is on another origin via VITE_API_URL).
  withCredentials: true,
  headers: { [CLIENT_HEADER]: 'web' },
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    // Session expired or revoked (e.g. password changed elsewhere): drop local state; routing sends the user to sign in.
    if (axios.isAxiosError(error) && error.response?.status === 401 && useAuth.getState().user) {
      const url = error.config?.url ?? '';
      if (!url.startsWith('/auth/')) useAuth.getState().clear();
    }
    return Promise.reject(error);
  },
);

/** Ends the server session (clears the cookie) and local state. */
export async function signOut() {
  try {
    await api.post('/auth/logout');
  } finally {
    useAuth.getState().clear();
  }
}

export function errorMessage(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as { detail?: string; message?: string } | string | undefined;
    if (typeof data === 'object' && data?.detail) return data.detail;
    if (typeof data === 'object' && data?.message) return data.message;
    if (typeof data === 'string' && data.trim() && data.length < 300) return data;
    if (!e.response) return 'Cannot reach the MagiDoc server';
    return e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong';
}
