import api from './client';
import type { Assignment } from '../types';

export async function listAssignments(params?: {
  status?: string;
  student_id?: number;
  period_id?: number;
}): Promise<Assignment[]> {
  const { data } = await api.get<Assignment[]>('/assignments', { params });
  return data;
}

export async function getAssignment(id: number): Promise<Assignment> {
  const { data } = await api.get<Assignment>(`/assignments/${id}`);
  return data;
}

export async function createAssignment(payload: {
  student_id: number;
  company_id: number;
  period_id: number;
  college_supervisor_id?: number;
  company_supervisor_id?: number;
}): Promise<Assignment> {
  const { data } = await api.post<Assignment>('/assignments', payload);
  return data;
}

export async function updateAssignment(
  id: number,
  payload: Partial<{
    college_supervisor_id: number | null;
    company_supervisor_id: number | null;
    status: string;
  }>
): Promise<Assignment> {
  const { data } = await api.patch<Assignment>(`/assignments/${id}`, payload);
  return data;
}

export async function updateAssignmentGrade(id: number, college_grade: number): Promise<Assignment> {
  const { data } = await api.patch<Assignment>(`/assignments/${id}/grade`, { college_grade });
  return data;
}
