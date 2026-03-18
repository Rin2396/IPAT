import axios, { AxiosError } from 'axios';
import { useAuthStore } from '../stores/authStore';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

let refreshPromise: Promise<string> | null = null;

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
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
