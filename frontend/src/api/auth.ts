import api from './client';
import type { User } from '../types';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export async function login(payload: LoginPayload): Promise<{ user: User; tokens: TokenResponse }> {
  const body = {
    email: String(payload.email ?? '').trim(),
    password: String(payload.password ?? ''),
  };
  const { data } = await api.post<LoginResponse>('/auth/login', body, {
    headers: { 'Content-Type': 'application/json' },
  });
  return { user: data.user, tokens: { access_token: data.access_token, refresh_token: data.refresh_token, token_type: data.token_type } };
}

export async function refresh(refreshToken: string): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>('/auth/refresh', {
    refresh_token: refreshToken,
  });
  return data;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}
