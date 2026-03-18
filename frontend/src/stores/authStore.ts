import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  setUser: (user: User | null) => void;
  setTokens: (access: string, refresh: string) => void;
  login: (user: User, access: string, refresh: string) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setUser: (user) => set({ user }),
      setTokens: (access, refresh) => set({ accessToken: access, refreshToken: refresh }),
      login: (user, access, refresh) =>
        set({ user, accessToken: access, refreshToken: refresh }),
      logout: () =>
        set({ user: null, accessToken: null, refreshToken: null }),
      isAuthenticated: (): boolean => {
        const state = get();
        return !!(state.accessToken && state.user);
      },
    }),
    {
      name: 'ipat-auth',
      partialize: (state: AuthState) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);
