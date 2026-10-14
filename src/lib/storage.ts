import { Course, Task, TaskMember, UserProfile, TaskInvitation } from "@/types";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { syncTasksWithAutoPoints } from "./businessRules";
import {
  validateStudentEmail,
  validateNim,
  validateFullName,
  validatePassword,
  validateOtpCode,
  validateSemester,
  validateMajor,
} from "./securityValidation";

const COURSES_KEY = "tugasku_courses_v3";
const TASKS_KEY = "tugasku_tasks_v3";
const AUTH_USER_KEY = "tugasku_auth_user_v3";
const REGISTERED_USERS_KEY = "tugasku_registered_users_v3";
const PENDING_VERIFICATIONS_KEY = "tugasku_pending_verifications_v3";
const TASK_INVITATIONS_KEY = "tugasku_task_invitations_v3";

// Bersihkan data dummy versi sebelumnya
if (typeof window !== "undefined") {
  try {
    localStorage.removeItem("tugasku_registered_users_v1");
    localStorage.removeItem("tugasku_pending_verifications_v1");
    localStorage.removeItem("tugasku_auth_user_v1");
    localStorage.removeItem("tugasku_courses_v1");
    localStorage.removeItem("tugasku_tasks_v1");
    localStorage.removeItem("tugasku_courses_v2");
    localStorage.removeItem("tugasku_tasks_v2");
    localStorage.removeItem("tugasku_registered_users_v2");
    localStorage.removeItem("tugasku_task_invitations_v1");
  } catch {
    // ignore
  }
}

// ============================================================================
// HELPER LOCAL STORAGE
// ============================================================================

