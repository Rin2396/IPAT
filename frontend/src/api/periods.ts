import api from './client';
import type { Period } from '../types';

export async function listPeriods(params?: { is_active?: boolean }): Promise<Period[]> {
  const { data } = await api.get<Period[]>('/periods', { params });
  return data;
}

export async function getPeriod(id: number): Promise<Period> {
  const { data } = await api.get<Period>(`/periods/${id}`);
  return data;
}

export async function createPeriod(payload: {
  name: string;
  start_date: string;
  end_date: string;
  is_active?: boolean;
}): Promise<Period> {
  const { data } = await api.post<Period>('/periods', payload);
  return data;
}

export async function updatePeriod(
  id: number,
  payload: Partial<{ name: string; start_date: string; end_date: string; is_active: boolean }>
): Promise<Period> {
  const { data } = await api.patch<Period>(`/periods/${id}`, payload);
  return data;
}

export async function deletePeriod(id: number): Promise<void> {
  await api.delete(`/periods/${id}`);
}
