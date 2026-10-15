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
// HELPER DEDUPLIKASI MATA KULIAH (COURSES)
// ============================================================================

/**
 * Deduplikasi mutlak mata kuliah berdasarkan nama (case-insensitive & trimmed).
 * Aturan:
 * 1. Tidak boleh ada 2 mata kuliah dengan nama yang sama.
 * 2. Prioritaskan mata kuliah manual buatan pengguna (bukan placeholder KOLAB).
 * 3. Prioritaskan mata kuliah milik pengguna (ownerId sesuai userId / email).
 * 4. Pertahankan data yang paling lengkap (dosen, kode MK, warna).
 */
export function cleanAndDeduplicateCourses(
  courses: Course[],
  userId?: string,
  email?: string
): Course[] {
  if (!Array.isArray(courses)) return [];
  const cleanEmail = email ? email.toLowerCase().trim() : "";
  const cleanUserId = userId ? userId.toLowerCase().trim() : "";
  const mapByName = new Map<string, Course>();

  for (const c of courses) {
    if (!c || !c.name) continue;
    const normName = c.name.trim().toLowerCase();
    if (!normName) continue;

    const existing = mapByName.get(normName);
    if (!existing) {
      mapByName.set(normName, c);
      continue;
    }

    const existingIsColab = existing.code === "KOLAB" || existing.lecturer === "Dosen Pengampu";
    const currentIsColab = c.code === "KOLAB" || c.lecturer === "Dosen Pengampu";

    const existingIsOwner = (cleanUserId && existing.ownerId?.toLowerCase().trim() === cleanUserId) ||
      (cleanEmail && existing.ownerId?.toLowerCase().trim() === cleanEmail);
    const currentIsOwner = (cleanUserId && c.ownerId?.toLowerCase().trim() === cleanUserId) ||
      (cleanEmail && c.ownerId?.toLowerCase().trim() === cleanEmail);

    let chooseCurrent = false;

    if (existingIsColab && !currentIsColab) {
      // Yang baru bukan placeholder KOLAB, sedangkan yang lama cuma placeholder
      chooseCurrent = true;
    } else if (!existingIsColab && currentIsColab) {
      // Pertahankan yang asli
      chooseCurrent = false;
    } else if (!existingIsOwner && currentIsOwner) {
      // Yang baru milik user langsung
      chooseCurrent = true;
    } else if (existingIsOwner && !currentIsOwner) {
      chooseCurrent = false;
    } else {
      // Utamakan data yang memiliki dosen/kode MK yang spesifik
      const existingScore = (existing.lecturer && existing.lecturer !== "Dosen Pengampu" ? 2 : 0) +
        (existing.code && existing.code !== "KOLAB" ? 2 : 0);
      const currentScore = (c.lecturer && c.lecturer !== "Dosen Pengampu" ? 2 : 0) +
        (c.code && c.code !== "KOLAB" ? 2 : 0);
      chooseCurrent = currentScore > existingScore;
    }

    if (chooseCurrent) {
      mapByName.set(normName, c);
    }
  }

  return Array.from(mapByName.values());
}

// ============================================================================
// HELPER LOCAL STORAGE
// ============================================================================

function getLocalCourses(): Course[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(COURSES_KEY);
    const parsed: Course[] = raw ? JSON.parse(raw) : [];
    return cleanAndDeduplicateCourses(parsed);
  } catch {
    return [];
  }
}

function saveLocalCourses(courses: Course[]) {
  if (typeof window !== "undefined") {
    const cleaned = cleanAndDeduplicateCourses(courses);
    localStorage.setItem(COURSES_KEY, JSON.stringify(cleaned));
  }
}

function getLocalTasks(): Task[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Filter dan bersihkan tugas anomali (tugas tanpa judul atau record profil/matakuliah)
    const valid = parsed.filter(
      (t) =>
        t &&
        typeof t === "object" &&
        t.title &&
        typeof t.title === "string" &&
        t.title.trim() !== "" &&
        !t.id?.startsWith("course-") &&
        !t.id?.startsWith("profile-") &&
        (t as any).task_id !== "COURSE_RECORD" &&
        (t as any).task_id !== "PROFILE_RECORD"
    );
    if (valid.length !== parsed.length) {
      localStorage.setItem(TASKS_KEY, JSON.stringify(valid));
    }
    return syncTasksWithAutoPoints(valid);
  } catch {
    return [];
  }
}

function saveLocalTasks(tasks: Task[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  }
}

const DELETED_TASKS_KEY = "tugasku_deleted_task_ids_v1";

export function getDeletedTaskIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DELETED_TASKS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function recordDeletedTaskId(id: string): void {
  if (typeof window === "undefined" || !id) return;
  try {
    const current = getDeletedTaskIds();
    current.add(id);
    localStorage.setItem(DELETED_TASKS_KEY, JSON.stringify(Array.from(current).slice(-200)));
  } catch {}
}

export function unrecordDeletedTaskId(id: string): void {
  if (typeof window === "undefined" || !id) return;
  try {
    const current = getDeletedTaskIds();
    if (current.has(id)) {
      current.delete(id);
      localStorage.setItem(DELETED_TASKS_KEY, JSON.stringify(Array.from(current)));
    }
  } catch {}
}

/**
 * Mengecek apakah pengguna saat ini adalah pemilik / pembuat tugas kelompok atau tugas individu.
 * Mencocokkan ID, email, NIM, dan role "owner" pada daftar anggota tugas.
 */
export function checkIsTaskOwner(task: Task, user?: UserProfile | null): boolean {
  if (!user) return false;

  const userIds = [
    user.id?.toLowerCase().trim(),
    user.email?.toLowerCase().trim(),
    user.nim?.toLowerCase().trim(),
    user.fullName?.toLowerCase().trim(),
  ].filter(Boolean) as string[];

  const taskCreator = (task.createdBy || "").toLowerCase().trim();

  if (task.taskType !== "group") {
    if (taskCreator) {
      return userIds.some(
        (uid) => uid === taskCreator || taskCreator.includes(uid) || uid.includes(taskCreator)
      );
    }
    return true;
  }

  if (taskCreator && userIds.some((uid) => uid === taskCreator || taskCreator.includes(uid) || uid.includes(taskCreator))) {
    return true;
  }

  // Cek apakah user memiliki member role === "owner"
  if (task.members && task.members.length > 0) {
    const isOwnerMember = task.members.some((m) => {
      if (m.role !== "owner") return false;
      const mUser = (m.userId || "").toLowerCase().trim();
      const mName = (m.fullName || "").toLowerCase().trim();
      const mEmail = ((m as any).email || "").toLowerCase().trim();
      return userIds.some(
        (uid) =>
          uid === mUser ||
          uid === mName ||
          uid === mEmail ||
          (user.nim && (mName.includes(user.nim.toLowerCase().trim()) || mUser.includes(user.nim.toLowerCase().trim())))
      );
    });
    if (isOwnerMember) return true;
  }

  // Fallback: Jika tugas tidak memiliki createdBy atau anggota kosong, anggap user pemegang adalah pemilik
  if (!task.createdBy && (!task.members || task.members.length === 0)) {
    return true;
  }

  return false;
}


/**
 * Membersihkan dan mendeduplikasi daftar anggota tugas kelompok (TaskMember[]).
 * - Menghilangkan data duplikat yang hanya berisi NIM (misal "19251525") jika sudah ada nama asli mahasiswa.
 * - Menggabungkan entri duplikat berdasarkan ID profil, email, atau NIM.
 * - Memprioritaskan nama asli lengkap, avatar, dan role "owner".
 */
export function cleanAndDeduplicateMembers(
  members: TaskMember[],
  studentsList?: UserProfile[]
): TaskMember[] {
  if (!Array.isArray(members) || members.length === 0) return [];

  let students = studentsList;
  if (!students || students.length === 0) {
    try {
      students = getAllRegisteredStudents();
    } catch {
      students = [];
    }
  }

  const isDigitOnly = (str: string) => /^\d+$/.test(str.trim());
  const deduplicatedMap = new Map<string, TaskMember>();

  for (const m of members) {
    if (!m) continue;
    const rawUserId = (m.userId || "").trim();
    const rawName = (m.fullName || "").trim();
    const lowerName = rawName.toLowerCase();
    const lowerUserId = rawUserId.toLowerCase();

    // 1. Cari kecocokan profil mahasiswa
    const matchedStudent = students.find((s) => {
      if (s.id && s.id.toLowerCase() === lowerUserId) return true;
      if (s.email && s.email.toLowerCase().trim() === lowerUserId) return true;
      if (s.fullName && s.fullName.toLowerCase().trim() === lowerName) return true;
      if (s.nim && (lowerName === s.nim.toLowerCase().trim() || lowerUserId.includes(s.nim.toLowerCase().trim()) || lowerName.includes(s.nim.toLowerCase().trim()))) return true;
      if (lowerUserId.includes("@") && s.email && s.email.toLowerCase().startsWith(lowerUserId.split("@")[0])) return true;
      if (isDigitOnly(lowerName) && s.nim && lowerName === s.nim.toLowerCase().trim()) return true;
      if (isDigitOnly(lowerName) && s.email && s.email.toLowerCase().startsWith(lowerName + "@")) return true;
      return false;
    });

    // 2. Kunci kanonikal identitas orang ini
    let canonicalKey = "";
    if (matchedStudent) {
      canonicalKey = `student:${(matchedStudent.id || matchedStudent.email).toLowerCase().trim()}`;
    } else if (lowerUserId.includes("@")) {
      canonicalKey = `email:${lowerUserId}`;
    } else if (isDigitOnly(rawName)) {
      canonicalKey = `nim:${lowerName}`;
    } else if (lowerName) {
      canonicalKey = `name:${lowerName}`;
    } else {
      canonicalKey = `user:${lowerUserId}`;
    }

    // 3. Properti nama & ID yang disempurnakan
    let resolvedFullName = rawName;
    let resolvedUserId = rawUserId;
    let resolvedAvatar = m.avatarUrl;

    if (matchedStudent) {
      if (matchedStudent.fullName && (!resolvedFullName || isDigitOnly(resolvedFullName) || resolvedFullName === matchedStudent.nim)) {
        resolvedFullName = matchedStudent.fullName;
      }
      if (matchedStudent.id && (!resolvedUserId || resolvedUserId.includes("@") || isDigitOnly(resolvedUserId))) {
        resolvedUserId = matchedStudent.id;
      }
      if (matchedStudent.avatarUrl) {
        resolvedAvatar = matchedStudent.avatarUrl;
      }
    }

    const candidate: TaskMember = {
      ...m,
      userId: resolvedUserId,
      fullName: resolvedFullName,
      avatarUrl: resolvedAvatar,
    };

    if (!deduplicatedMap.has(canonicalKey)) {
      deduplicatedMap.set(canonicalKey, candidate);
    } else {
      const existing = deduplicatedMap.get(canonicalKey)!;
      const isCandidateOwner = candidate.role === "owner";
      const isExistingOwner = existing.role === "owner";

      // Nama terbaik: prioritaskan nama manusia bukan angka NIM
      let bestName = existing.fullName;
      if (isDigitOnly(bestName) && !isDigitOnly(candidate.fullName)) {
        bestName = candidate.fullName;
      } else if (!bestName && candidate.fullName) {
        bestName = candidate.fullName;
      }

      // ID terbaik: prioritaskan UUID dibanding email
      let bestUserId = existing.userId;
      if (bestUserId.includes("@") && !candidate.userId.includes("@")) {
        bestUserId = candidate.userId;
      }

      // Avatar terbaik
      let bestAvatar = existing.avatarUrl || candidate.avatarUrl;
      if (matchedStudent?.avatarUrl) {
        bestAvatar = matchedStudent.avatarUrl;
      }

      deduplicatedMap.set(canonicalKey, {
        userId: bestUserId,
        taskId: candidate.taskId || existing.taskId,
        fullName: bestName,
        avatarUrl: bestAvatar,
        role: isCandidateOwner || isExistingOwner ? "owner" : "member",
        joinedAt: existing.joinedAt || candidate.joinedAt || new Date().toISOString(),
      });
    }
  }

  // Filter pengaman kedua: buang entri duplikat yang hanya berisi digit angka jika nama aslinya sudah ada
  const result = Array.from(deduplicatedMap.values());
  const finalMembers: TaskMember[] = [];

  for (const item of result) {
    if (isDigitOnly(item.fullName)) {
      const matchedProfile = students.find(
        (s) => s.nim === item.fullName || (s.email && s.email.toLowerCase().startsWith(item.fullName.toLowerCase() + "@"))
      );
      if (matchedProfile) {
        const hasHumanSibling = result.some(
          (other) => other !== item && other.fullName.toLowerCase().trim() === matchedProfile.fullName.toLowerCase().trim()
        );
        if (hasHumanSibling) {
          continue; // Buang duplikat NIM karena profil manusia aslinya sudah ada
        }
        item.fullName = matchedProfile.fullName;
        item.userId = matchedProfile.id || item.userId;
        item.avatarUrl = matchedProfile.avatarUrl || item.avatarUrl;
      }
    }
    const alreadyInFinal = finalMembers.some(
      (f) =>
        f.userId.toLowerCase() === item.userId.toLowerCase() ||
        f.fullName.toLowerCase().trim() === item.fullName.toLowerCase().trim()
    );
    if (!alreadyInFinal) {
      finalMembers.push(item);
    }
  }

  return finalMembers;
}

