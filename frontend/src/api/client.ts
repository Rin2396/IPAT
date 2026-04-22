import axios, { AxiosError, AxiosHeaders } from 'axios';
import { useAuthStore } from '../stores/authStore';

const api = axios.create({
  baseURL: '/api',
});

let refreshPromise: Promise<string> | null = null;

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Don't force JSON content-type for multipart uploads (FormData).
  if (config.data instanceof FormData) {
    if (config.headers) {
      // axios@1.x uses AxiosHeaders internally; plain `delete headers['Content-Type']`
      // may be ignored depending on the concrete type.
      if (config.headers instanceof AxiosHeaders) {
        config.headers.delete('Content-Type');
      } else {
        delete (config.headers as Record<string, unknown>)['Content-Type'];
        delete (config.headers as Record<string, unknown>)['content-type'];
      }
    }
  } else if (config.data !== undefined) {
    // Let axios send JSON by default for object payloads.
    if (config.headers) {
      if (config.headers instanceof AxiosHeaders) {
        if (!config.headers.getContentType()) config.headers.set('Content-Type', 'application/json');
      } else {
        const headers = config.headers as Record<string, unknown>;
        if (!headers['Content-Type'] && !headers['content-type']) headers['Content-Type'] = 'application/json';
      }
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as { _retry?: boolean } & typeof error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = useAuthStore.getState().refreshToken;
      if (!refreshToken) {
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(error);
      }
      if (!refreshPromise) {
        refreshPromise = (async () => {
          try {
            const { data } = await axios.post<{ access_token: string; refresh_token: string }>('/api/auth/refresh', {
              refresh_token: refreshToken,
            });
            useAuthStore.getState().setTokens(data.access_token, data.refresh_token);
            return data.access_token;
          } catch (e) {
            useAuthStore.getState().logout();
            window.location.href = '/login';
            throw e;
          } finally {
            refreshPromise = null;
          }
        })();
      }
      try {
        const newAccess = await refreshPromise;
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        }
        return api(originalRequest);
      } catch (e) {
        return Promise.reject(e);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
