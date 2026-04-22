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
  // Backward-compat shim: endpoint now streams the file.
  // Keep function name to avoid large refactors; callers should use downloadReport instead.
  const url = `/api/reports/${id}/download`;
  return { url, expires_in: 0 };
}

export async function downloadReport(id: number): Promise<{ blob: Blob; filename?: string }> {
  const res = await api.get(`/reports/${id}/download`, { responseType: 'blob' });
  const cd = (res.headers?.['content-disposition'] ?? res.headers?.['Content-Disposition']) as string | undefined;
  const match = cd?.match(/filename="?(?<name>[^"]+)"?/i);
  return { blob: res.data as Blob, filename: match?.groups?.name };
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

export async function deleteReport(id: number): Promise<void> {
  await api.delete(`/reports/${id}`);
}
