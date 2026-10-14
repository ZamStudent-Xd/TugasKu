import { Task, TaskStatus, DashboardMetrics, Course } from "@/types";

/**
 * BR-04, BR-05, BR-06, BR-12: Evaluasi status tugas
 */
export function getTaskStatus(
  task: Pick<Task, "progress" | "deadline">,
  referenceDate: Date = new Date()
): TaskStatus {
  const progress = Math.min(100, Math.max(0, Math.round(task.progress || 0)));

  if (progress === 100) {
    return "completed";
  }

  if (task.deadline) {
    const deadlineTime = new Date(task.deadline).getTime();
    if (!isNaN(deadlineTime) && deadlineTime < referenceDate.getTime()) {
      return "overdue";
    }
  }

  if (progress > 0) {
    return "in_progress";
  }

  return "not_started";
}

export function getTaskStatusLabel(status: TaskStatus): string {
  switch (status) {
    case "completed":
      return "Selesai";
    case "overdue":
      return "Terlambat";
    case "in_progress":
      return "Sedang Dikerjakan";
    case "not_started":
    default:
      return "Belum Dimulai";
  }
}

/**
 * PRD 3.5: Rumus perhitungan metrik dan rata-rata progres
 */
export function calculateDashboardMetrics(tasks: Task[]): DashboardMetrics {
  const total = tasks.length;
  if (total === 0) {
    return {
      totalTasks: 0,
      completedTasks: 0,
      activeTasks: 0,
      overdueTasks: 0,
      averageProgress: 0,
    };
  }

  let completedCount = 0;
  let overdueCount = 0;
  let totalPoints = 0;
  let earnedPoints = 0;

  for (const t of tasks) {
    const status = getTaskStatus(t);
    const taskPoint = t.points ?? 50;
    totalPoints += taskPoint;
    if (status === "completed") {
      completedCount++;
      earnedPoints += taskPoint;
    } else if (status === "overdue") {
      overdueCount++;
    }
  }

  const activeCount = total - completedCount;
  const averageProgress = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

  return {
    totalTasks: total,
    completedTasks: completedCount,
    activeTasks: activeCount,
    overdueTasks: overdueCount,
    averageProgress,
  };
}

/**
 * BR-13: Poin Tugas Di-generate Otomatis oleh Sistem (Bukan Manual).
 * Setiap mata kuliah memiliki target total bobot 100 Poin (100% progres).
 * Sistem secara otomatis membagi 100 Poin ke seluruh tugas dalam mata kuliah tersebut:
 * - 1 tugas = 100 Poin
 * - 2 tugas = 50 Poin per tugas (seperti tugas Individu & Kelompok)
 * - 3 tugas = 34, 33, 33 Poin (total 100)
 * - 4 tugas = 25 Poin per tugas
 */
export function calculateAutoTaskPoints(taskId: string, courseTasks: Task[]): number {
  const count = courseTasks.length;
  if (count <= 1) return 100;
  const base = Math.floor(100 / count);
  const remainder = 100 - base * count;
  const index = courseTasks.findIndex((t) => t.id === taskId);
  if (index >= 0 && index < remainder) {
    return base + 1;
  }
  return base;
}

/**
 * Sinkronisasi seluruh tugas dengan poin otomatis yang di-generate sistem per mata kuliah.
 */
export function syncTasksWithAutoPoints(tasks: Task[]): Task[] {
  const courseGroups: Record<string, Task[]> = {};
  for (const t of tasks) {
    if (!courseGroups[t.courseId]) {
      courseGroups[t.courseId] = [];
    }
    courseGroups[t.courseId].push(t);
  }

  return tasks.map((task) => {
    const group = courseGroups[task.courseId] || [task];
    const autoPoints = calculateAutoTaskPoints(task.id, group);
    if (task.points === autoPoints) return task;
    return { ...task, points: autoPoints };
  });
}

