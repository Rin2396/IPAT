import api from './client';
import type { Company } from '../types';

export async function listCompanies(params?: { verified?: boolean; blocked?: boolean }): Promise<Company[]> {
  const { data } = await api.get<Company[]>('/companies', { params });
  return data;
}

export async function getCompany(id: number): Promise<Company> {
  const { data } = await api.get<Company>(`/companies/${id}`);
  return data;
}

export async function createCompany(payload: { name: string; inn?: string; description?: string }): Promise<Company> {
  const { data } = await api.post<Company>('/companies', payload);
  return data;
}

export async function updateCompany(id: number, payload: Partial<{ name: string; inn: string; description: string }>): Promise<Company> {
  const { data } = await api.patch<Company>(`/companies/${id}`, payload);
  return data;
}

export async function verifyCompany(id: number): Promise<Company> {
  const { data } = await api.post<Company>(`/companies/${id}/verify`);
  return data;
}

export async function blockCompany(id: number): Promise<Company> {
  const { data } = await api.post<Company>(`/companies/${id}/block`);
  return data;
}