function getLocalCourses(): Course[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(COURSES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalCourses(courses: Course[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(COURSES_KEY, JSON.stringify(courses));
  }
}

function getLocalTasks(): Task[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    return raw ? syncTasksWithAutoPoints(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

function saveLocalTasks(tasks: Task[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  }
}

// ============================================================================
// OPERASI MATA KULIAH (COURSES)
// ============================================================================

export async function fetchCourses(userParam?: UserProfile | null): Promise<Course[]> {
  const activeUser = userParam || getCurrentUser();
  const userId = activeUser?.id;
  const email = activeUser?.email;

  // 1. Coba ambil dari Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase.from("courses").select("*").order("created_at", { ascending: false });
      if (userId) {
        query = query.eq("owner_id", userId);
      }
      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        const mapped = data.map((c) => ({
          id: c.id,
          name: c.name,
          lecturer: c.lecturer,
          code: c.code,
          color: c.color,
          ownerId: c.owner_id,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        }));
        saveLocalCourses(mapped);
        return mapped;
      }
    } catch (err) {
      console.warn("Gagal mengambil data mata kuliah dari Supabase, beralih ke server DB:", err);
    }
  }

  // 2. Ambil dari Server Database API (terfilter berdasarkan user)
  if (typeof window !== "undefined") {
    try {
      const qParams = new URLSearchParams();
      if (userId) qParams.set("userId", userId);
      if (email) qParams.set("email", email);

      const url = `/api/db/courses${qParams.toString() ? `?${qParams.toString()}` : ""}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.courses)) {
          saveLocalCourses(json.courses);
          return json.courses;
        }
      }
    } catch (e) {
      console.warn("Gagal mengambil mata kuliah dari server DB:", e);
    }
  }

  const local = getLocalCourses();
  if (activeUser) {
    const cleanEmail = activeUser.email.toLowerCase().trim();
    return local.filter((c) => !c.ownerId || c.ownerId === activeUser.id || c.ownerId.toLowerCase().trim() === cleanEmail);
  }
  return local;
}

export async function addCourse(course: Omit<Course, "id"> & { id?: string }): Promise<Course> {
  const currentUser = getCurrentUser();
  const cleanName = course.name.trim().toLowerCase();
  const existing = getLocalCourses();
  const isDuplicate = existing.some(
    (c) => c.name.trim().toLowerCase() === cleanName
  );
  if (isDuplicate) {
    throw new Error(`Mata kuliah "${course.name.trim()}" sudah ada di daftar Anda. Harap gunakan nama lain.`);
  }

  const newCourse: Course = {
    ...course,
    name: course.name.trim(),
    id: course.id || `course-${Date.now()}`,
    ownerId: course.ownerId || currentUser?.id || currentUser?.email || "",
    createdAt: course.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;

      if (userId) {
        const { data, error } = await supabase
          .from("courses")
          .insert([
            {
              owner_id: userId,
              name: newCourse.name,
              lecturer: newCourse.lecturer,
              code: newCourse.code,
              color: newCourse.color,
            },
          ])
          .select()
          .single();

        if (!error && data) {
          newCourse.id = data.id;
          newCourse.ownerId = data.owner_id;
        }
      }
    } catch (err) {
      console.warn("Gagal menyimpan mata kuliah ke Supabase:", err);
    }
  }

  // Sinkronkan ke Server DB
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/db/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course: newCourse }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Gagal menyimpan mata kuliah ke server DB");
      }
    } catch (e: any) {
      if (e?.message && e.message.includes("sudah ada")) {
        throw e;
      }
      console.warn("Gagal simpan mata kuliah ke server DB:", e);
    }
  }

  const index = existing.findIndex((c) => c.id === newCourse.id);
  let updated: Course[];
  if (index >= 0) {
    updated = [...existing];
    updated[index] = newCourse;
  } else {
    updated = [newCourse, ...existing];
  }
  saveLocalCourses(updated);
  return newCourse;
}

export async function updateCourse(id: string, updates: Partial<Course>): Promise<Course[]> {
  const existing = getLocalCourses();
  if (updates.name) {
    const cleanName = updates.name.trim().toLowerCase();
    const isDuplicate = existing.some(
      (c) => c.id !== id && c.name.trim().toLowerCase() === cleanName
    );
    if (isDuplicate) {
      throw new Error(`Mata kuliah "${updates.name.trim()}" sudah ada di daftar Anda. Harap gunakan nama lain.`);
    }
  }

  const updated = existing.map((c) =>
    c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
  );
  saveLocalCourses(updated);

  const targetCourse = updated.find((c) => c.id === id);
  if (targetCourse && typeof window !== "undefined") {
    try {
      const res = await fetch("/api/db/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course: targetCourse }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Gagal memperbarui mata kuliah di server DB");
      }
    } catch (e: any) {
      if (e?.message && e.message.includes("sudah ada")) {
        throw e;
      }
      console.warn("Gagal simpan pembaruan mata kuliah ke server DB:", e);
    }
  }

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from("courses")
        .update({
          name: updates.name,
          lecturer: updates.lecturer,
          code: updates.code,
          color: updates.color,
        })
        .eq("id", id);
    } catch (err) {
      console.warn("Gagal update mata kuliah ke Supabase:", err);
    }
  }

  return updated;
}

export async function deleteCourse(
  id: string,
  userParam?: UserProfile | null
): Promise<{ courses: Course[]; tasks: Task[] }> {
  const activeUser = userParam || getCurrentUser();
  const userId = activeUser?.id;
  const email = activeUser?.email;

  const qParams = new URLSearchParams({ id });
  if (userId) qParams.set("userId", userId);
  if (email) qParams.set("email", email);

  if (typeof window !== "undefined") {
    try {
      await fetch(`/api/db/courses?${qParams.toString()}`, { method: "DELETE" });
    } catch (e) {
      console.warn("Gagal menghapus mata kuliah di server:", e);
    }
  }

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from("courses").delete().eq("id", id);
    } catch (err) {
      console.warn("Gagal menghapus mata kuliah di Supabase:", err);
    }
  }

  const existingCourses = getLocalCourses();
  const targetCourse = existingCourses.find((c) => c.id === id);
  const targetCourseName = targetCourse?.name?.toLowerCase().trim();

  const courses = existingCourses.filter((c) => c.id !== id);

  // Bersihkan tugas lokal:
  // - Tugas kolaborasi milik ketua: lepas dari tampilan lokal anggota ini
  // - Tugas milik sendiri: hapus (cascade)
  const localTasks = getLocalTasks();
  const remainingTasks: Task[] = [];

  for (const t of localTasks) {
    const isLinked =
      t.courseId === id ||
      (targetCourseName && t.courseName?.toLowerCase().trim() === targetCourseName);

    if (!isLinked) {
      remainingTasks.push(t);
      continue;
    }

    const isCreatedByOther =
      (userId && t.createdBy !== userId) ||
      (email && t.createdBy?.toLowerCase().trim() !== email.toLowerCase().trim());

    if (t.taskType === "group" && isCreatedByOther) {
      // Tugas kolaborasi ketua: dilepaskan dari lokal anggota ini
      continue;
    }

    // Tugas milik sendiri: tidak dimasukkan ke remainingTasks (terhapus)
  }

  const tasks = syncTasksWithAutoPoints(remainingTasks);
  saveLocalCourses(courses);
  saveLocalTasks(tasks);
  return { courses, tasks };
}

// ============================================================================
// OPERASI TUGAS (TASKS)
// ============================================================================

export async function fetchTasks(userParam?: UserProfile | null): Promise<Task[]> {
  const activeUser = userParam || getCurrentUser();
  const userId = activeUser?.id;
  const email = activeUser?.email;

  // 1. Coba ambil dari Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase
        .from("tasks")
        .select("*, task_members(*, profiles(full_name, avatar_url))")
        .order("deadline", { ascending: true, nullsFirst: false });

      if (userId) {
        query = query.eq("created_by", userId);
      }

      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        const mapped = data.map((t) => ({
          id: t.id,
          courseId: t.course_id,
          title: t.title,
          description: t.description,
          taskType: t.task_type,
          progress: t.progress,
          points: t.points,
          deadline: t.deadline,
          createdBy: t.created_by,
          createdAt: t.created_at,
          updatedAt: t.updated_at,
          members: t.task_members?.map((m: any) => ({
            userId: m.user_id,
            taskId: m.task_id,
            role: m.role,
            joinedAt: m.joined_at,
            fullName: m.profiles?.full_name || "Anggota",
            avatarUrl: m.profiles?.avatar_url,
          })),
        }));
        const synced = syncTasksWithAutoPoints(mapped);
        saveLocalTasks(synced);
        return synced;
      }
    } catch (err) {
      console.warn("Gagal mengambil tugas dari Supabase, beralih ke server DB:", err);
    }
  }

  // 2. Ambil dari Server Database API (terfilter berdasarkan user)
  if (typeof window !== "undefined") {
    try {
      const qParams = new URLSearchParams();
      if (userId) qParams.set("userId", userId);
      if (email) qParams.set("email", email);

      const url = `/api/db/tasks${qParams.toString() ? `?${qParams.toString()}` : ""}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.tasks)) {
          const synced = syncTasksWithAutoPoints(json.tasks);
          saveLocalTasks(synced);
          return synced;
        }
      }
    } catch (e) {
      console.warn("Gagal mengambil tugas dari server DB:", e);
    }
  }

  const local = getLocalTasks();
  if (activeUser) {
    const cleanEmail = activeUser.email.toLowerCase().trim();
    return local.filter((t) => {
      if (t.createdBy === activeUser.id || (t.createdBy && t.createdBy.toLowerCase().trim() === cleanEmail)) {
        return true;
      }
      if (t.members && t.members.some((m) => 
        m.userId === activeUser.id || 
        (m.userId && m.userId.toLowerCase().trim() === cleanEmail)
      )) {
        return true;
      }
      return false;
    });
  }
  return local;
}

