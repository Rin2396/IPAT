import api from './client';
import type { User } from '../types';

export async function getMe(): Promise<User> {
  const { data } = await api.get<User>('/users/me');
  return data;
}

export async function listUsers(params?: { role?: string; skip?: number; limit?: number }): Promise<User[]> {
  const { data } = await api.get<User[]>('/users', { params });
  return data;
}

export async function getUser(id: number): Promise<User> {
  const { data } = await api.get<User>(`/users/${id}`);
  return data;
}

export async function createUser(payload: {
  email: string;
  password: string;
  full_name: string;
  role: string;
  is_active?: boolean;
}): Promise<User> {
  const { data } = await api.post<User>('/users', payload);
  return data;
}

export async function updateUser(id: number, payload: Partial<{ full_name: string; role: string; is_active: boolean }>): Promise<User> {
  const { data } = await api.patch<User>(`/users/${id}`, payload);
  return data;
}

export async function deleteUser(id: number): Promise<void> {
  await api.delete(`/users/${id}`);
}
