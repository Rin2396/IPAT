import api from './client';
import type { Report } from '../types';

export async function listReports(assignmentId: number): Promise<Report[]> {
  const { data } = await api.get<Report[]>('/reports', { params: { assignment_id: assignmentId } });
  return data;
}

export async function getReport(id: number): Promise<Report> {
  const { data } = await api.get<Report>(`/reports/${id}`);
  return data;
}

export async function getReportDownloadUrl(id: number): Promise<{ url: string; expires_in: number }> {
  const { data } = await api.get<{ url: string; expires_in: number }>(`/reports/${id}/download`);
  return data;
}

export async function uploadReport(
  assignmentId: number,
  file: File,
  iteration?: number
): Promise<Report> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<Report>(`/reports?assignment_id=${assignmentId}&iteration=${iteration ?? 1}`, form);
  return data;
}

export async function updateReportStatus(id: number, status: string): Promise<Report> {
  const { data } = await api.patch<Report>(`/reports/${id}`, { status });
  return data;
}