export async function addTask(task: Omit<Task, "id">): Promise<Task> {
  const currentUser = getCurrentUser();
  const creatorId = task.createdBy || currentUser?.id || currentUser?.email || "";

  // Anggota awal untuk tugas kelompok HANYA pembuat tugas itu sendiri (role: owner).
  // Mahasiswa lain TIDAK AKAN ditambahkan sebelum di-invite dan mereka menerima undangan!
  const initialMembers = (task.members && task.members.length > 0)
    ? task.members
    : (currentUser && task.taskType === "group" ? [{
        userId: currentUser.id,
        taskId: "",
        fullName: currentUser.fullName,
        avatarUrl: currentUser.avatarUrl,
        role: "owner" as const,
        joinedAt: new Date().toISOString(),
      }] : []);

  const courses = getLocalCourses();
  const linkedCourse = courses.find((c) => c.id === task.courseId);

  const newTask: Task = {
    ...task,
    id: `task-${Date.now()}`,
    courseName: task.courseName || linkedCourse?.name || "",
    createdBy: creatorId,
    members: initialMembers,
    progress: Math.min(100, Math.max(0, Math.round(task.progress || 0))),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (newTask.members && newTask.members.length > 0) {
    newTask.members = newTask.members.map((m) => ({ ...m, taskId: newTask.id }));
  }

  // Sinkronkan ke Server DB
  if (typeof window !== "undefined") {
    try {
      await fetch("/api/db/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: newTask }),
      });
    } catch (e) {
      console.warn("Gagal simpan tugas ke server DB:", e);
    }
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;

      if (userId) {
        const { data, error } = await supabase
          .from("tasks")
          .insert([
            {
              course_id: newTask.courseId,
              created_by: userId,
              title: newTask.title,
              description: newTask.description,
              task_type: newTask.taskType,
              progress: newTask.progress,
              points: newTask.points || 25,
              deadline: newTask.deadline,
            },
          ])
          .select()
          .single();

        if (!error && data) {
          newTask.id = data.id;
          newTask.createdBy = data.created_by;
        }
      }
    } catch (err) {
      console.warn("Gagal menambahkan tugas ke Supabase:", err);
    }
  }

  const existing = getLocalTasks();
  const updated = syncTasksWithAutoPoints([newTask, ...existing]);
  saveLocalTasks(updated);
  return updated.find((t) => t.id === newTask.id) || newTask;
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task[]> {
  const progress =
    updates.progress !== undefined
      ? Math.min(100, Math.max(0, Math.round(updates.progress)))
      : undefined;

  // Sinkronkan ke Server DB
  if (typeof window !== "undefined") {
    try {
      await fetch("/api/db/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: id, updates: { ...updates, ...(progress !== undefined ? { progress } : {}) } }),
      });
    } catch (e) {
      console.warn("Gagal update tugas di server DB:", e);
    }
  }

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from("tasks")
        .update({
          course_id: updates.courseId,
          title: updates.title,
          description: updates.description,
          task_type: updates.taskType,
          ...(progress !== undefined ? { progress } : {}),
          ...(updates.points !== undefined ? { points: updates.points } : {}),
          deadline: updates.deadline,
        })
        .eq("id", id);
    } catch (err) {
      console.warn("Gagal update tugas ke Supabase:", err);
    }
  }

  const existing = getLocalTasks();
  const updated = existing.map((t) =>
    t.id === id
      ? {
          ...t,
          ...updates,
          ...(progress !== undefined ? { progress } : {}),
          updatedAt: new Date().toISOString(),
        }
      : t
  );
  saveLocalTasks(updated);
  return updated;
}

export async function updateTaskProgress(id: string, progress: number): Promise<Task[]> {
  const cleanProgress = Math.min(100, Math.max(0, Math.round(progress)));

  // Sinkronkan ke Server DB
  if (typeof window !== "undefined") {
    try {
      await fetch("/api/db/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: id, updates: { progress: cleanProgress } }),
      });
    } catch (e) {
      console.warn("Gagal update progres tugas di server DB:", e);
    }
  }

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from("tasks").update({ progress: cleanProgress }).eq("id", id);
    } catch (err) {
      console.warn("Gagal update progres tugas di Supabase:", err);
    }
  }

  const existing = getLocalTasks();
  const updated = existing.map((t) =>
    t.id === id ? { ...t, progress: cleanProgress, updatedAt: new Date().toISOString() } : t
  );
  saveLocalTasks(updated);
  return updated;
}

export async function deleteTask(id: string): Promise<Task[]> {
  // Sinkronkan ke Server DB
  if (typeof window !== "undefined") {
    try {
      await fetch(`/api/db/tasks?id=${id}`, { method: "DELETE" });
    } catch (e) {
      console.warn("Gagal hapus tugas di server DB:", e);
    }
  }

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from("tasks").delete().eq("id", id);
    } catch (err) {
      console.warn("Gagal menghapus tugas di Supabase:", err);
    }
  }

  const existing = getLocalTasks().filter((t) => t.id !== id);
  const updated = syncTasksWithAutoPoints(existing);
  saveLocalTasks(updated);
  return updated;
}