// ============================================================================
// OPERASI MATA KULIAH (COURSES)
// ============================================================================

export async function fetchCourses(userParam?: UserProfile | null): Promise<Course[]> {
  const activeUser = userParam || getCurrentUser();
  const userId = activeUser?.id;
  const cleanEmail = activeUser?.email?.toLowerCase().trim() || "";
  const collectedCourses: Course[] = [];

  // Jika tidak ada user yang sedang login, kembalikan daftar kosong
  if (!activeUser || (!userId && !cleanEmail)) {
    return [];
  }

  // 1. Ambil penyimpanan lokal terlebih dahulu (hanya yang terverifikasi milik user ini)
  const local = getLocalCourses();
  for (const c of local) {
    const isOwner =
      (userId && c.ownerId === userId) ||
      (cleanEmail && c.ownerId?.toLowerCase().trim() === cleanEmail);
    if (isOwner) {
      collectedCourses.push(c);
    }
  }

  // 2. Ambil dari Supabase courses jika terkonfigurasi
  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase.from("courses").select("*").order("created_at", { ascending: false });
      if (userId) {
        query = query.eq("owner_id", userId);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        for (const c of data) {
          collectedCourses.push({
            id: c.id,
            name: c.name,
            lecturer: c.lecturer,
            code: c.code,
            color: c.color,
            ownerId: c.owner_id,
            createdAt: c.created_at,
            updatedAt: c.updated_at,
          });
        }
      }
    } catch (err) {
      console.warn("Gagal mengambil data mata kuliah dari Supabase:", err);
    }
  }

  // 3. Ambil dari Server Database API jika ada
  if (typeof window !== "undefined") {
    try {
      const qParams = new URLSearchParams();
      if (userId) qParams.set("userId", userId);
      if (cleanEmail) qParams.set("email", cleanEmail);

      const url = `/api/db/courses${qParams.toString() ? `?${qParams.toString()}` : ""}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.courses) && json.courses.length > 0) {
          for (const c of json.courses) {
            collectedCourses.push(c);
          }
        }
      }
    } catch (e) {
      console.warn("Gagal mengambil mata kuliah dari server DB:", e);
    }
  }

  // Deduplikasi awal terhadap mata kuliah manual / tersimpan
  let currentCourses = cleanAndDeduplicateCourses(collectedCourses, userId, cleanEmail);

  // 4. Ambil mata kuliah dari kolaborasi Supabase (collaboration_invitations)
  // HANYA buatkan placeholder jika mata kuliah tersebut BENAR-BENAR BELUM ADA di daftar pengguna!
  const deletedTaskIds = getDeletedTaskIds();
  if (isSupabaseConfigured && supabase && (userId || cleanEmail)) {
    try {
      const { data: collabRows } = await supabase
        .from("collaboration_invitations")
        .select("*");
      if (Array.isArray(collabRows)) {
        for (const row of collabRows) {
          const rowInvitedEmail = (row.invited_email || "").toLowerCase().trim();
          const rowInvitedBy = (row.invited_by || "").toLowerCase().trim();
          const rowInviterName = (row.inviter_name || "").toLowerCase().trim();
          const userFullName = (activeUser?.fullName || "").toLowerCase().trim();

          const isInviter =
            (userId && (rowInvitedBy === userId.toLowerCase() || row.task_payload?.createdBy === userId)) ||
            (cleanEmail && (rowInvitedBy === cleanEmail || row.task_payload?.createdBy?.toLowerCase().trim() === cleanEmail)) ||
            (userFullName && rowInviterName === userFullName);

          const isMember =
            (cleanEmail && rowInvitedEmail === cleanEmail && row.status === "accepted");

          // Jika pengguna adalah anggota yang diterima, pulihkan ID tugas dari rekaman terhapus
          if (isMember && row.task_id && deletedTaskIds.has(row.task_id)) {
            deletedTaskIds.delete(row.task_id);
            unrecordDeletedTaskId(row.task_id);
          }

          // Abaikan record profil
          if (row.task_id === "PROFILE_RECORD" || row.id.startsWith("profile-")) {
            continue;
          }

          // Jika ini adalah record mata kuliah tersimpan (COURSE_RECORD)
          if (row.task_id === "COURSE_RECORD") {
            const payloadOwner = (row.task_payload?.ownerId || "").toLowerCase().trim();
            const isMatchOwner =
              (userId && payloadOwner === userId.toLowerCase()) ||
              (cleanEmail && payloadOwner === cleanEmail);

            if (isMatchOwner && row.task_payload) {
              const c = row.task_payload as Course;
              currentCourses.push(c);
            } else if (cleanEmail && rowInvitedEmail === cleanEmail && !isMatchOwner) {
              // Ini sisa COURSE_RECORD yatim dari akun terdahulu yang sudah dihapus, bersihkan dari database
              supabase.from("collaboration_invitations").delete().eq("id", row.id).then(() => {});
            }
            continue;
          }

          if (isInviter || isMember) {
            const courseName = (row.course_name || row.task_payload?.courseName || "").trim();
            if (courseName) {
              const cleanCourseName = courseName.toLowerCase();
              const alreadyHas = currentCourses.some(
                (c) => c.name.trim().toLowerCase() === cleanCourseName
              );
              if (!alreadyHas) {
                const autoCourse: Course = {
                  id: `course-${row.task_payload?.courseId || Date.now()}`,
                  name: courseName,
                  lecturer: "Dosen Pengampu",
                  code: "KOLAB",
                  color: "indigo",
                  ownerId: userId || cleanEmail,
                  createdAt: row.created_at || new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };
                currentCourses.push(autoCourse);
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("[COURSES] Supabase collab course fetch note:", e);
    }
  }

  // 5. Pastikan mata kuliah dari tugas kolaborasi lokal otomatis tersedia jika belum ada
  const currentTasks = getLocalTasks().filter((t) => !deletedTaskIds.has(t.id));
  for (const t of currentTasks) {
    const isTaskOfUser =
      checkIsTaskOwner(t, activeUser) ||
      (cleanEmail && t.members?.some((m) => m.userId?.toLowerCase().trim() === cleanEmail));
    if (!isTaskOfUser) continue;

    if (t.courseName) {
      const cleanCourseName = t.courseName.trim().toLowerCase();
      const alreadyHas = currentCourses.some(
        (c) => c.name.trim().toLowerCase() === cleanCourseName
      );
      if (!alreadyHas) {
        const autoCourse: Course = {
          id: `course-${t.courseId || Date.now()}`,
          name: t.courseName,
          lecturer: "Dosen Pengampu",
          code: "KOLAB",
          color: "indigo",
          ownerId: userId || cleanEmail,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        };
        currentCourses.push(autoCourse);
      }
    }
  }

  // 6. Bersihkan mata kuliah kolaborasi otomatis jika anggota sudah tidak lagi memiliki tugas pada mata kuliah tersebut
  currentCourses = currentCourses.filter((c) => {
    if (c.code === "KOLAB") {
      const hasAssociatedTask = currentTasks.some(
        (t) => (t.courseName || "").trim().toLowerCase() === c.name.trim().toLowerCase()
      );
      return hasAssociatedTask;
    }
    return true;
  });

  // 7. Deduplikasi final (dijamin 1 mata kuliah per nama unik)
  const canonicalCourses = cleanAndDeduplicateCourses(currentCourses, userId, cleanEmail);

  // 8. TAUTKAN TUGAS KE MATA KULIAH KANONIKAL PENGGUNA:
  // Jika anggota sudah memiliki mata kuliah tersebut, pastikan tugas kelompok otomatis menggunakan id mata kuliah milik anggota!
  let tasksChanged = false;
  for (const t of currentTasks) {
    if (t.courseName) {
      const cleanName = t.courseName.trim().toLowerCase();
      const canonical = canonicalCourses.find((c) => c.name.trim().toLowerCase() === cleanName);
      if (canonical && t.courseId !== canonical.id) {
        t.courseId = canonical.id;
        t.courseName = canonical.name;
        tasksChanged = true;
      }
    }
  }
  if (tasksChanged) {
    saveLocalTasks(currentTasks);
  }

  saveLocalCourses(canonicalCourses);
  return canonicalCourses;
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
      const cleanEmail = (currentUser?.email || "").toLowerCase().trim();
      await supabase.from("collaboration_invitations").upsert({
        id: `course-${newCourse.id}`,
        task_id: "COURSE_RECORD",
        task_title: newCourse.name,
        course_name: newCourse.name,
        invited_email: cleanEmail,
        token_hash: "course",
        status: "active",
        expires_at: new Date(Date.now() + 365 * 86400000).toISOString(),
        invited_by: newCourse.ownerId,
        task_payload: newCourse as any,
      });
    } catch (err) {
      console.warn("Gagal menyimpan mata kuliah ke Supabase cloud:", err);
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
  if (targetCourse && isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from("collaboration_invitations")
        .update({
          task_title: targetCourse.name,
          course_name: targetCourse.name,
          task_payload: targetCourse as any,
        })
        .eq("id", `course-${id}`);
    } catch (err) {
      console.warn("Gagal update mata kuliah ke Supabase cloud:", err);
    }
  }

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

  return updated;
}

export async function deleteCourse(
  id: string,
  userParam?: UserProfile | null,
  courseParam?: Course
): Promise<{ courses: Course[]; tasks: Task[] }> {
  const activeUser = userParam || getCurrentUser();
  const userId = activeUser?.id;
  const email = activeUser?.email?.toLowerCase().trim();
  const nim = activeUser?.nim?.toLowerCase().trim();

  const existingCourses = getLocalCourses();
  let targetCourse = courseParam || existingCourses.find((c) => c.id === id);
  if (!targetCourse) {
    const localTasks = getLocalTasks();
    const tMatch = localTasks.find((t) => t.courseId === id || (t.courseId && (t.courseId.includes(id) || id.includes(t.courseId))));
    if (tMatch && tMatch.courseName) {
      targetCourse = { id, name: tMatch.courseName, code: "KOLAB", lecturer: "Dosen Pengampu", color: "indigo" };
    }
  }
  const targetCourseName = targetCourse?.name?.toLowerCase().trim();

  const qParams = new URLSearchParams({ id });
  if (userId) qParams.set("userId", userId);
  if (email) qParams.set("email", email);
  if (targetCourse?.name) qParams.set("courseName", targetCourse.name);

  if (typeof window !== "undefined") {
    try {
      await fetch(`/api/db/courses?${qParams.toString()}`, { method: "DELETE" });
    } catch (e) {
      console.warn("Gagal menghapus mata kuliah di server:", e);
    }
  }

  // 1. Hapus dari Supabase cloud (tabel courses) jika aktif
  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase.from("courses").delete().eq("id", id);
      if (userId) {
        query = query.eq("owner_id", userId);
      }
      await query;
      await supabase
        .from("collaboration_invitations")
        .delete()
        .eq("id", `course-${id}`);
    } catch (err) {
      console.warn("Gagal menghapus mata kuliah di Supabase cloud:", err);
    }
  }

  const courses = existingCourses.filter(
    (c) => c.id !== id && (!targetCourseName || c.name.toLowerCase().trim() !== targetCourseName)
  );

  // 2. Bersihkan tugas lokal & lepas keanggotaan kolaborasi:
  // - Tugas kolaborasi milik ketua: lepaskan keanggotaan anggota ini secara tuntas (baik di cloud maupun lokal)
  // - Tugas milik sendiri: hapus permanen (cascade)
  const localTasks = getLocalTasks();
  const remainingTasks: Task[] = [];

  for (const t of localTasks) {
    const isLinked =
      t.courseId === id ||
      (t.courseId && id && (t.courseId.includes(id) || id.includes(t.courseId))) ||
      (targetCourseName && t.courseName?.toLowerCase().trim() === targetCourseName);

    if (!isLinked) {
      remainingTasks.push(t);
      continue;
    }

    const isOwner = checkIsTaskOwner(t, activeUser);

    if (t.taskType === "group" && !isOwner) {
      // ANGGOTA MENGHAPUS MATA KULIAH TUGAS KELOMPOK:
      // Anggota ini otomatis KELUAR dari tugas kelompok di Supabase & dashboard ketua!
      try {
        await removeMemberFromTask(t.id, email || userId || "", activeUser);
      } catch (err) {
        console.warn("Gagal mengeluarkan anggota dari tugas kolaborasi:", err);
      }
      continue;
    } else {
      // Tugas milik sendiri: hapus permanen tugas bersama mata kuliahnya
      try {
        await deleteTask(t.id);
      } catch (err) {
        console.warn("Gagal menghapus tugas milik sendiri:", err);
      }
    }
  }

  // 3. Pemindaian cloud Supabase: lepaskan user dari tugas kelompok yang tertaut dengan matakuliah ini
  if (isSupabaseConfigured && supabase && (email || userId)) {
    try {
      const { data: userCollabRows } = await supabase
        .from("collaboration_invitations")
        .select("*");

      if (Array.isArray(userCollabRows)) {
        for (const row of userCollabRows) {
          const rowCourse = (row.course_name || row.task_payload?.courseName || "").toLowerCase().trim();
          const rowCourseId = (row.task_payload?.courseId || "").toLowerCase().trim();
          const isMatchCourse =
            (targetCourseName && rowCourse === targetCourseName) ||
            rowCourseId === id ||
            (rowCourseId && id && (rowCourseId.includes(id) || id.includes(rowCourseId)));

          if (
            isMatchCourse &&
            row.task_id &&
            row.task_id !== "COURSE_RECORD" &&
            row.task_id !== "PROFILE_RECORD" &&
            !row.id.startsWith("course-") &&
            !row.id.startsWith("profile-")
          ) {
            const rowInvitedEmail = (row.invited_email || "").toLowerCase().trim();
            const isUserRow =
              (email && rowInvitedEmail === email) ||
              (nim && (rowInvitedEmail === `${nim}@bsi.ac.id` || rowInvitedEmail.startsWith(nim + "@")));

            if (isUserRow) {
              await removeMemberFromTask(row.task_id, email || userId || "", activeUser);
            }
          }
        }
      }
    } catch (err) {
      console.warn("Gagal membersihkan tugas kolaborasi cloud:", err);
    }
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
  const cleanEmail = activeUser?.email?.toLowerCase().trim() || "";
  const userNim = (activeUser?.nim || "").toLowerCase().trim();
  const userFullName = (activeUser?.fullName || "").toLowerCase().trim();
  const tasksMap = new Map<string, Task>();

  // Ambil daftar seluruh mahasiswa terdaftar untuk resolusi nama & deduplikasi mutlak
  let allStudents: UserProfile[] = [];
  try {
    allStudents = await fetchRegisteredStudents();
  } catch {
    allStudents = getAllRegisteredStudents();
  }

  // 1. Ambil tugas kolaborasi cloud dari Supabase (collaboration_invitations)
  const deletedTaskIds = getDeletedTaskIds();
  let rawCollabRows: any[] = [];
  let supabaseFetchSuccess = false;
  if (isSupabaseConfigured && supabase && (userId || cleanEmail)) {
    try {
      const { data: collabRows, error: collabErr } = await supabase
        .from("collaboration_invitations")
        .select("*");

      if (!collabErr && Array.isArray(collabRows)) {
        supabaseFetchSuccess = true;
        rawCollabRows = collabRows;
        for (const row of collabRows) {
          // ABAIKAN RECORD NON-TUGAS: COURSE_RECORD dan PROFILE_RECORD BUKAN TUGAS!
          if (
            !row.task_payload ||
            row.task_id === "COURSE_RECORD" ||
            row.task_id === "PROFILE_RECORD" ||
            row.id.startsWith("course-") ||
            row.id.startsWith("profile-")
          ) {
            continue;
          }

          const t = row.task_payload as Task;
          if (
            !t ||
            !t.title ||
            typeof t.title !== "string" ||
            t.title.trim() === "" ||
            t.id?.startsWith("course-") ||
            t.id?.startsWith("profile-")
          ) {
            continue;
          }
            const rowInvitedEmail = (row.invited_email || "").toLowerCase().trim();
            const rowInvitedBy = (row.invited_by || "").toLowerCase().trim();
            const rowInviterName = (row.inviter_name || "").toLowerCase().trim();

            const isAcceptedMember =
              (cleanEmail && rowInvitedEmail === cleanEmail && row.status === "accepted") ||
              (userNim && rowInvitedEmail.startsWith(userNim + "@") && row.status === "accepted");

            // Jika user secara aktif berstatus 'accepted' di cloud, maka tugas ini BUKAN tugas yang terhapus!
            if (isAcceptedMember && deletedTaskIds.has(t.id)) {
              deletedTaskIds.delete(t.id);
              unrecordDeletedTaskId(t.id);
            }

            if (deletedTaskIds.has(t.id)) {
              continue;
            }

            const isInviter =
              (userId && (rowInvitedBy === userId.toLowerCase() || t.createdBy === userId)) ||
              (cleanEmail && (rowInvitedBy === cleanEmail || t.createdBy?.toLowerCase().trim() === cleanEmail)) ||
              (userFullName && rowInviterName === userFullName);

            const isMember =
              isAcceptedMember ||
              (t.members && t.members.some((m) =>
                (userId && m.userId === userId) ||
                (cleanEmail && m.userId?.toLowerCase().trim() === cleanEmail) ||
                (userFullName && m.fullName?.toLowerCase().trim() === userFullName) ||
                (userNim && (m.fullName?.toLowerCase().trim() === userNim || m.userId?.includes(userNim)))
              ));

            if (isInviter || isMember) {
              // Jika status diterima, pastikan anggota terdaftar di t.members dengan nama asli, BUKAN duplikat NIM
              if (row.status === "accepted" && rowInvitedEmail && !row.id.startsWith("task-base-")) {
                const members = t.members || [];
                const student = allStudents.find((s) => s.email.toLowerCase().trim() === rowInvitedEmail);

                const alreadyMember = members.some((m) => {
                  const mUser = (m.userId || "").toLowerCase().trim();
                  const mName = (m.fullName || "").toLowerCase().trim();
                  const mEmail = ((m as any).email || "").toLowerCase().trim();

                  if (mEmail && mEmail === rowInvitedEmail) return true;
                  if (mUser === rowInvitedEmail) return true;
                  if (cleanEmail && rowInvitedEmail === cleanEmail) {
                    if (userId && mUser === userId.toLowerCase()) return true;
                    if (userFullName && mName === userFullName) return true;
                  }
                  if (student) {
                    if (student.id && mUser === student.id.toLowerCase()) return true;
                    if (student.fullName && mName === student.fullName.toLowerCase().trim()) return true;
                    if (student.nim && (mName === student.nim.toLowerCase().trim() || mUser.includes(student.nim.toLowerCase().trim()) || mName.includes(student.nim.toLowerCase().trim()))) return true;
                  }
                  if (mName === rowInvitedEmail.split("@")[0].toLowerCase().trim()) return true;
                  return false;
                });

                if (!alreadyMember) {
                  const memberToAdd: TaskMember = (rowInvitedEmail === cleanEmail && activeUser)
                    ? {
                        userId: userId || rowInvitedEmail,
                        taskId: t.id,
                        fullName: activeUser.fullName,
                        avatarUrl: activeUser.avatarUrl,
                        role: "member" as const,
                        joinedAt: row.created_at || new Date().toISOString(),
                      }
                    : {
                        userId: student?.id || rowInvitedEmail,
                        taskId: t.id,
                        fullName: student?.fullName || rowInvitedEmail.split("@")[0],
                        avatarUrl: student?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${rowInvitedEmail}`,
                        role: "member" as const,
                        joinedAt: row.created_at || new Date().toISOString(),
                      };
                  t.members = cleanAndDeduplicateMembers([...members, memberToAdd], allStudents);
                }
              }

              // PENTING: Saring anggota tugas kelompok terhadap baris undangan aktif di Supabase!
              // Jika seseorang tertera di t.members tetapi baris undangannya sudah dihapus/tidak accepted,
              // berarti orang tersebut sudah keluar/dikeluarkan dari kolaborasi!
              const acceptedInviteeEmailsForTask = new Set(
                collabRows
                  .filter((r) => r.task_id === t.id && r.status === "accepted" && !r.id.startsWith("task-base-"))
                  .map((r) => (r.invited_email || "").toLowerCase().trim())
                  .filter(Boolean)
              );

              const validatedMembers = (t.members || []).filter((m) => {
                const isCreator =
                  (t.createdBy && (
                    m.userId?.toLowerCase() === t.createdBy.toLowerCase() ||
                    (cleanEmail && m.userId?.toLowerCase() === cleanEmail)
                  )) ||
                  (!t.createdBy && m.role === "owner");
                if (isCreator) return true;

                const mUser = (m.userId || "").toLowerCase().trim();
                const mName = (m.fullName || "").toLowerCase().trim();
                const student = allStudents.find(
                  (s) =>
                    (s.id && s.id.toLowerCase() === mUser) ||
                    (s.email && s.email.toLowerCase().trim() === mUser) ||
                    (s.nim && (mName === s.nim.toLowerCase().trim() || mUser.includes(s.nim.toLowerCase().trim()) || mName.includes(s.nim.toLowerCase().trim()))) ||
                    (s.fullName && s.fullName.toLowerCase().trim() === mName)
                );
                const sEmail = (student?.email || mUser).toLowerCase().trim();
                const sNim = (student?.nim || "").toLowerCase().trim();

                const isStillAccepted =
                  acceptedInviteeEmailsForTask.has(sEmail) ||
                  acceptedInviteeEmailsForTask.has(mUser) ||
                  (sNim && Array.from(acceptedInviteeEmailsForTask).some((em) => em.startsWith(sNim + "@") || em.includes(sNim)));

                return isStillAccepted;
              });

              t.members = cleanAndDeduplicateMembers(validatedMembers, allStudents);

              if (!tasksMap.has(t.id)) {
                tasksMap.set(t.id, t);
              } else {
                const existing = tasksMap.get(t.id)!;
                tasksMap.set(t.id, {
                  ...existing,
                  ...t,
                  members: t.members,
                });
              }
            }
        }
      }
    } catch (err) {
      console.warn("[TASKS] Supabase collab fetch note:", err);
    }
  }

  // 2. Ambil dari Server Database API jika ada
  if (typeof window !== "undefined") {
    try {
      const qParams = new URLSearchParams();
      if (userId) qParams.set("userId", userId);
      if (cleanEmail) qParams.set("email", cleanEmail);

      const url = `/api/db/tasks${qParams.toString() ? `?${qParams.toString()}` : ""}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.tasks) && json.tasks.length > 0) {
          for (const t of json.tasks) {
            if (
              t &&
              t.title &&
              typeof t.title === "string" &&
              t.title.trim() !== "" &&
              !t.id?.startsWith("course-") &&
              !t.id?.startsWith("profile-") &&
              !deletedTaskIds.has(t.id) &&
              !tasksMap.has(t.id)
            ) {
              t.members = cleanAndDeduplicateMembers(t.members || [], allStudents);
              tasksMap.set(t.id, t);
            }
          }
        }
      }
    } catch (e) {
      console.warn("Gagal mengambil tugas dari server DB:", e);
    }
  }

  // 3. Gabungkan dengan penyimpanan lokal pengguna (Hanya pertahankan tugas yang masih valid)
  const local = getLocalTasks();
  for (const t of local) {
    if (
      !t ||
      !t.title ||
      typeof t.title !== "string" ||
      t.title.trim() === "" ||
      t.id?.startsWith("course-") ||
      t.id?.startsWith("profile-") ||
      deletedTaskIds.has(t.id)
    ) {
      continue;
    }
    if (!tasksMap.has(t.id)) {
      // Jika tugas kelompok dan fetch Supabase berhasil:
      // Jika tugas kelompok tersebut tidak ada di Supabase, berarti tugas telah dihapus atau pengguna bukan anggota!
      // JANGAN masukkan kembali ke tasksMap dan JANGAN upload kembali ke Supabase!
      if (t.taskType === "group" && isSupabaseConfigured && supabaseFetchSuccess) {
        continue;
      }

      if (activeUser) {
        const isOwner = checkIsTaskOwner(t, activeUser);
        if (isOwner) {
          // Jika Supabase aktif, saring anggota tugas kelompok terhadap undangan yang aktif di Supabase!
          if (isSupabaseConfigured && supabase) {
            const acceptedEmails = new Set(
              rawCollabRows
                .filter((r) => r.task_id === t.id && r.status === "accepted" && !r.id.startsWith("task-base-"))
                .map((r) => (r.invited_email || "").toLowerCase().trim())
                .filter(Boolean)
            );
            t.members = (t.members || []).filter((m) => {
              const isCreator =
                (t.createdBy && (
                  m.userId?.toLowerCase() === t.createdBy.toLowerCase() ||
                  (cleanEmail && m.userId?.toLowerCase() === cleanEmail)
                )) ||
                (!t.createdBy && m.role === "owner");
              if (isCreator) return true;

              const mUser = (m.userId || "").toLowerCase().trim();
              const mName = (m.fullName || "").toLowerCase().trim();
              const student = allStudents.find(
                (s) =>
                  (s.id && s.id.toLowerCase() === mUser) ||
                  (s.email && s.email.toLowerCase().trim() === mUser) ||
                  (s.nim && (mName === s.nim.toLowerCase().trim() || mUser.includes(s.nim.toLowerCase().trim()) || mName.includes(s.nim.toLowerCase().trim()))) ||
                  (s.fullName && s.fullName.toLowerCase().trim() === mName)
              );
              const sEmail = (student?.email || mUser).toLowerCase().trim();
              const sNim = (student?.nim || "").toLowerCase().trim();

              return (
                acceptedEmails.has(sEmail) ||
                acceptedEmails.has(mUser) ||
                (sNim && Array.from(acceptedEmails).some((em) => em.startsWith(sNim + "@") || em.includes(sNim)))
              );
            });
          }

          t.members = cleanAndDeduplicateMembers(t.members || [], allStudents);
          tasksMap.set(t.id, t);
        } else {
          // Jika Supabase aktif, tugas kolaborasi yang tidak ada di cloud untuk user ini
          // berarti anggota ini telah dikeluarkan/dihapus oleh pemilik tugas, sehingga JANGAN masukkan kembali!
          if (!isSupabaseConfigured) {
            const isParticipant =
              t.members &&
              t.members.some(
                (m) =>
                  m.userId === activeUser.id ||
                  (m.userId && m.userId.toLowerCase().trim() === cleanEmail)
              );
            if (isParticipant) {
              t.members = cleanAndDeduplicateMembers(t.members || [], allStudents);
              tasksMap.set(t.id, t);
            }
          }
        }
      } else {
        t.members = cleanAndDeduplicateMembers(t.members || [], allStudents);
        tasksMap.set(t.id, t);
      }
    }
  }

  const rawTasks = Array.from(tasksMap.values())
    .filter(
      (t) =>
        t &&
        t.title &&
        typeof t.title === "string" &&
        t.title.trim() !== "" &&
        !deletedTaskIds.has(t.id) &&
        !t.id?.startsWith("course-") &&
        !t.id?.startsWith("profile-")
    )
    .map((t) => ({
      ...t,
      members: cleanAndDeduplicateMembers(t.members || [], allStudents),
    }));
  const result = syncTasksWithAutoPoints(rawTasks);
  saveLocalTasks(result);
  return result;
}

export async function addTask(task: Omit<Task, "id">): Promise<Task> {
  const currentUser = getCurrentUser();
  const creatorId = task.createdBy || currentUser?.id || currentUser?.email || "";
  const cleanEmail = currentUser?.email?.toLowerCase().trim() || "";

  // Anggota awal untuk tugas kelompok HANYA pembuat tugas itu sendiri (role: owner).
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

  // Simpan record dasar tugas langsung ke Supabase Cloud (collaboration_invitations)
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from("collaboration_invitations").upsert({
        id: `task-base-${newTask.id}`,
        task_id: newTask.id,
        task_title: newTask.title,
        course_name: newTask.courseName || "",
        invited_email: cleanEmail,
        token_hash: `tk-${newTask.id.slice(-6)}`,
        status: "accepted",
        expires_at: new Date(Date.now() + 365 * 86400000).toISOString(),
        invited_by: creatorId,
        inviter_name: currentUser?.fullName || "",
        inviter_avatar: currentUser?.avatarUrl || "",
        task_payload: newTask,
      });
    } catch (err) {
      console.warn("Gagal simpan base task ke Supabase cloud:", err);
    }
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

  // 1. Update di Supabase collaboration_invitations untuk semua anggota kolaborasi secara realtime
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: rows } = await supabase
        .from("collaboration_invitations")
        .select("*")
        .eq("task_id", id);

      if (Array.isArray(rows) && rows.length > 0) {
        for (const row of rows) {
          const currentPayload = (row.task_payload as Task) || {};
          const mergedPayload: Task = {
            ...currentPayload,
            ...updates,
            ...(progress !== undefined ? { progress } : {}),
            updatedAt: new Date().toISOString(),
          };
          await supabase
            .from("collaboration_invitations")
            .update({
              task_title: updates.title || row.task_title,
              course_name: updates.courseName || row.course_name,
              task_payload: mergedPayload,
            })
            .eq("id", row.id);
        }
      }
    } catch (err) {
      console.warn("Gagal update tugas di Supabase cloud:", err);
    }
  }

  // 2. Sinkronkan ke Server DB
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
  return updateTask(id, { progress });
}

export async function deleteTask(id: string): Promise<Task[]> {
  recordDeletedTaskId(id);

  // 1. Hapus dari Supabase collaboration_invitations (semua record terkait taskId ini)
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from("collaboration_invitations")
        .delete()
        .or(`task_id.eq.${id},id.eq.task-base-${id},id.eq.${id}`);

      try {
        await supabase
          .from("tasks")
          .delete()
          .eq("id", id);
      } catch {}
    } catch (err) {
      console.warn("Gagal menghapus tugas dari Supabase cloud:", err);
    }
  }

  // 2. Sinkronkan ke Server DB
  if (typeof window !== "undefined") {
    try {
      await fetch(`/api/db/tasks?id=${id}`, { method: "DELETE" });
    } catch (e) {
      console.warn("Gagal hapus tugas di server DB:", e);
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

  // Sinkronkan ke Server DB
  if (typeof window !== "undefined") {
    try {
      await fetch("/api/db/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, newMember }),
      });
    } catch (e) {
      console.warn("Gagal menambahkan anggota tugas di server DB:", e);
    }
  }

  const tasks = getLocalTasks();
  const updated = tasks.map((t) => {
    if (t.id === taskId) {
      const currentMembers = t.members || [];
      const updatedMembers = cleanAndDeduplicateMembers([...currentMembers, newMember]);
      return {
        ...t,
        members: updatedMembers,
        updatedAt: new Date().toISOString(),
      };
    }
    return t;
  });
  saveLocalTasks(updated);

  return updated;
}

export async function removeMemberFromTask(
  taskId: string,
  targetUserIdOrEmail: string,
  userProfileHint?: UserProfile | null
): Promise<Task[]> {
  const cleanTarget = targetUserIdOrEmail.trim().toLowerCase();
  const tasks = getLocalTasks();
  const targetTask = tasks.find((t) => t.id === taskId);
  const activeUser = userProfileHint || getCurrentUser();

  // Cari profil lengkap mahasiswa yang akan dikeluarkan (id UUID, email, nim, fullName)
  let targetId = userProfileHint?.id?.toLowerCase() || (cleanTarget.includes("@") ? "" : cleanTarget);
  let targetEmail = userProfileHint?.email?.toLowerCase().trim() || (cleanTarget.includes("@") ? cleanTarget : "");
  let targetNim = userProfileHint?.nim?.toLowerCase().trim() || "";
  if (cleanTarget.includes("@") && /^\d+$/.test(cleanTarget.split("@")[0])) {
    targetNim = cleanTarget.split("@")[0];
  } else if (/^\d+$/.test(cleanTarget)) {
    targetNim = cleanTarget;
  }
  let targetFullName = userProfileHint?.fullName?.toLowerCase().trim() || "";

  let allStudents: UserProfile[] = [];
  try {
    allStudents = await fetchRegisteredStudents();
  } catch {
    allStudents = getAllRegisteredStudents();
  }

  // Jika Supabase aktif, query profiles untuk resolusi pasti
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: profs } = await supabase.from("profiles").select("*");
      if (Array.isArray(profs)) {
        for (const p of profs) {
          const pId = (p.id || "").toLowerCase();
          const pEmail = (p.email || "").toLowerCase().trim();
          const pNim = (p.nim || "").toLowerCase().trim();
          const pName = (p.full_name || "").toLowerCase().trim();

          const isMatch =
            (cleanTarget && (pId === cleanTarget || pEmail === cleanTarget || pNim === cleanTarget || pName === cleanTarget)) ||
            (targetId && pId === targetId) ||
            (targetEmail && pEmail === targetEmail) ||
            (targetNim && (pNim === targetNim || pEmail === `${targetNim}@bsi.ac.id` || pEmail.startsWith(`${targetNim}@`)));

          if (isMatch) {
            targetId = targetId || pId;
            targetEmail = targetEmail || pEmail;
            targetNim = targetNim || pNim;
            targetFullName = targetFullName || pName;
          }
        }
      }
    } catch (err) {
      console.warn("Supabase profiles query in removeMember note:", err);
    }
  }

  const matchedStudent = allStudents.find((s) => {
    const sId = (s.id || "").toLowerCase();
    const sEmail = (s.email || "").toLowerCase().trim();
    const sNim = (s.nim || "").toLowerCase().trim();
    const sName = (s.fullName || "").toLowerCase().trim();

    if (sId && sId === cleanTarget) return true;
    if (sEmail && sEmail === cleanTarget) return true;
    if (sNim && (sNim === cleanTarget || cleanTarget === `${sNim}@bsi.ac.id` || (cleanTarget.includes("@") && cleanTarget.split("@")[0] === sNim))) return true;
    if (sName && sName === cleanTarget) return true;
    return false;
  });

  if (matchedStudent) {
    targetId = matchedStudent.id ? matchedStudent.id.toLowerCase() : targetId;
    targetEmail = matchedStudent.email ? matchedStudent.email.toLowerCase().trim() : targetEmail;
    targetNim = matchedStudent.nim ? matchedStudent.nim.toLowerCase().trim() : targetNim;
    targetFullName = matchedStudent.fullName ? matchedStudent.fullName.toLowerCase().trim() : targetFullName;
  } else if (targetTask?.members) {
    const m = targetTask.members.find((mem) => {
      const mUser = (mem.userId || "").toLowerCase().trim();
      const mName = (mem.fullName || "").toLowerCase().trim();
      return mUser === cleanTarget || (cleanTarget && mName === cleanTarget);
    });
    if (m) {
      if (m.userId.includes("@")) {
        targetEmail = targetEmail || m.userId.toLowerCase().trim();
      } else {
        targetId = targetId || m.userId.toLowerCase();
      }
      targetFullName = targetFullName || m.fullName.toLowerCase().trim();
    }
  }

  // Fungsi pencocokan anggota yang dikeluarkan (mencakup ID, email, NIM, nama lengkap, atau target)
  const isTargetMember = (m: TaskMember) => {
    // Ketua / owner tugas tidak pernah boleh dikeluarkan lewat fungsi ini
    if (m.role === "owner") return false;

    const mUser = (m.userId || "").toLowerCase().trim();
    const mName = (m.fullName || "").toLowerCase().trim();
    const mEmail = ((m as any).email || "").toLowerCase().trim();

    // 1. Cek langsung dengan cleanTarget
    if (cleanTarget && (mUser === cleanTarget || mEmail === cleanTarget || mName === cleanTarget)) return true;

    // 2. Cek UUID ID pasti
    if (targetId && mUser === targetId) return true;

    // 3. Cek Email pasti
    if (targetEmail && (mUser === targetEmail || mEmail === targetEmail)) return true;

    // 4. Cek NIM pasti
    if (targetNim && (mUser === targetNim || (m as any).nim?.toLowerCase().trim() === targetNim || mUser === `${targetNim}@bsi.ac.id` || mEmail === `${targetNim}@bsi.ac.id` || mUser.startsWith(`${targetNim}@`))) return true;

    // 5. Cek Nama Lengkap (persis)
    if (targetFullName && mName === targetFullName) return true;

    return false;
  };

  // 1. Sinkronkan ke Supabase Cloud Database secara realtime
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: collabRows } = await supabase
        .from("collaboration_invitations")
        .select("*")
        .eq("task_id", taskId);

      if (Array.isArray(collabRows)) {
        for (const row of collabRows) {
          const rowEmail = (row.invited_email || "").toLowerCase().trim();
          const isBaseRow = row.id.startsWith("task-base-");

          // Row undangan anggota yang harus dihapus:
          // HANYA baris undangan spesifik milik anggota yang dikeluarkan (BUKAN base row, BUKAN baris anggota lain!)
          const isTargetMemberRow =
            !isBaseRow &&
            Boolean(
              row.id === cleanTarget ||
              (targetEmail && rowEmail === targetEmail) ||
              (cleanTarget && rowEmail === cleanTarget) ||
              (targetNim && (rowEmail === `${targetNim}@bsi.ac.id` || rowEmail.startsWith(`${targetNim}@`)))
            );

          if (isTargetMemberRow) {
            // Hapus HANYA baris undangan anggota yang dikeluarkan dari database cloud!
            await supabase
              .from("collaboration_invitations")
              .delete()
              .eq("id", row.id);
          } else if (row.task_payload) {
            // Perbarui task_payload di baris lain (termasuk row base pembuat dan anggota lain yang tetap tinggal)
            const payload = row.task_payload as Task;
            const currentMembers = payload.members || [];
            const filteredMembers = currentMembers.filter((m) => !isTargetMember(m));
            payload.members = cleanAndDeduplicateMembers(filteredMembers, allStudents);
            payload.updatedAt = new Date().toISOString();

            await supabase
              .from("collaboration_invitations")
              .update({ task_payload: payload })
              .eq("id", row.id);
          }
        }

        // Pastikan row base milik creator tetap ada dan diperbarui di Supabase
        const hasBaseRow = collabRows.some((r) => r.id === `task-base-${taskId}`);
        if (!hasBaseRow && targetTask) {
          const creatorProfile = allStudents.find(
            (s) =>
              (targetTask.createdBy && s.id.toLowerCase() === targetTask.createdBy.toLowerCase()) ||
              (targetTask.createdBy && s.email.toLowerCase().trim() === targetTask.createdBy.toLowerCase().trim())
          );
          const creatorEmail = creatorProfile?.email || targetTask.createdBy || "";
          const cleanMembersForCreator = (targetTask.members || []).filter((m) => !isTargetMember(m));

          await supabase.from("collaboration_invitations").upsert({
            id: `task-base-${taskId}`,
            task_id: taskId,
            task_title: targetTask.title,
            course_name: targetTask.courseName || "",
            invited_email: creatorEmail.toLowerCase().trim(),
            token_hash: `tk-${taskId.slice(-6)}`,
            status: "accepted",
            expires_at: new Date(Date.now() + 365 * 86400000).toISOString(),
            invited_by: targetTask.createdBy,
            inviter_name: creatorProfile?.fullName || "",
            inviter_avatar: creatorProfile?.avatarUrl || "",
            task_payload: {
              ...targetTask,
              members: cleanAndDeduplicateMembers(cleanMembersForCreator, allStudents),
              updatedAt: new Date().toISOString(),
            },
          });
        }
      }
    } catch (err) {
      console.warn("[REMOVE MEMBER] Supabase sync error:", err);
    }
  }

  // Bersihkan undangan di local storage jika ada
  try {
    const localInvs = getTaskInvitations();
    const updatedLocalInvs = localInvs.filter((inv) => {
      if (inv.taskId !== taskId) return true;
      const invEmail = (inv.invitedEmail || "").toLowerCase().trim();
      const isMatch =
        inv.id === cleanTarget ||
        (targetEmail && invEmail === targetEmail) ||
        (cleanTarget && invEmail === cleanTarget) ||
        (targetNim && (invEmail === `${targetNim}@bsi.ac.id` || invEmail.startsWith(`${targetNim}@`)));
      return !isMatch;
    });
    if (updatedLocalInvs.length !== localInvs.length) {
      saveTaskInvitations(updatedLocalInvs);
    }
  } catch (err) {
    console.warn("Gagal update local task invitations:", err);
  }

  // 2. Perbarui penyimpanan lokal pembuat tugas atau buang tugas jika pemanggil adalah anggota yang keluar sendiri
  const isTaskCreatorOrOwner = targetTask && (
    checkIsTaskOwner(targetTask, activeUser) ||
    (activeUser?.id && targetTask.createdBy?.toLowerCase() === activeUser.id.toLowerCase()) ||
    (activeUser?.email && targetTask.createdBy?.toLowerCase().trim() === activeUser.email.toLowerCase().trim())
  );

  const isSelfLeaving = !isTaskCreatorOrOwner && Boolean(
    activeUser && (
      isTargetMember({
        userId: activeUser.id,
        fullName: activeUser.fullName,
        email: activeUser.email,
        role: "member",
      } as any) ||
      (cleanTarget && (
        (activeUser.id && activeUser.id.toLowerCase() === cleanTarget) ||
        (activeUser.email && activeUser.email.toLowerCase().trim() === cleanTarget) ||
        (activeUser.nim && activeUser.nim.toLowerCase().trim() === cleanTarget)
      ))
    )
  );

  let updatedTasks: Task[];
  if (isSelfLeaving) {
    recordDeletedTaskId(taskId);
    updatedTasks = tasks.filter((t) => t.id !== taskId);
  } else {
    updatedTasks = tasks.map((t) => {
      if (t.id === taskId) {
        const filteredMembers = (t.members || []).filter((m) => !isTargetMember(m));
        return {
          ...t,
          members: cleanAndDeduplicateMembers(filteredMembers, allStudents),
          updatedAt: new Date().toISOString(),
        };
      }
      return t;
    });
  }
  saveLocalTasks(updatedTasks);

  // 3. Sinkronkan ke Server DB jika ada
  if (typeof window !== "undefined") {
    const target = updatedTasks.find((t) => t.id === taskId);
    if (target) {
      fetch("/api/db/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, updates: { members: target.members } }),
      }).catch(() => {});
    }
  }

  return updatedTasks;
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
  const activeEmail = (currentUserEmail || getCurrentUser()?.email || "").toLowerCase().trim();
  if (!activeEmail) return [];

  const invitationsMap = new Map<string, TaskInvitation>();

  let allStudents: UserProfile[] = [];
  try {
    allStudents = await fetchRegisteredStudents();
  } catch {
    allStudents = getAllRegisteredStudents();
  }

  // 1. Ambil langsung dari Supabase Cloud jika terkonfigurasi (sumber data utama)
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from("collaboration_invitations")
        .select("*")
        .eq("invited_email", activeEmail)
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        for (const row of data) {
          // Hanya ambil undangan tugas kolaborasi asli (abaikan record non-undangan)
          if (
            row.task_id === "COURSE_RECORD" ||
            row.task_id === "PROFILE_RECORD" ||
            row.id.startsWith("course-") ||
            row.id.startsWith("profile-") ||
            row.id.startsWith("task-base-") ||
            !row.task_title
          ) {
            continue;
          }

          // Pastikan inviter_name dan inviter_avatar adalah milik pengundang (BUKAN milik penerima undangan)
          let finalInviterName = row.inviter_name;
          let finalInviterAvatar = row.inviter_avatar;

          const inviterId = (row.invited_by || (row.task_payload as any)?.createdBy || "").toLowerCase().trim();
          const inviterProfile = allStudents.find((s) => {
            if (inviterId) {
              if (s.id && s.id.toLowerCase() === inviterId) return true;
              if (s.email && s.email.toLowerCase().trim() === inviterId) return true;
            }
            return false;
          });

          if (inviterProfile) {
            finalInviterName = inviterProfile.fullName || finalInviterName;
            finalInviterAvatar = inviterProfile.avatarUrl || finalInviterAvatar;
          } else if (row.task_payload?.members) {
            const ownerMem = row.task_payload.members.find((m: any) => m.role === "owner");
            if (ownerMem) {
              finalInviterName = ownerMem.fullName || finalInviterName;
              finalInviterAvatar = ownerMem.avatarUrl || finalInviterAvatar;
            }
          }

          const inv: TaskInvitation = {
            id: row.id,
            taskId: row.task_id,
            taskTitle: row.task_title,
            courseName: row.course_name,
            invitedEmail: row.invited_email,
            tokenHash: row.token_hash,
            status: row.status as any,
            expiresAt: row.expires_at,
            invitedBy: row.invited_by,
            inviterName: finalInviterName,
            inviterAvatar: finalInviterAvatar,
            createdAt: row.created_at,
          };
          invitationsMap.set(inv.id, inv);
        }
      }
    } catch (err) {
      console.warn("[INVITATIONS] Supabase direct fetch note:", err);
    }
  }

  // 2. Ambil dari Server Database API (Next.js route)
  if (typeof window !== "undefined") {
    try {
      const res = await fetch(`/api/db/invitations?email=${encodeURIComponent(activeEmail)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.invitations)) {
          for (const inv of json.invitations) {
            if (!invitationsMap.has(inv.id)) {
              invitationsMap.set(inv.id, inv);
            }
          }
        }
      }
    } catch (e) {
      console.warn("Gagal mengambil undangan dari server DB:", e);
    }
  }

  // 3. Gabungkan dengan penyimpanan lokal (abaikan pending lokal usang jika cloud sudah accepted/declined)
  const localList = getTaskInvitations(activeEmail);
  for (const inv of localList) {
    if (!invitationsMap.has(inv.id)) {
      const alreadyHandledInCloud = Array.from(invitationsMap.values()).some(
        (cloudInv) =>
          cloudInv.taskId === inv.taskId &&
          cloudInv.status !== "pending"
      );
      if (!alreadyHandledInCloud) {
        const inviterId = (inv.invitedBy || "").toLowerCase().trim();
        const inviterProfile = allStudents.find((s) => {
          if (inviterId) {
            if (s.id && s.id.toLowerCase() === inviterId) return true;
            if (s.email && s.email.toLowerCase().trim() === inviterId) return true;
          }
          return false;
        });
        if (inviterProfile) {
          inv.inviterName = inviterProfile.fullName || inv.inviterName;
          inv.inviterAvatar = inviterProfile.avatarUrl || inv.inviterAvatar;
        }
        invitationsMap.set(inv.id, inv);
      }
    }
  }

  const result = Array.from(invitationsMap.values());
  saveTaskInvitations(result);
  return result;
}