/**
 * Menentukan apakah sebuah tugas milik suatu mata kuliah, baik melalui kesesuaian courseId
 * maupun kesesuaian nama mata kuliah (berguna saat kolaborasi antar-pengguna).
 */
export function isTaskBelongsToCourse(
  task: Pick<Task, "courseId"> & { courseName?: string },
  course: Pick<Course, "id" | "name">
): boolean {
  if (task.courseId === course.id) return true;
  if (
    task.courseName &&
    course.name &&
    task.courseName.trim().toLowerCase() === course.name.trim().toLowerCase()
  ) {
    return true;
  }
  return false;
}

export function calculateCourseProgress(
  tasks: Task[],
  courseIdOrTasksOrCourse: string | Task[] | Course
): { total: number; progress: number; totalPoints: number; earnedPoints: number } {
  let courseTasks: Task[];
  if (Array.isArray(courseIdOrTasksOrCourse)) {
    courseTasks = courseIdOrTasksOrCourse;
  } else if (typeof courseIdOrTasksOrCourse === "object" && courseIdOrTasksOrCourse !== null) {
    courseTasks = tasks.filter((t) => isTaskBelongsToCourse(t, courseIdOrTasksOrCourse));
  } else {
    courseTasks = tasks.filter((t) => t.courseId === courseIdOrTasksOrCourse);
  }

  if (courseTasks.length === 0) {
    return { total: 0, progress: 0, totalPoints: 0, earnedPoints: 0 };
  }

  const totalPoints = courseTasks.reduce(
    (acc, t) => acc + (t.points ?? calculateAutoTaskPoints(t.id, courseTasks)),
    0
  );
  const earnedPoints = courseTasks.reduce((acc, t) => {
    const pt = t.points ?? calculateAutoTaskPoints(t.id, courseTasks);
    return acc + (t.progress === 100 ? pt : 0);
  }, 0);

  const progress = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

  return {
    total: courseTasks.length,
    progress: Math.min(100, Math.max(0, progress)),
    totalPoints,
    earnedPoints,
  };
}

export function formatDeadline(deadlineStr?: string | null): string {
  if (!deadlineStr) return "Tanpa deadline";
  try {
    const date = new Date(deadlineStr);
    if (isNaN(date.getTime())) return "Tanpa deadline";
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "Tanpa deadline";
  }
}

export function isDeadlineNear(deadlineStr?: string | null, hours: number = 24, referenceTime?: number): boolean {
  if (!deadlineStr) return false;
  const deadlineTime = new Date(deadlineStr).getTime();
  if (isNaN(deadlineTime)) return false;
  if (!referenceTime) return false;
  const diffHours = (deadlineTime - referenceTime) / (1000 * 60 * 60);
  return diffHours > 0 && diffHours <= hours;
}

export function validateTaskInput(title: string, progress: number): { valid: boolean; error?: string } {
  if (!title || title.trim().length === 0) {
    return { valid: false, error: "Judul tugas tidak boleh kosong" };
  }
  if (title.length > 150) {
    return { valid: false, error: "Judul tugas maksimal 150 karakter" };
  }
  if (isNaN(progress) || progress < 0 || progress > 100) {
    return { valid: false, error: "Progres harus berupa bilangan 0 - 100" };
  }
  return { valid: true };
}

export function validateCourseInput(
  name: string,
  existingCourses?: Course[],
  currentCourseId?: string
): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: "Nama mata kuliah wajib diisi" };
  }
  const clean = name.trim();
  if (clean.length > 100) {
    return { valid: false, error: "Nama mata kuliah maksimal 100 karakter" };
  }
  if (existingCourses && existingCourses.length > 0) {
    const cleanLower = clean.toLowerCase();
    const isDuplicate = existingCourses.some(
      (c) => c.name.toLowerCase().trim() === cleanLower && c.id !== currentCourseId
    );
    if (isDuplicate) {
      return {
        valid: false,
        error: `Mata kuliah "${clean}" sudah ada di daftar Anda. Harap gunakan nama lain.`,
      };
    }
  }
  return { valid: true };
}