export async function addMemberToTask(
  taskId: string,
  memberData: string | UserProfile
): Promise<Task[]> {
  let userId = `user-${Date.now()}`;
  let fullName = "Mahasiswa BSI";
  let avatarUrl: string | undefined;

  if (typeof memberData === "string") {
    const name = memberData.split("@")[0];
    fullName = name.charAt(0).toUpperCase() + name.slice(1);
    avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${name}`;
  } else {
    userId = memberData.id;
    fullName = memberData.fullName;
    avatarUrl = memberData.avatarUrl;
  }

  const newMember: TaskMember = {
    userId,
    taskId,
    fullName,
    avatarUrl,
    role: "member",
    joinedAt: new Date().toISOString(),
  };

  // 1. Sinkronkan ke Server DB via PUT /api/db/tasks dan AWAIT
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/db/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, newMember }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.task) {
          const tasks = getLocalTasks();
          const idx = tasks.findIndex((t) => t.id === taskId);
          if (idx >= 0) {
            tasks[idx] = json.task;
          } else {
            tasks.unshift(json.task);
          }
          saveLocalTasks(tasks);
          return tasks;
        }
      }
    } catch (e) {
      console.warn("Gagal menambahkan anggota tugas di server DB:", e);
    }
  }

  const tasks = getLocalTasks();
  const updated = tasks.map((t) => {
    if (t.id === taskId) {
      const currentMembers = t.members || [];
      // Hindari duplikasi jika sudah terdaftar
      if (currentMembers.some((m) => m.userId === userId || m.fullName.toLowerCase() === fullName.toLowerCase())) {
        return t;
      }
      return {
        ...t,
        members: [...currentMembers, newMember],
        updatedAt: new Date().toISOString(),
      };
    }
    return t;
  });
  saveLocalTasks(updated);

  return updated;
}

export async function removeMemberFromTask(taskId: string, userId: string): Promise<Task[]> {
  const tasks = getLocalTasks();
  const updated = tasks.map((t) => {
    if (t.id === taskId) {
      return {
        ...t,
        members: (t.members || []).filter((m) => m.userId !== userId),
        updatedAt: new Date().toISOString(),
      };
    }
    return t;
  });
  saveLocalTasks(updated);

  // Sinkronkan ke Server DB
  if (typeof window !== "undefined") {
    const target = updated.find((t) => t.id === taskId);
    if (target) {
      fetch("/api/db/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, updates: { members: target.members } }),
      }).catch(() => {});
    }
  }

  return updated;
}

// ============================================================================
// SISTEM UNDANGAN KOLABORASI TUGAS (TASK INVITATIONS)
// ============================================================================

export function getTaskInvitations(currentUserEmail?: string): TaskInvitation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TASK_INVITATIONS_KEY);
    const list: TaskInvitation[] = raw ? JSON.parse(raw) : [];
    if (currentUserEmail) {
      const clean = currentUserEmail.toLowerCase().trim();
      return list.filter((i) => i.invitedEmail.toLowerCase().trim() === clean);
    }
    return list;
  } catch {
    return [];
  }
}

export function saveTaskInvitations(invitations: TaskInvitation[]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(TASK_INVITATIONS_KEY, JSON.stringify(invitations));
  }
}

export async function fetchTaskInvitations(currentUserEmail?: string): Promise<TaskInvitation[]> {
  const activeEmail = currentUserEmail || getCurrentUser()?.email;

  if (typeof window !== "undefined" && activeEmail) {
    try {
      const res = await fetch(`/api/db/invitations?email=${encodeURIComponent(activeEmail)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.invitations)) {
          saveTaskInvitations(json.invitations);
          return json.invitations;
        }
      }
    } catch (e) {
      console.warn("Gagal mengambil undangan dari server DB:", e);
    }
  }

  return getTaskInvitations(activeEmail);
}

export async function sendTaskInvitation(data: {
  taskId: string;
  taskTitle: string;
  courseName?: string;
  invitedEmail: string;
  inviterUser: UserProfile;
}): Promise<{ success: boolean; invitation?: TaskInvitation; error?: string }> {
  const cleanEmail = data.invitedEmail.trim().toLowerCase();
  const invitations = getTaskInvitations();

  // Cek apakah sudah ada undangan aktif untuk email ini di tugas yang sama
  const existing = invitations.find(
    (inv) =>
      inv.taskId === data.taskId &&
      inv.invitedEmail.toLowerCase() === cleanEmail &&
      inv.status === "pending"
  );
  if (existing) {
    return {
      success: false,
      error: "Undangan kolaborasi tugas ini sudah dikirimkan sebelumnya ke mahasiswa tersebut.",
    };
  }

  const newInvitation: TaskInvitation = {
    id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    taskId: data.taskId,
    taskTitle: data.taskTitle,
    courseName: data.courseName,
    invitedEmail: cleanEmail,
    tokenHash: `tk-${data.taskId.slice(-6)}`,
    status: "pending",
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    invitedBy: data.inviterUser.id,
    inviterName: data.inviterUser.fullName,
    inviterAvatar: data.inviterUser.avatarUrl,
    createdAt: new Date().toISOString(),
  };

  invitations.unshift(newInvitation);
  saveTaskInvitations(invitations);

  // Sinkronkan ke Server DB
  if (typeof window !== "undefined") {
    try {
      await fetch("/api/db/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitation: newInvitation }),
      });
    } catch (e) {
      console.warn("Gagal simpan undangan ke server DB:", e);
    }
  }

  return { success: true, invitation: newInvitation };
}