export async function sendTaskInvitation(data: {
  taskId: string;
  taskTitle: string;
  courseName?: string;
  invitedEmail: string;
  inviterUser: UserProfile;
  task?: Task;
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

  // Bersihkan undangan lama untuk email ini pada tugas yang sama agar data selalu segar
  const filteredInvitations = invitations.filter(
    (inv) => !(inv.taskId === data.taskId && inv.invitedEmail.toLowerCase() === cleanEmail)
  );

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

  filteredInvitations.unshift(newInvitation);
  saveTaskInvitations(filteredInvitations);

  // 1. Simpan langsung ke Supabase Cloud jika terkonfigurasi
  if (isSupabaseConfigured && supabase) {
    try {
      // Hapus row undangan lama yang mungkin tersisa untuk email ini pada tugas yang sama
      await supabase
        .from("collaboration_invitations")
        .delete()
        .eq("task_id", newInvitation.taskId)
        .eq("invited_email", cleanEmail)
        .neq("id", newInvitation.id);

      await supabase.from("collaboration_invitations").upsert({
        id: newInvitation.id,
        task_id: newInvitation.taskId,
        task_title: newInvitation.taskTitle,
        course_name: newInvitation.courseName || "",
        invited_email: cleanEmail,
        token_hash: newInvitation.tokenHash,
        status: newInvitation.status,
        expires_at: newInvitation.expiresAt,
        invited_by: newInvitation.invitedBy,
        inviter_name: newInvitation.inviterName || "",
        inviter_avatar: newInvitation.inviterAvatar || "",
        task_payload: data.task || null,
      });
    } catch (err) {
      console.warn("[INVITATIONS] Supabase direct upsert note:", err);
    }
  }

  // 2. Sinkronkan ke Server DB (Next.js route)
  if (typeof window !== "undefined") {
    try {
      await fetch("/api/db/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitation: newInvitation, task: data.task }),
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
  let invRow: any = null;
  let taskToJoin: Task | null = null;
  let courseNameToAdd: string = "";

  // 1. Ambil data undangan langsung dari Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      const { data } = await supabase
        .from("collaboration_invitations")
        .select("*")
        .eq("id", invitationId)
        .maybeSingle();
      if (data) {
        invRow = data;
        if (data.task_payload) {
          taskToJoin = { ...(data.task_payload as Task) };
        }
        courseNameToAdd = data.course_name || taskToJoin?.courseName || "";
      }
    } catch (err) {
      console.warn("[INVITATIONS] Supabase select inv note:", err);
    }
  }

  // Fallback ke Supabase task-base jika task_payload belum lengkap di row undangan
  if ((!taskToJoin || !taskToJoin.title) && isSupabaseConfigured && supabase && invRow?.task_id) {
    try {
      const { data: baseRow } = await supabase
        .from("collaboration_invitations")
        .select("*")
        .eq("id", `task-base-${invRow.task_id}`)
        .maybeSingle();
      if (baseRow && baseRow.task_payload) {
        taskToJoin = { ...(baseRow.task_payload as Task) };
        courseNameToAdd = courseNameToAdd || baseRow.course_name || taskToJoin?.courseName || "";
      }
    } catch (err) {
      console.warn("[INVITATIONS] Supabase baseRow fallback note:", err);
    }
  }

  // Fallback ke penyimpanan lokal jika taskToJoin belum ada
  if (!taskToJoin) {
    const localInvs = getTaskInvitations();
    const foundInv = localInvs.find((i) => i.id === invitationId);
    if (foundInv) {
      courseNameToAdd = foundInv.courseName || "";
      const localTasks = getLocalTasks();
      const match = localTasks.find((t) => t.id === foundInv.taskId);
      if (match) {
        taskToJoin = { ...match };
      }
    }
  }

  // Hapus tugas ini dari deletedTaskIds seketika agar tidak terblokir lagi
  const targetTaskId = invRow?.task_id || (invRow?.task_payload as any)?.id || taskToJoin?.id;
  if (targetTaskId) {
    unrecordDeletedTaskId(targetTaskId);
  }

  // Jika masih belum ada, buat task dari info baris undangan
  if (!taskToJoin && invRow) {
    taskToJoin = {
      id: invRow.task_id || `task-${Date.now()}`,
      courseId: invRow.task_payload?.courseId || `course-${Date.now()}`,
      title: invRow.task_title || "Tugas Kelompok",
      courseName: invRow.course_name || "Mata Kuliah Umum",
      points: 100,
      progress: 0,
      taskType: "group",
      deadline: invRow.expires_at || new Date(Date.now() + 7 * 86400000).toISOString(),
      createdAt: invRow.created_at || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: invRow.invited_by || "user-partner",
      members: [
        {
          userId: invRow.invited_by || "user-partner",
          taskId: invRow.task_id || "",
          fullName: invRow.inviter_name || "Pengundang",
          avatarUrl: invRow.inviter_avatar || "",
          role: "owner",
          joinedAt: invRow.created_at || new Date().toISOString(),
        },
      ],
    };
  }

  // 2. Tambahkan currentUser sebagai anggota kelompok di taskToJoin dengan nama asli lengkap
  if (taskToJoin) {
    const members = taskToJoin.members || [];
    const cleanUserId = currentUser.id;
    const cleanEmail = (currentUser.email || "").toLowerCase().trim();
    const cleanNim = (currentUser.nim || "").toLowerCase().trim();
    const cleanName = (currentUser.fullName || "").toLowerCase().trim();

    // Singkirkan data placeholder atau duplikat lama untuk user ini
    const filteredMembers = members.filter((m) => {
      const mUser = (m.userId || "").toLowerCase().trim();
      const mName = (m.fullName || "").toLowerCase().trim();
      if (cleanUserId && mUser === cleanUserId.toLowerCase()) return false;
      if (cleanEmail && mUser === cleanEmail) return false;
      if (cleanNim && (mName === cleanNim || mUser.includes(cleanNim))) return false;
      if (cleanName && mName === cleanName) return false;
      return true;
    });

    const newMember: TaskMember = {
      userId: currentUser.id,
      taskId: taskToJoin.id,
      fullName: currentUser.fullName,
      avatarUrl: currentUser.avatarUrl,
      role: "member",
      joinedAt: new Date().toISOString(),
    };

    taskToJoin.members = cleanAndDeduplicateMembers([...filteredMembers, newMember]);
    taskToJoin.updatedAt = new Date().toISOString();
  }

  // 3. Update status undangan & task_payload di Supabase Cloud untuk seluruh baris terkait tugas ini
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from("collaboration_invitations")
        .update({
          status: "accepted",
          task_payload: taskToJoin || undefined,
        })
        .eq("id", invitationId);

      // PENTING: Perbarui juga baris dasar pembuat tugas (task-base-${taskToJoin.id})
      // dan seluruh baris anggota lain agar nama anggota baru langsung tersinkronisasi tanpa duplikat!
      if (taskToJoin) {
        await supabase
          .from("collaboration_invitations")
          .update({
            task_payload: taskToJoin,
          })
          .eq("task_id", taskToJoin.id);
      }
    } catch (err) {
      console.warn("[INVITATIONS] Supabase update status note:", err);
    }
  }

  // 4. Update status undangan di lokal
  const localInvs = getTaskInvitations();
  const updatedInvs = localInvs.map((i) =>
    i.id === invitationId ? { ...i, status: "accepted" as const } : i
  );
  saveTaskInvitations(updatedInvs);

  // 5. Pastikan mata kuliah ditautkan ke mata kuliah anggota tanpa membuat duplikat
  let createdNewCourse: Course | undefined = undefined;
  const targetCourseName = (courseNameToAdd || taskToJoin?.courseName || "").trim();
  if (targetCourseName) {
    let currentCourses = getLocalCourses();
    const cleanName = targetCourseName.toLowerCase();
    const existingCourse = currentCourses.find((c) => c.name.trim().toLowerCase() === cleanName);

    if (existingCourse) {
      // JIKA MATA KULIAH SUDAH ADA DI ANGGOTA:
      // Tautkan tugas ke mata kuliah yang sudah ada tersebut dan JANGAN duplikasi!
      if (taskToJoin) {
        taskToJoin.courseId = existingCourse.id;
        taskToJoin.courseName = existingCourse.name;
      }
      createdNewCourse = undefined; // Tandai bahwa mata kuliah tidak dibuat baru
      saveLocalCourses(cleanAndDeduplicateCourses(currentCourses, currentUser.id, currentUser.email));
    } else {
      // JIKA MATA KULIAH BELUM ADA:
      // Tambahkan mata kuliah baru beserta tugasnya
      createdNewCourse = {
        id: `course-${taskToJoin?.courseId || Date.now()}`,
        name: targetCourseName,
        lecturer: "Dosen Pengampu",
        code: "KOLAB",
        color: "indigo",
        ownerId: currentUser.id || currentUser.email,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      currentCourses.unshift(createdNewCourse);
      saveLocalCourses(cleanAndDeduplicateCourses(currentCourses, currentUser.id, currentUser.email));
      if (taskToJoin) {
        taskToJoin.courseId = createdNewCourse.id;
        taskToJoin.courseName = createdNewCourse.name;
      }
    }
  }

  // 6. Simpan task yang sudah digabungkan ke localStorage pengguna ini (dengan courseId yang sudah tepat)
  if (taskToJoin) {
    unrecordDeletedTaskId(taskToJoin.id);
    const localTasks = getLocalTasks();
    const tIdx = localTasks.findIndex((t) => t.id === taskToJoin!.id);
    if (tIdx >= 0) {
      localTasks[tIdx] = taskToJoin;
    } else {
      localTasks.unshift(taskToJoin);
    }
    saveLocalTasks(localTasks);
  }

  // 7. Sync ke API route serverDb jika aktif
  if (typeof window !== "undefined") {
    try {
      await fetch("/api/db/invitations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId, status: "accepted", user: currentUser }),
      });
    } catch {
      // ignore
    }
  }

  return {
    success: true,
    task: taskToJoin || undefined,
    newCourseAdded: createdNewCourse,
  };
}

