import api from './client';
import type { ChatThread, ChatMessage, ChatUnreadCount } from '../types';

export async function getOrCreateChatThread(assignmentId: number): Promise<ChatThread> {
  const { data } = await api.get<ChatThread>('/chat/thread', { params: { assignment_id: assignmentId } });
  return data;
}

export async function listChatMessages(
  threadId: number,
  params?: { before_id?: number; limit?: number }
): Promise<ChatMessage[]> {
  const { data } = await api.get<ChatMessage[]>(`/chat/thread/${threadId}/messages`, { params });
  return data;
}

export async function listChatMessagesSince(
  threadId: number,
  afterId: number,
  limit?: number
): Promise<ChatMessage[]> {
  const { data } = await api.get<ChatMessage[]>(`/chat/thread/${threadId}/since`, {
    params: { after_id: afterId, limit: limit ?? 200 },
  });
  return data;
}

export async function sendChatMessage(threadId: number, body: string): Promise<ChatMessage> {
  const { data } = await api.post<ChatMessage>(`/chat/thread/${threadId}/messages`, { body });
  return data;
}

export async function markChatRead(threadId: number, lastReadMessageId?: number): Promise<{ detail: string; last_read_message_id?: number | null }> {
  const { data } = await api.post(`/chat/thread/${threadId}/read`, { last_read_message_id: lastReadMessageId ?? null });
  return data;
}

export async function getChatUnreadCount(assignmentId: number): Promise<ChatUnreadCount> {
  const { data } = await api.get<ChatUnreadCount>('/chat/unread-count', { params: { assignment_id: assignmentId } });
  return data;
}

export async function getChatUnreadCounts(): Promise<ChatUnreadCount[]> {
  const { data } = await api.get<ChatUnreadCount[]>('/chat/unread-counts');
  return data;
}