export async function acceptTaskInvitation(
  invitationId: string,
  currentUser: UserProfile
): Promise<{ success: boolean; task?: Task; newCourseAdded?: Course; error?: string }> {
  // 1. Panggil API server agar status undangan, penambahan anggota ke task.members, dan mata kuliah diproses secara atomik
  let serverResult: { success: boolean; task?: Task; course?: Course; newCourseAdded?: Course; invitation?: TaskInvitation; error?: string } | null = null;
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/db/invitations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId, status: "accepted", user: currentUser }),
      });
      if (res.ok) {
        serverResult = await res.json();
      }
    } catch (e) {
      console.warn("Gagal update undangan di server:", e);
    }
  }

  // 2. Tandai sebagai accepted di lokal
  const invitations = getTaskInvitations();
  const updatedInv = invitations.map((i) =>
    i.id === invitationId ? { ...i, status: "accepted" as const } : i
  );
  saveTaskInvitations(updatedInv);

  let targetTask = serverResult?.task;
  let targetCourse = serverResult?.course;

  // 3. Simpan task yang sudah ter-update ke localStorage pengguna ini
  if (targetTask) {
    const localTasks = getLocalTasks();
    const tIdx = localTasks.findIndex((t) => t.id === targetTask!.id);
    if (tIdx >= 0) {
      localTasks[tIdx] = targetTask;
    } else {
      localTasks.unshift(targetTask);
    }
    saveLocalTasks(localTasks);
  } else {
    // Fallback jika server gagal
    const updatedTasks = await addMemberToTask(invitationId, currentUser);
    targetTask = updatedTasks.find((t) => t.id === invitationId);
  }

  // 4. Jika server mengembalikan mata kuliah baru, simpan ke localStorage (hanya jika belum ada mata kuliah dengan nama yang sama)
  if (targetCourse) {
    const localCourses = getLocalCourses();
    const cIdx = localCourses.findIndex(
      (c) => c.id === targetCourse!.id || c.name.toLowerCase().trim() === targetCourse!.name.toLowerCase().trim()
    );
    if (cIdx < 0) {
      localCourses.unshift(targetCourse);
      saveLocalCourses(localCourses);
    }
  }

  // 5. Sinkronkan ke Supabase jika aktif
  if (isSupabaseConfigured && supabase && targetTask) {
    try {
      await supabase.from("task_members").upsert([
        {
          task_id: targetTask.id,
          user_id: currentUser.id,
          role: "member",
          joined_at: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      console.warn("Gagal simpan anggota ke Supabase:", err);
    }
  }

  return {
    success: true,
    task: targetTask,
    newCourseAdded: serverResult?.newCourseAdded || undefined,
  };
}

export async function declineTaskInvitation(
  invitationId: string
): Promise<{ success: boolean; error?: string }> {
  const invitations = getTaskInvitations();
  const updatedInv = invitations.map((i) =>
    i.id === invitationId ? { ...i, status: "declined" as const } : i
  );
  saveTaskInvitations(updatedInv);

  if (typeof window !== "undefined") {
    fetch("/api/db/invitations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitationId, status: "declined" }),
    }).catch(() => {});
  }

  return { success: true };
}

export function getUserPendingInvitations(email: string): TaskInvitation[] {
  const cleanEmail = email.trim().toLowerCase();
  const all = getTaskInvitations();
  return all.filter(
    (inv) => inv.invitedEmail.toLowerCase() === cleanEmail && inv.status === "pending"
  );
}

/**
 * Mengambil seluruh mahasiswa terdaftar secara lokal (sinkron)
 */
export function getAllRegisteredStudents(): UserProfile[] {
  const list: UserProfile[] = [];
  const seenEmails = new Set<string>();

  const accounts = getRegisteredAccounts();
  for (const acc of accounts) {
    if (acc.user && acc.user.email && !seenEmails.has(acc.user.email.toLowerCase())) {
      list.push(acc.user);
      seenEmails.add(acc.user.email.toLowerCase());
    }
  }

  return list;
}

/**
 * Mengambil seluruh mahasiswa terdaftar dari Server Database & Supabase (asinkron)
 */
export async function fetchRegisteredStudents(query?: string): Promise<UserProfile[]> {
  const list: UserProfile[] = [];
  const seenEmails = new Set<string>();

  // 1. Ambil dari Supabase Profiles langsung jika terkonfigurasi
  if (isSupabaseConfigured && supabase) {
    try {
      let supaQuery = supabase.from("profiles").select("*");
      if (query && query.trim()) {
        const q = query.trim();
        supaQuery = supaQuery.or(`full_name.ilike.%${q}%,nim.ilike.%${q}%,email.ilike.%${q}%`);
      }
      const { data, error } = await supaQuery;
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          const clean = row.email?.toLowerCase().trim();
          if (clean && !seenEmails.has(clean)) {
            list.push({
              id: row.id,
              fullName: row.full_name,
              email: row.email,
              nim: row.nim || "",
              major: row.major || "Teknologi Informasi",
              semester: row.semester || 1,
              campus: row.campus || "Universitas BSI (Bina Sarana Informatika)",
              avatarUrl: row.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${row.nim || row.id}`,
              createdAt: row.created_at,
            });
            seenEmails.add(clean);
          }
        }
      }
    } catch (err) {
      console.warn("Supabase profiles fetch note:", err);
    }
  }

  // 1.5 Ambil dari Server Database API (yang juga memeriksa Supabase di server)
  if (typeof window !== "undefined") {
    try {
      const qParam = query && query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
      const res = await fetch(`/api/db/students${qParam}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.students)) {
          for (const s of json.students) {
            const clean = s.email?.toLowerCase().trim();
            if (clean && !seenEmails.has(clean)) {
              list.push(s);
              seenEmails.add(clean);
            }
          }
        }
      }
    } catch (e) {
      console.warn("Gagal mengambil mahasiswa terdaftar dari server DB:", e);
    }
  }

  // 2. Gabungkan dengan akun lokal yang tersimpan
  const localAccounts = getRegisteredAccounts();
  for (const acc of localAccounts) {
    if (acc.user && acc.user.email) {
      const clean = acc.user.email.toLowerCase().trim();
      if (!seenEmails.has(clean)) {
        if (!query || query.trim() === "" ||
            acc.user.fullName.toLowerCase().includes(query.toLowerCase()) ||
            (acc.user.nim && acc.user.nim.toLowerCase().includes(query.toLowerCase())) ||
            clean.includes(query.toLowerCase())) {
          list.push(acc.user);
          seenEmails.add(clean);
        }
      }
    }
  }

  return list;
}

/**
 * Mencari mahasiswa berdasarkan nama atau NIM di sistem TugasKu
 */
export function searchStudentsByName(query: string): {
  found: boolean;
  students: UserProfile[];
} {
  const clean = query.trim().toLowerCase();
  if (!clean) return { found: false, students: [] };

  const all = getAllRegisteredStudents();
  const matched = all.filter(
    (s) =>
      s.fullName.toLowerCase().includes(clean) ||
      (s.nim && s.nim.includes(clean))
  );

  return {
    found: matched.length > 0,
    students: matched,
  };
}

// ============================================================================
// SISTEM AUTENTIKASI MAHASISWA & MANAJEMEN SESI (SUPABASE & LOCAL FALLBACK)
// ============================================================================

interface RegisteredAccount {
  user: UserProfile;
  password: string;
}

interface PendingVerification {
  code: string;
  user: UserProfile;
  password: string;
  createdAt: number;
}

function getRegisteredAccounts(): RegisteredAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(REGISTERED_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRegisteredAccounts(accounts: RegisteredAccount[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(accounts));
  }
}

function getPendingVerifications(): Record<string, PendingVerification> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PENDING_VERIFICATIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePendingVerifications(data: Record<string, PendingVerification>) {
  if (typeof window !== "undefined") {
    localStorage.setItem(PENDING_VERIFICATIONS_KEY, JSON.stringify(data));
  }
}

/**
 * Mengambil data user yang sedang login di local storage.
 * TIDAK melakukan auto-login: Mengembalikan null jika belum ada sesi aktif.
 */
export function getCurrentUser(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveCurrentUser(user: UserProfile | null) {
  if (typeof window !== "undefined") {
    if (user) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_USER_KEY);
    }
  }
}