export async function declineTaskInvitation(
  invitationId: string
): Promise<{ success: boolean; error?: string }> {
  // Update status di Supabase jika aktif
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from("collaboration_invitations")
        .update({ status: "declined" })
        .eq("id", invitationId);
    } catch (err) {
      console.warn("[INVITATIONS] Supabase decline note:", err);
    }
  }

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

  // 1. Ambil dari Supabase PostgreSQL Cloud (Single Source of Truth)
  if (isSupabaseConfigured && supabase) {
    const activeEmailsInProfiles = new Set<string>();

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
            activeEmailsInProfiles.add(clean);
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

    // 1.2 Sinkronkan foto avatar realtime dari PROFILE_RECORD HANYA untuk akun yang masih ada di profiles
    try {
      const { data: profileRecords, error } = await supabase
        .from("collaboration_invitations")
        .select("*")
        .eq("task_id", "PROFILE_RECORD");

      if (!error && Array.isArray(profileRecords)) {
        for (const row of profileRecords) {
          const clean = row.invited_email?.toLowerCase().trim();
          if (clean) {
            if (activeEmailsInProfiles.has(clean)) {
              const item = list.find((s) => s.email.toLowerCase().trim() === clean);
              if (item) {
                const updatedAvatar = row.inviter_avatar || (row.task_payload as any)?.avatarUrl;
                if (updatedAvatar) item.avatarUrl = updatedAvatar;
              }
            } else {
              // Hapus PROFILE_RECORD yatim jika akun sudah dihapus dari database
              supabase.from("collaboration_invitations").delete().eq("id", row.id).then(() => {});
            }
          }
        }
      }
    } catch (err) {
      console.warn("[STORAGE] PROFILE_RECORD sync note:", err);
    }

    // Bersihkan cache lokal dari akun-akun yang telah dihapus di Supabase
    const localAccounts = getRegisteredAccounts();
    const cleanLocal = localAccounts.filter((acc) =>
      acc.user?.email && activeEmailsInProfiles.has(acc.user.email.toLowerCase().trim())
    );
    if (cleanLocal.length !== localAccounts.length) {
      saveRegisteredAccounts(cleanLocal);
    }

    return list;
  }

  // 2. Fallback ke Server Database API HANYA jika Supabase tidak aktif (offline mode)
  if (typeof window !== "undefined") {
    try {
      const qParam = query && query.trim() ? `?q=${encodeURIComponent(query.trim())}&_t=${Date.now()}` : `?_t=${Date.now()}`;
      const res = await fetch(`/api/db/students${qParam}`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.students)) {
          return json.students;
        }
      }
    } catch (e) {
      console.warn("Gagal mengambil mahasiswa terdaftar dari server DB:", e);
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
  const localUser = getCurrentUser();
  if (!localUser || !localUser.email) return null;
  const cleanEmail = localUser.email.toLowerCase().trim();

  if (isSupabaseConfigured && supabase) {
    try {
      // 1. Cek sesi Supabase Auth jika ada
      const { data: { session } } = await supabase.auth.getSession();

      // 2. Verifikasi langsung ke tabel profiles Supabase (Single Source of Truth)
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("email", cleanEmail)
        .maybeSingle();

      // Jika akun sudah tidak ditemukan di tabel profiles Supabase (telah dihapus dari database)
      if (error || !profile) {
        // Otomatis bersihkan sesi dan seluruh cache akun lokal
        saveCurrentUser(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem(COURSES_KEY);
          localStorage.removeItem(TASKS_KEY);
          localStorage.removeItem(TASK_INVITATIONS_KEY);
        }
        const remaining = getRegisteredAccounts().filter(
          (a) => a.user.email.toLowerCase().trim() !== cleanEmail
        );
        saveRegisteredAccounts(remaining);
        try {
          await supabase.auth.signOut();
        } catch {}
        return null;
      }

      // 3. Ambil avatar dan profil realtime terbaru dari collaboration_invitations (PROFILE_RECORD)
      // PROFILE_RECORD menjamin foto kustom (upload foto sendiri) selalu tersimpan persisten dan tidak pernah ter-reset saat tab ditutup
      let currentAvatar = profile.avatar_url;
      try {
        const { data: profRecord } = await supabase
          .from("collaboration_invitations")
          .select("inviter_avatar, task_payload")
          .eq("id", `profile-record-${cleanEmail}`)
          .maybeSingle();

        if (profRecord) {
          const recAvatar = profRecord.inviter_avatar || (profRecord.task_payload as any)?.avatarUrl;
          if (recAvatar) {
            currentAvatar = recAvatar;
          }
        }
      } catch {}

      // Jika di localUser tersimpan avatar kustom yang valid, jangan pernah ditimpa oleh default dicebear lama dari profiles
      if (localUser.avatarUrl && localUser.avatarUrl !== currentAvatar) {
        const isLocalCustom = !localUser.avatarUrl.includes("dicebear");
        const isCloudDefault = !currentAvatar || currentAvatar.includes("dicebear");
        if (isLocalCustom && isCloudDefault) {
          currentAvatar = localUser.avatarUrl;
          // Sinkronkan ke cloud PROFILE_RECORD agar permanen
          syncUserProfileToCloud({ ...localUser, avatarUrl: currentAvatar });
        }
      }

      // Akun masih sah dan aktif di database
      const userProfile: UserProfile = {
        ...localUser,
        id: profile.id || session?.user?.id || localUser.id,
        fullName:
          profile.full_name ||
          session?.user?.user_metadata?.full_name ||
          localUser.fullName,
        email: profile.email || cleanEmail,
        nim: profile.nim || localUser.nim,
        major: profile.major || localUser.major,
        semester: profile.semester || localUser.semester,
        campus: profile.campus || localUser.campus,
        avatarUrl: currentAvatar || localUser.avatarUrl,
        createdAt: profile.created_at || localUser.createdAt,
      };

      saveCurrentUser(userProfile);
      return userProfile;
    } catch (err) {
      console.warn("Gagal memeriksa sesi Supabase:", err);
    }
  }

  return localUser;
}

