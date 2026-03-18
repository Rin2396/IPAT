export type UserRole = 'admin' | 'student' | 'college_supervisor' | 'company_supervisor';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface Company {
  id: number;
  name: string;
  inn: string | null;
  description: string | null;
  verified: boolean;
  blocked: boolean;
}

export type AssignmentStatus = 'draft' | 'active' | 'completed' | 'cancelled';

export interface Assignment {
  id: number;
  student_id: number;
  company_id: number;
  period_id: number;
  college_supervisor_id: number | null;
  company_supervisor_id: number | null;
  status: AssignmentStatus;
  created_at: string;
}

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'accepted';

export interface Task {
  id: number;
  assignment_id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  order: number;
  created_at: string;
}

export type ReportStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'revision_requested';

export interface Report {
  id: number;
  assignment_id: number;
  iteration: number;
  file_key: string;
  status: ReportStatus;
  uploaded_at: string;
}

export interface Period {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export interface Notification {
  id: number;
  user_id: number;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
}
