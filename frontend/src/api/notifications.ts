import api from './client';
import type { Notification } from '../types';

export async function listNotifications(params?: { unread_only?: boolean }): Promise<Notification[]> {
  const { data } = await api.get<Notification[]>('/notifications', { params });
  return data;
}

export async function getUnreadCount(): Promise<{ count: number }> {
  const { data } = await api.get<{ count: number }>('/notifications/unread-count');
  return data;
}

export async function markNotificationRead(id: number, read?: boolean): Promise<Notification> {
  const { data } = await api.patch<Notification>(`/notifications/${id}`, { read: read ?? true });
  return data;
}

export async function markAllRead(): Promise<void> {
  await api.post('/notifications/read-all');
}
