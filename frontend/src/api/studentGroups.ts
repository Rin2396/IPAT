import api from './client';
import type { StudentGroup, User } from '../types';

export async function listStudentGroupsAdmin(): Promise<StudentGroup[]> {
  const { data } = await api.get<StudentGroup[]>('/student-groups');
  return data;
}

export async function listStudentGroupsContext(): Promise<StudentGroup[]> {
  const { data } = await api.get<StudentGroup[]>('/student-groups/context');
  return data;
}

export async function createStudentGroup(payload: { name: string }): Promise<StudentGroup> {
  const { data } = await api.post<StudentGroup>('/student-groups', payload);
  return data;
}

export async function updateStudentGroup(id: number, payload: { name: string }): Promise<StudentGroup> {
  const { data } = await api.patch<StudentGroup>(`/student-groups/${id}`, payload);
  return data;
}

export async function deleteStudentGroup(id: number): Promise<void> {
  await api.delete(`/student-groups/${id}`);
}

export async function listGroupMembers(groupId: number): Promise<User[]> {
  const { data } = await api.get<User[]>(`/student-groups/${groupId}/members`);
  return data;
}

export async function bulkAddStudentsToGroup(groupId: number, userIds: number[]): Promise<User[]> {
  const { data } = await api.post<User[]>(`/student-groups/${groupId}/members`, { user_ids: userIds });
  return data;
}
