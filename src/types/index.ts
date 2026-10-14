export type TaskType = 'individual' | 'group';

export type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue';

export interface Course {
  id: string;
  name: string;
  lecturer?: string;
  code?: string;
  color: string;
  ownerId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TaskMember {
  userId: string;
  taskId: string;
  fullName: string;
  email?: string;
  avatarUrl?: string;
  role: 'owner' | 'member';
  joinedAt: string;
}

export interface Task {
  id: string;
  courseId: string;
  courseName?: string;
  title: string;
  description?: string;
  taskType: TaskType;
  progress: number; // 0 (belum selesai) atau 100 (selesai)
  points?: number; // Poin bobot tugas terhadap progres mata kuliah (misal: 25, 50, 100)
  deadline?: string | null;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  members?: TaskMember[];
}

export interface TaskInvitation {
  id: string;
  taskId: string;
  taskTitle?: string;
  courseName?: string;
  invitedEmail: string;
  tokenHash?: string;
  status: 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired';
  expiresAt: string;
  invitedBy: string;
  inviterName?: string;
  inviterAvatar?: string;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  nim?: string;
  major?: string;
  semester?: number;
  campus?: string;
  avatarUrl?: string;
  createdAt?: string;
}

export interface DashboardMetrics {
  totalTasks: number;
  completedTasks: number;
  activeTasks: number;
  overdueTasks: number;
  averageProgress: number;
}