/**
 * Memverifikasi secara realtime apakah akun pengguna masih terdaftar di database.
 * Jika akun telah dihapus dari database, fungsi ini mengembalikan false.
 */
export async function verifyUserAccountExists(email: string): Promise<boolean> {
  if (!email) return false;
  const cleanEmail = email.toLowerCase().trim();

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (error) {
        // Abaikan error jaringan sesaat agar koneksi tidak terputus tidak sengaja
        return true;
      }
      return Boolean(profile && profile.id);
    } catch {
      return true;
    }
  }

  // Jika Supabase tidak aktif, verifikasi dengan server DB
  if (typeof window !== "undefined") {
    try {
      const res = await fetch(`/api/db/students?q=${encodeURIComponent(cleanEmail)}`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.students)) {
          return json.students.some((s: UserProfile) => s.email.toLowerCase().trim() === cleanEmail);
        }
      }
    } catch {}
  }

  return true;
}

/**
 * Sinkronisasi profil mahasiswa ke cloud database secara komprehensif
 */
export async function syncUserProfileToCloud(user: UserProfile): Promise<void> {
  if (!user || !user.email) return;
  const cleanEmail = user.email.toLowerCase().trim();

  // 1. Direct upsert ke Supabase collaboration_invitations (PROFILE_RECORD)
  // Ini bebas dari batasan RLS dan langsung memicu Supabase Realtime ke seluruh pengguna lain
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from("collaboration_invitations").upsert({
        id: `profile-record-${cleanEmail}`,
        task_id: "PROFILE_RECORD",
        task_title: user.fullName,
        course_name: null,
        invited_email: cleanEmail,
        token_hash: "profile",
        status: "active",
        expires_at: new Date(Date.now() + 365 * 86400000).toISOString(),
        invited_by: user.id || cleanEmail,
        inviter_name: user.fullName,
        inviter_avatar: user.avatarUrl,
        task_payload: {
          ...user,
          avatarUrl: user.avatarUrl,
          updatedAt: new Date().toISOString(),
        },
      });

      // Update juga avatar di baris tugas yang pernah di-invite oleh user ini
      if (user.id || cleanEmail) {
        const query = user.id && user.id !== cleanEmail
          ? `invited_by.eq.${user.id},invited_by.eq.${cleanEmail}`
          : `invited_by.eq.${user.id || cleanEmail}`;
        await supabase
          .from("collaboration_invitations")
          .update({
            inviter_name: user.fullName,
            inviter_avatar: user.avatarUrl,
          })
          .or(query);
      }
    } catch (e) {
      console.warn("[SYNC_PROFILE] Gagal sync PROFILE_RECORD ke Supabase:", e);
    }
  }

  // 2. Sinkronkan ke Server Database via API route
  if (typeof window !== "undefined") {
    try {
      fetch("/api/db/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user }),
      }).catch(() => {});
    } catch {}
  }
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
  const cleanEmail = updated.email.toLowerCase().trim();

  // 1. Perbarui sesi & akun lokal seketika
  saveCurrentUser(updated);

  const accounts = getRegisteredAccounts();
  const nextAccounts = accounts.map((acc) => {
    if (acc.user.id === updated.id || acc.user.email.toLowerCase() === cleanEmail) {
      return {
        ...acc,
        user: updated,
      };
    }
    return acc;
  });
  saveRegisteredAccounts(nextAccounts);

  // 2. Perbarui avatar & nama di seluruh tugas lokal yang diikuti pengguna
  const localTasks = getLocalTasks();
  let tasksChanged = false;
  for (const t of localTasks) {
    if (Array.isArray(t.members)) {
      for (const m of t.members) {
        const mEmail = ((m as any).email || m.userId || "").toLowerCase().trim();
        if (m.userId === updated.id || mEmail === cleanEmail || m.fullName === updated.fullName) {
          m.avatarUrl = updated.avatarUrl;
          m.fullName = updated.fullName;
          tasksChanged = true;
        }
      }
    }
  }
  if (tasksChanged) {
    saveLocalTasks(localTasks);
  }

  // 3. Sinkronkan profil langsung ke Supabase Cloud (PROFILE_RECORD & Realtime broadcast)
  if (isSupabaseConfigured && supabase) {
    try {
      // Upsert PROFILE_RECORD di collaboration_invitations (bebas RLS & memicu Realtime ke semua browser)
      await supabase.from("collaboration_invitations").upsert({
        id: `profile-record-${cleanEmail}`,
        task_id: "PROFILE_RECORD",
        task_title: updated.fullName,
        course_name: null,
        invited_email: cleanEmail,
        token_hash: "profile",
        status: "active",
        expires_at: new Date(Date.now() + 365 * 86400000).toISOString(),
        invited_by: updated.id || cleanEmail,
        inviter_name: updated.fullName,
        inviter_avatar: updated.avatarUrl,
        task_payload: {
          ...updated,
          avatarUrl: updated.avatarUrl,
          updatedAt: new Date().toISOString(),
        },
      });

      // Update avatar inviter di seluruh undangan aktif yang dibuat pengguna
      await supabase
        .from("collaboration_invitations")
        .update({
          inviter_name: updated.fullName,
          inviter_avatar: updated.avatarUrl,
        })
        .eq("invited_by", updated.id || cleanEmail);

      // Coba update juga tabel profiles jika diizinkan RLS (baik by id maupun by email)
      try {
        if (updated.id) {
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
            .eq("id", updated.id);
        }
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
          .eq("email", cleanEmail);
      } catch (e) {
        console.warn("Update profiles table note:", e);
      }

      // Update auth user metadata jika ada session aktif
      try {
        await supabase.auth.updateUser({
          data: {
            full_name: updated.fullName,
            nim: updated.nim,
            major: updated.major,
            semester: updated.semester,
            campus: updated.campus,
            avatar_url: updated.avatarUrl,
          },
        });
      } catch {}
    } catch (err) {
      console.warn("Gagal update profil di Supabase:", err);
    }
  }

  // 4. Sinkronkan ke Server DB via API route
  if (typeof window !== "undefined") {
    try {
      await fetch("/api/db/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: updated }),
      });
    } catch (e) {
      console.warn("Gagal simpan profil ke server DB:", e);
    }

    // Trigger custom event agar komponen lokal seketika sinkron tanpa tunggu polling
    try {
      window.dispatchEvent(new CustomEvent("tugasku_profile_updated", { detail: updated }));
    } catch {}
  }

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

  // 1. JIKA SUPABASE TERKONFIGURASI:
  // Selalu verifikasi langsung ke database cloud Supabase secara realtime!
  if (isSupabaseConfigured && supabase) {
    // a. Cek apakah profil ada di tabel profiles Supabase (Single Source of Truth)
    let cloudFoundProfile: UserProfile | null = null;
    try {
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("*")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (profileRow) {
        cloudFoundProfile = {
          id: profileRow.id,
          fullName: profileRow.full_name,
          email: profileRow.email,
          nim: profileRow.nim || "",
          major: profileRow.major || "Teknologi Informasi",
          semester: profileRow.semester || 1,
          campus: profileRow.campus || "Universitas BSI (Bina Sarana Informatika)",
          avatarUrl: profileRow.avatar_url,
          createdAt: profileRow.created_at,
        };

        // Ambil avatar kustom dari PROFILE_RECORD jika tersedia
        try {
          const { data: profRec } = await supabase
            .from("collaboration_invitations")
            .select("inviter_avatar, task_payload")
            .eq("id", `profile-record-${cleanEmail}`)
            .maybeSingle();

          if (profRec) {
            const recAvatar = profRec.inviter_avatar || (profRec.task_payload as any)?.avatarUrl;
            if (recAvatar) {
              cloudFoundProfile.avatarUrl = recAvatar;
            }
          }
        } catch {}
      }
    } catch (err) {
      console.warn("Supabase profile check note:", err);
    }

    // Jika akun TIDAK ADA di tabel profiles Supabase (telah dihapus dari database atau belum terdaftar):
    if (!cloudFoundProfile) {
      // Bersihkan sisa cache lokal akun yang sudah terhapus
      const filtered = getRegisteredAccounts().filter(
        (a) => a.user.email.toLowerCase() !== cleanEmail
      );
      saveRegisteredAccounts(filtered);
      if (getCurrentUser()?.email?.toLowerCase().trim() === cleanEmail) {
        saveCurrentUser(null);
      }
      if (typeof window !== "undefined") {
        localStorage.removeItem(COURSES_KEY);
        localStorage.removeItem(TASKS_KEY);
        localStorage.removeItem(TASK_INVITATIONS_KEY);
      }
      try {
        await supabase
          .from("collaboration_invitations")
          .delete()
          .eq("id", `profile-record-${cleanEmail}`);
        await supabase
          .from("collaboration_invitations")
          .delete()
          .eq("invited_email", cleanEmail);
      } catch {}

      return {
        success: false,
        error: "Akun belum terdaftar. Silakan daftar terlebih dahulu.",
      };
    }

    // b. Akun terbukti ADA di database Supabase! Sekarang verifikasi password:
    let supabaseAuthSuccess = false;
    let supabaseAuthUser: UserProfile | null = null;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      });

      if (!error && data.user) {
        supabaseAuthSuccess = true;
        supabaseAuthUser = {
          id: data.user.id,
          fullName:
            cloudFoundProfile.fullName ||
            data.user.user_metadata?.full_name ||
            cleanEmail.split("@")[0],
          email: cleanEmail,
          nim: cloudFoundProfile.nim || data.user.user_metadata?.nim || "",
          major: cloudFoundProfile.major || data.user.user_metadata?.major || "Teknologi Informasi",
          semester: cloudFoundProfile.semester || data.user.user_metadata?.semester || 1,
          campus: cloudFoundProfile.campus || "Universitas BSI (Bina Sarana Informatika)",
          avatarUrl: cloudFoundProfile.avatarUrl || data.user.user_metadata?.avatar_url,
          createdAt: data.user.created_at,
        };
      } else if (error) {
        if (error.message?.includes("Email not confirmed") || (error as any).code === "email_not_confirmed") {
          return {
            success: false,
            error: "Akun belum aktif di Supabase. Pastikan opsi 'Confirm email' dimatikan di Supabase Dashboard.",
          };
        }
      }
    } catch (err: any) {
      console.warn("Supabase Auth fallback:", err);
    }

    // Jika Supabase Auth berhasil:
    if (supabaseAuthSuccess && supabaseAuthUser) {
      const accs = getRegisteredAccounts();
      const idx = accs.findIndex((a) => a.user.email.toLowerCase() === cleanEmail);
      if (idx >= 0) {
        accs[idx] = { user: supabaseAuthUser, password };
      } else {
        accs.push({ user: supabaseAuthUser, password });
      }
      saveRegisteredAccounts(accs);

      const prevUser = getCurrentUser();
      if (prevUser && prevUser.email.toLowerCase().trim() !== cleanEmail) {
        if (typeof window !== "undefined") {
          localStorage.removeItem(COURSES_KEY);
          localStorage.removeItem(TASKS_KEY);
          localStorage.removeItem(TASK_INVITATIONS_KEY);
        }
      }

      saveCurrentUser(supabaseAuthUser);
      return { success: true, user: supabaseAuthUser };
    }

    // Jika Supabase Auth gagal, periksa apakah password cocok dengan local cache
    const accounts = getRegisteredAccounts();
    const localFound = accounts.find((acc) => acc.user.email.toLowerCase() === cleanEmail);
    if (localFound && localFound.password === password) {
      const prevUser = getCurrentUser();
      if (prevUser && prevUser.email.toLowerCase().trim() !== cleanEmail) {
        if (typeof window !== "undefined") {
          localStorage.removeItem(COURSES_KEY);
          localStorage.removeItem(TASKS_KEY);
          localStorage.removeItem(TASK_INVITATIONS_KEY);
        }
      }
      const userToLogin = { ...cloudFoundProfile, ...localFound.user };
      saveCurrentUser(userToLogin);
      return { success: true, user: userToLogin };
    }

    return {
      success: false,
      error: "Email atau password yang Anda masukkan salah.",
    };
  }

  // 2. JIKA SUPABASE TIDAK AKTIF (Offline Mode)
  const accounts = getRegisteredAccounts();
  const localFound = accounts.find(
    (acc) => acc.user.email.toLowerCase() === cleanEmail
  );
  if (!localFound) {
    return {
      success: false,
      error: "Akun belum terdaftar. Silakan daftar terlebih dahulu.",
    };
  }

  if (localFound.password !== password) {
    return {
      success: false,
      error: "Email atau password yang Anda masukkan salah.",
    };
  }

  const prevUser = getCurrentUser();
  if (prevUser && prevUser.email.toLowerCase().trim() !== cleanEmail) {
    if (typeof window !== "undefined") {
      localStorage.removeItem(COURSES_KEY);
      localStorage.removeItem(TASKS_KEY);
      localStorage.removeItem(TASK_INVITATIONS_KEY);
    }
  }

  saveCurrentUser(localFound.user);
  return { success: true, user: localFound.user };
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
  if (typeof window !== "undefined") {
    // Reset cache lokal agar akun baru benar-benar bersih dan kosong secara default (0 mata kuliah & 0 tugas)
    localStorage.removeItem(COURSES_KEY);
    localStorage.removeItem(TASKS_KEY);
    localStorage.removeItem(TASK_INVITATIONS_KEY);
  }

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
  if (typeof window !== "undefined") {
    localStorage.removeItem(COURSES_KEY);
    localStorage.removeItem(TASKS_KEY);
    localStorage.removeItem(TASK_INVITATIONS_KEY);
  }
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