/**
 * Mengambil sesi aktif dari Supabase jika terkonfigurasi, atau dari local cache.
 * Jika tidak ada sesi login, mengembalikan null agar website menampilkan login page.
 */
export async function getActiveSessionUser(): Promise<UserProfile | null> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (!error && session?.user) {
        // Ambil profil detail dari tabel public.profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();

        const userProfile: UserProfile = {
          id: session.user.id,
          fullName:
            profile?.full_name ||
            session.user.user_metadata?.full_name ||
            session.user.email?.split("@")[0] ||
            "Mahasiswa",
          email: session.user.email || profile?.email || "",
          nim: profile?.nim || session.user.user_metadata?.nim,
          major: profile?.major || session.user.user_metadata?.major || "Teknologi Informasi",
          semester: profile?.semester || session.user.user_metadata?.semester || 1,
          campus: profile?.campus || "Universitas BSI (Bina Sarana Informatika)",
          avatarUrl: profile?.avatar_url || session.user.user_metadata?.avatar_url,
          createdAt: session.user.created_at,
        };

        saveCurrentUser(userProfile);
        return userProfile;
      }
    } catch (err) {
      console.warn("Gagal memeriksa sesi Supabase:", err);
    }
  }

  return getCurrentUser();
}

export async function updateUserProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
  const current = getCurrentUser();
  if (!current) {
    throw new Error("Tidak ada sesi pengguna aktif");
  }
  const updated: UserProfile = {
    ...current,
    ...updates,
  };

  // Sinkronkan ke Server DB
  if (typeof window !== "undefined") {
    fetch("/api/db/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: updated }),
    }).catch(() => {});
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (userId) {
        await supabase
          .from("profiles")
          .update({
            full_name: updated.fullName,
            nim: updated.nim,
            major: updated.major,
            semester: updated.semester,
            campus: updated.campus,
            avatar_url: updated.avatarUrl,
          })
          .eq("id", userId);
      }
    } catch (err) {
      console.warn("Gagal update profil di Supabase:", err);
    }
  }

  saveCurrentUser(updated);

  const accounts = getRegisteredAccounts();
  const nextAccounts = accounts.map((acc) => {
    if (acc.user.id === updated.id || acc.user.email.toLowerCase() === updated.email.toLowerCase()) {
      return {
        ...acc,
        user: updated,
      };
    }
    return acc;
  });
  saveRegisteredAccounts(nextAccounts);

  return updated;
}

