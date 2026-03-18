import api from './client';
import type { Task } from '../types';

export async function listTasks(assignmentId: number): Promise<Task[]> {
  const { data } = await api.get<Task[]>('/tasks', { params: { assignment_id: assignmentId } });
  return data;
}

export async function getTask(id: number): Promise<Task> {
  const { data } = await api.get<Task>(`/tasks/${id}`);
  return data;
}

export async function createTask(
  assignmentId: number,
  payload: { title: string; description?: string; order?: number }
): Promise<Task> {
  const { data } = await api.post<Task>('/tasks', payload, {
    params: { assignment_id: assignmentId },
  });
  return data;
}

export async function updateTask(
  id: number,
  payload: Partial<{ title: string; description: string; status: string; order: number }>
): Promise<Task> {
  const { data } = await api.patch<Task>(`/tasks/${id}`, payload);
  return data;
}

export async function deleteTask(id: number): Promise<void> {
  await api.delete(`/tasks/${id}`);
}