export async function loginStudent(
  email: string,
  password: string
): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
  // ZERO-TRUST INPUT VALIDATION: Jangan pernah percaya input user mentah
  const emailCheck = validateStudentEmail(email);
  if (!emailCheck.isValid) {
    return { success: false, error: emailCheck.error };
  }
  const cleanEmail = emailCheck.cleanEmail;

  if (typeof password !== "string" || !password.trim()) {
    return { success: false, error: "Password wajib diisi" };
  }

  // 1. Cek akun terdaftar di penyimpanan lokal TugasKu
  const accounts = getRegisteredAccounts();
  const localFound = accounts.find(
    (acc) => acc.user.email.toLowerCase() === cleanEmail
  );

  if (localFound) {
    if (localFound.password !== password) {
      return { success: false, error: "Password yang Anda masukkan salah" };
    }
    saveCurrentUser(localFound.user);
    return { success: true, user: localFound.user };
  }

  // 2. Cek di Server Database (jika akun didaftarkan dari browser / sesi lain)
  if (typeof window !== "undefined") {
    try {
      const res = await fetch(`/api/db/students?q=${encodeURIComponent(cleanEmail)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.students)) {
          const matched = json.students.find(
            (s: UserProfile) => s.email.toLowerCase().trim() === cleanEmail
          );
          if (matched) {
            // Caching lokal agar login berikutnya instan
            const accs = getRegisteredAccounts();
            if (!accs.some((a) => a.user.email.toLowerCase() === cleanEmail)) {
              accs.push({ user: matched, password });
              saveRegisteredAccounts(accs);
            }
            saveCurrentUser(matched);
            return { success: true, user: matched };
          }
        }
      }
    } catch (e) {
      console.warn("Gagal cek server DB saat login:", e);
    }
  }

  // 3. Jika tidak ada di lokal dan Supabase aktif, coba login via Supabase Auth
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      });

      if (!error && data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", data.user.id)
          .single();

        const userProfile: UserProfile = {
          id: data.user.id,
          fullName:
            profile?.full_name ||
            data.user.user_metadata?.full_name ||
            cleanEmail.split("@")[0],
          email: cleanEmail,
          nim: profile?.nim || data.user.user_metadata?.nim || "",
          major: profile?.major || data.user.user_metadata?.major || "Teknologi Informasi",
          semester: profile?.semester || data.user.user_metadata?.semester || 1,
          campus: profile?.campus || "Universitas BSI (Bina Sarana Informatika)",
          avatarUrl: profile?.avatar_url || data.user.user_metadata?.avatar_url,
          createdAt: data.user.created_at,
        };

        // Cache lokal agar sesi login tersimpan di browser
        const accs = getRegisteredAccounts();
        if (!accs.some((a) => a.user.email.toLowerCase() === cleanEmail)) {
          accs.push({ user: userProfile, password });
          saveRegisteredAccounts(accs);
        }

        saveCurrentUser(userProfile);
        return { success: true, user: userProfile };
      } else if (error) {
        if (error.message?.includes("Invalid login credentials") || (error as any).code === "invalid_credentials") {
          return { success: false, error: "Password yang Anda masukkan salah atau email belum terdaftar" };
        }
        if (error.message?.includes("Email not confirmed") || (error as any).code === "email_not_confirmed") {
          return { success: false, error: "Akun belum aktif di Supabase. Pastikan opsi 'Confirm email' dimatikan di Supabase Dashboard." };
        }
      }
    } catch (err: any) {
      console.warn("Supabase Auth fallback:", err);
    }
  }

  return {
    success: false,
    error: "Akun email student tidak ditemukan. Silakan daftar terlebih dahulu.",
  };
}

export async function requestStudentRegistration(data: {
  fullName: string;
  nim: string;
  email: string;
  password: string;
  major?: string;
  semester?: number;
}): Promise<{
  success: boolean;
  isSupabaseEmailSent?: boolean;
  user?: UserProfile;
  error?: string;
}> {
  // ZERO-TRUST VALIDATION & SANITIZATION SEBELUM DIPROSES
  const nameCheck = validateFullName(data.fullName);
  if (!nameCheck.isValid) {
    return { success: false, error: nameCheck.error };
  }

  const nimCheck = validateNim(data.nim);
  if (!nimCheck.isValid) {
    return { success: false, error: nimCheck.error };
  }

  const emailCheck = validateStudentEmail(data.email);
  if (!emailCheck.isValid) {
    return { success: false, error: emailCheck.error };
  }

  const passCheck = validatePassword(data.password);
  if (!passCheck.isValid) {
    return { success: false, error: passCheck.error };
  }

  const semCheck = validateSemester(data.semester);
  if (!semCheck.isValid) {
    return { success: false, error: semCheck.error };
  }

  const majorCheck = validateMajor(data.major);

  const cleanName = nameCheck.cleanName;
  const cleanNim = nimCheck.cleanNim;
  const cleanEmail = emailCheck.cleanEmail;
  const cleanPass = passCheck.cleanPassword!;
  const cleanSemester = semCheck.cleanSemester;
  const cleanMajor = majorCheck.cleanMajor;

  // 1. Cek apakah NIM atau Email sudah terdaftar di lokal
  const accounts = getRegisteredAccounts();
  const isExisting = accounts.some(
    (acc) => acc.user.email.toLowerCase() === cleanEmail || acc.user.nim === cleanNim
  );

  if (isExisting) {
    return { success: false, error: "NIM atau Email student sudah terdaftar. Silakan login." };
  }

  // 1.5 Cek di Server Database
  if (typeof window !== "undefined") {
    try {
      const checkRes = await fetch(`/api/db/students?q=${encodeURIComponent(cleanEmail)}`);
      if (checkRes.ok) {
        const checkJson = await checkRes.json();
        if (checkJson.success && Array.isArray(checkJson.students)) {
          const serverExists = checkJson.students.some(
            (s: UserProfile) => s.email.toLowerCase().trim() === cleanEmail || s.nim === cleanNim
          );
          if (serverExists) {
            return { success: false, error: "NIM atau Email student sudah terdaftar. Silakan login." };
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. Buat kode verifikasi 6-digit numerik aman & rahasia
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  const newUser: UserProfile = {
    id: `user-${Date.now()}`,
    fullName: cleanName,
    email: cleanEmail,
    nim: cleanNim,
    major: cleanMajor,
    semester: cleanSemester,
    campus: "Universitas BSI (Bina Sarana Informatika)",
    avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanNim}`,
    createdAt: new Date().toISOString(),
  };

  const pending = getPendingVerifications();
  pending[cleanEmail] = {
    code,
    user: newUser,
    password: cleanPass,
    createdAt: Date.now(),
  };
  savePendingVerifications(pending);

  // 3. KIRIM KODE OTP LANGSUNG KE EMAIL MAHASISWA VIA BREVO HTTP API (INSTAN 1-3 DETIK)
  try {
    const emailRes = await fetch("/api/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: cleanEmail,
        otpCode: code,
        studentName: cleanName,
      }),
    });

    const emailData = await emailRes.json().catch(() => ({}));

    if (!emailRes.ok) {
      console.error("[BREVO EMAIL ERROR]", emailData);
      return {
        success: false,
        error:
          emailData.error ||
          "Gagal mengirimkan kode verifikasi ke email. Pastikan BREVO_API_KEY dan BREVO_SENDER_EMAIL diatur dengan benar.",
      };
    }

    console.info(`[EMAIL OTP BREVO] Kode verifikasi berhasil dikirim ke ${cleanEmail}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal terhubung ke API email";
    console.error("[EMAIL FETCH ERROR]", msg);
    return {
      success: false,
      error: "Gagal menghubungi server email. Pastikan koneksi internet aktif.",
    };
  }

  return { success: true, isSupabaseEmailSent: false };
}

export async function verifyStudentRegistration(
  email: string,
  inputCode: string
): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
  // ZERO-TRUST VALIDATION PADA EMAIL DAN KODE OTP
  const emailCheck = validateStudentEmail(email);
  if (!emailCheck.isValid) {
    return { success: false, error: emailCheck.error };
  }

  const codeCheck = validateOtpCode(inputCode);
  if (!codeCheck.isValid) {
    return { success: false, error: codeCheck.error };
  }

  const cleanEmail = emailCheck.cleanEmail;
  const cleanCode = codeCheck.cleanCode;

  // 1. Verifikasi kode OTP dari pending verifikasi
  const pending = getPendingVerifications();
  const item = pending[cleanEmail];

  if (!item) {
    return {
      success: false,
      error: "Sesi verifikasi tidak ditemukan atau telah kedaluwarsa. Silakan lakukan pendaftaran ulang.",
    };
  }

  // Cek kedaluwarsa kode (15 menit)
  const isExpired = Date.now() - item.createdAt > 15 * 60 * 1000;
  if (isExpired) {
    delete pending[cleanEmail];
    savePendingVerifications(pending);
    return {
      success: false,
      error: "Kode verifikasi telah kedaluwarsa (berlaku 15 menit). Silakan minta kode baru.",
    };
  }

  if (item.code !== cleanCode) {
    return {
      success: false,
      error: "Kode verifikasi 6-digit salah. Silakan periksa kembali email Anda.",
    };
  }

  // 2. Kode valid! Simpan akun terdaftar di lokal
  const accounts = getRegisteredAccounts().filter(
    (acc) => acc.user.email.toLowerCase() !== cleanEmail && acc.user.nim !== item.user.nim
  );
  accounts.push({
    user: item.user,
    password: item.password,
  });
  saveRegisteredAccounts(accounts);

  delete pending[cleanEmail];
  savePendingVerifications(pending);

  saveCurrentUser(item.user);

  // 3. SIMPAN KE SERVER DATABASE AGAR AKUN LANGSUNG TERSEDIA DI SEMUA BROWSER & SESI
  if (typeof window !== "undefined") {
    try {
      await fetch("/api/db/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: item.user,
          password: item.password,
        }),
      });
    } catch (e) {
      console.warn("Gagal simpan mahasiswa ke server DB:", e);
    }
  }

  // 4. Sinkronisasi latar belakang ke Supabase jika aktif (opsional & non-blocking)
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: authRes } = await supabase.auth.signUp({
        email: cleanEmail,
        password: item.password,
        options: {
          data: {
            full_name: item.user.fullName,
            nim: item.user.nim,
            major: item.user.major,
            semester: item.user.semester,
            campus: item.user.campus,
            avatar_url: item.user.avatarUrl,
          },
        },
      });

      const authUserId = authRes?.user?.id;
      if (authUserId) {
        item.user.id = authUserId;
        saveCurrentUser(item.user);
        await supabase.from("profiles").upsert({
          id: authUserId,
          full_name: item.user.fullName,
          email: cleanEmail,
          nim: item.user.nim,
          major: item.user.major,
          semester: item.user.semester,
          campus: item.user.campus,
          avatar_url: item.user.avatarUrl,
        });
      }
    } catch (e) {
      console.warn("[SUPABASE SYNC] Non-critical background sync note:", e);
    }
  }

  return { success: true, user: item.user };
}

export async function logoutStudent(): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("Supabase signOut error:", e);
    }
  }
  saveCurrentUser(null);
}

/**
 * Hapus sesi dan reset akun uji coba lokal
 */
export function resetRegisteredAccounts(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(REGISTERED_USERS_KEY);
    localStorage.removeItem(PENDING_VERIFICATIONS_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(TASK_INVITATIONS_KEY);
    localStorage.removeItem("tugasku_registered_users_v1");
    localStorage.removeItem("tugasku_registered_users_v2");
    localStorage.removeItem("tugasku_pending_verifications_v1");
    localStorage.removeItem("tugasku_auth_user_v1");
  }
}

/**
 * Reset seluruh data (mata kuliah, tugas, dan akun) ke status awal
 */
export function resetAllDataToDefault(): void {
  resetRegisteredAccounts();
  if (typeof window !== "undefined") {
    localStorage.removeItem(COURSES_KEY);
    localStorage.removeItem(TASKS_KEY);
  }
}
