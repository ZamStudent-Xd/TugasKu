"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus,
  BookPlus,
  Search,
  Filter,
  CheckCircle2,
  BookOpen,
  Inbox,
  Sparkles,
  Users,
  Calendar as CalendarIcon,
  Clock,
  AlertTriangle,
  RotateCcw,
  Edit2,
  Trash2,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  UserPlus,
  User,
  ArrowLeft,
  X
} from "lucide-react";
import { Course, Task, DashboardMetrics, UserProfile, TaskInvitation } from "@/types";
import {
  getTaskStatus,
  calculateDashboardMetrics,
  calculateCourseProgress,
  formatDeadline,
  isDeadlineNear,
  isTaskBelongsToCourse,
  validateCourseInput
} from "@/lib/businessRules";
import {
  fetchCourses,
  fetchTasks,
  addCourse,
  updateCourse,
  deleteCourse,
  addTask,
  updateTask,
  updateTaskProgress,
  deleteTask,
  addMemberToTask,
  removeMemberFromTask,
  getCurrentUser,
  getActiveSessionUser,
  updateUserProfile,
  logoutStudent,
  fetchTaskInvitations,
  fetchRegisteredStudents,
  getTaskInvitations,
  acceptTaskInvitation,
  declineTaskInvitation,
  sendTaskInvitation,
  getAllRegisteredStudents,
} from "@/lib/storage";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

import { Sidebar } from "@/components/Sidebar";
import { TopNavbar } from "@/components/TopNavbar";
import { DeadlineTaskAlert } from "@/components/NotificationDropdown";
import { HeroBanner } from "@/components/HeroBanner";
import { CourseCard } from "@/components/CourseCard";
import { TaskCard } from "@/components/TaskCard";
import { TaskFilters } from "@/components/TaskFilters";
import { RightPanel } from "@/components/RightPanel";
import { CreateTaskModal } from "@/components/CreateTaskModal";
import { EditTaskModal } from "@/components/EditTaskModal";
import { CreateCourseModal } from "@/components/CreateCourseModal";
import { EditCourseModal } from "@/components/EditCourseModal";
import { InviteMemberModal } from "@/components/InviteMemberModal";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { ProfileModal } from "@/components/ProfileModal";
import { AuthPage } from "@/components/AuthPage";
import { ToastContainer, ToastMessage } from "@/components/Toast";

export function MainApp({ initialTab = "dashboard" }: { initialTab?: string }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [invitations, setInvitations] = useState<TaskInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Nav tab & filters
  const [currentTab, setCurrentTab] = useState(initialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedCourseFilter, setSelectedCourseFilter] = useState("all");
  const [sortBy, setSortBy] = useState("deadline");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [courseTaskFilter, setCourseTaskFilter] = useState<string>("all");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Pastikan tema selalu cerah (light mode) dan bersihkan preferensi tema lama
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    try {
      localStorage.removeItem("tugasku_theme");
    } catch {
      // ignore
    }
  }, []);

  // Baca tab dan mata kuliah aktif dari URL pathname, search params, hash, atau localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const path = window.location.pathname.replace("/", "").trim().toLowerCase();
        const validTabs = ["dashboard", "courses", "completed", "calendar"];
        let targetTab: string = initialTab;
        if (validTabs.includes(path)) {
          targetTab = path;
        } else {
          const hash = window.location.hash.replace("#", "").trim().toLowerCase();
          if (validTabs.includes(hash)) {
            targetTab = hash;
          } else {
            const savedTab = localStorage.getItem("tugasku_active_tab");
            if (savedTab && validTabs.includes(savedTab)) {
              targetTab = savedTab;
            }
          }
        }

        if (targetTab) {
          setCurrentTab(targetTab);
        }

        const urlParams = new URLSearchParams(window.location.search);
        const queryCourseId = urlParams.get("id") || urlParams.get("courseId");
        if (queryCourseId) {
          setSelectedCourseId(queryCourseId);
        } else {
          const savedCourseId = localStorage.getItem("tugasku_selected_course_id");
          if (savedCourseId && targetTab === "courses") {
            setSelectedCourseId(savedCourseId);
          }
        }
      } catch {}
    }
  }, [initialTab]);

  // Listener untuk perubahan URL navigasi browser (back / forward / popstate)
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== "undefined") {
        const path = window.location.pathname.replace("/", "").trim().toLowerCase();
        const validTabs = ["dashboard", "courses", "completed", "calendar"];
        if (validTabs.includes(path)) {
          setCurrentTab(path);
        }
        const urlParams = new URLSearchParams(window.location.search);
        const queryCourseId = urlParams.get("id") || urlParams.get("courseId");
        setSelectedCourseId(queryCourseId || null);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Modals state
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [createTaskCourseId, setCreateTaskCourseId] = useState<string | undefined>();
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isCreateCourseOpen, setIsCreateCourseOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [invitingTask, setInvitingTask] = useState<Task | null>(null);

  // Delete confirm modal state
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    type: "course" | "task";
    id: string;
    title: string;
    description: string;
    confirmLabel?: string;
  }>({
    isOpen: false,
    type: "task",
    id: "",
    title: "",
    description: "",
  });

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: "success" | "error" | "info", message: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    // Ganti alert sebelumnya dengan alert baru secara instan, jangan menumpuk
    setToasts([{ id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const [currentTime, setCurrentTime] = useState<number>(0);

  // Load initial data & auth user session
  useEffect(() => {
    setCurrentTime(Date.now());
    async function initAuthAndData() {
      try {
        const activeUser = await getActiveSessionUser();
        setUser(activeUser);
        if (activeUser) {
          const [cData, tData, iData] = await Promise.all([
            fetchCourses(activeUser),
            fetchTasks(activeUser),
            fetchTaskInvitations(activeUser.email),
          ]);
          setCourses(cData);
          setTasks(tData);
          setInvitations(iData);
        }
      } catch {
        addToast("error", "Gagal memuat data dari penyimpanan");
      } finally {
        setIsAuthChecking(false);
        setIsLoading(false);
      }
    }
    initAuthAndData();

    // Listener realtime autentikasi (sinkronkan state jika user login/logout di tab lain)
    if (isSupabaseConfigured && supabase) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === "SIGNED_IN" || event === "USER_UPDATED") {
          if (session?.user) {
            const activeUser = await getActiveSessionUser();
            if (activeUser) {
              setUser(activeUser);
              const [cData, tData, iData] = await Promise.all([
                fetchCourses(activeUser),
                fetchTasks(activeUser),
                fetchTaskInvitations(activeUser.email),
              ]);
              setCourses(cData);
              setTasks(tData);
              setInvitations(iData);
            }
          }
        } else if (event === "SIGNED_OUT") {
          setUser(null);
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, []);

  // Realtime Listener untuk Undangan Kolaborasi Baru
  useEffect(() => {
    if (!user?.email || !isSupabaseConfigured || !supabase) return;

    const client = supabase;
    const cleanEmail = user.email.toLowerCase().trim();
    const channel = client
      .channel(`realtime-invitations-${cleanEmail}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "collaboration_invitations",
          filter: `invited_email=eq.${cleanEmail}`,
        },
        async (payload) => {
          const fresh = await fetchTaskInvitations(cleanEmail);
          setInvitations(fresh);
          if (payload.eventType === "INSERT") {
            addToast("info", "📩 Anda menerima undangan kolaborasi tugas kelompok baru!");
          }
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [user?.email]);

  const handleUpdateProfile = async (updated: UserProfile) => {
    const saved = await updateUserProfile(updated);
    setUser(saved);
    addToast("success", "Profil mahasiswa berhasil diperbarui!");
  };

  const handleLogout = async () => {
    await logoutStudent();
    setUser(null);
    setIsProfileOpen(false);
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  };

  // Metrik dashboard
  const metrics: DashboardMetrics = useMemo(() => {
    return calculateDashboardMetrics(tasks);
  }, [tasks]);

  // Handle Tab Switching (tersimpan di URL pathname & localStorage sehingga refresh tetap di halaman tersebut)
  const handleSelectTab = (tab: string) => {
    setCurrentTab(tab);
    setStatusFilter("all");
    setTypeFilter("all");
    setSelectedCourseFilter("all");

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("tugasku_active_tab", tab);
        window.history.pushState(null, "", `/${tab}`);
        if (tab !== "courses") {
          setSelectedCourseId(null);
          localStorage.removeItem("tugasku_selected_course_id");
        }
      } catch {}
    }
  };

  // Helper untuk membuka / menutup detail spesifik mata kuliah
  const handleSelectCourse = (courseId: string | null) => {
    setSelectedCourseId(courseId);
    if (typeof window !== "undefined") {
      try {
        if (courseId) {
          localStorage.setItem("tugasku_selected_course_id", courseId);
          window.history.pushState(null, "", `/courses?id=${encodeURIComponent(courseId)}`);
        } else {
          localStorage.removeItem("tugasku_selected_course_id");
          window.history.pushState(null, "", "/courses");
        }
      } catch {}
    }
  };

  // Audio synthesizer untuk notifikasi suara realtime (Web Audio API tanpa dependensi eksternal)
  const playNotificationSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  };

  // Lacak ID undangan yang sudah diketahui agar tidak notif berulang
  const knownInvitationIdsRef = useRef<Set<string>>(new Set());
  const isInitialInvitationLoadRef = useRef(true);

  // Interval Sinkronisasi Realtime (Polling 3s + Tab Focus + Supabase Realtime)
  useEffect(() => {
    if (!user) return;

    // Update jam & countdown deadline setiap 10 detik agar realtime
    const timeInterval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 10000);

    const syncRealtime = async () => {
      try {
        const [cData, tData, iData] = await Promise.all([
          fetchCourses(user),
          fetchTasks(user),
          fetchTaskInvitations(user.email),
        ]);

        // Deteksi undangan kolaborasi baru yang masuk secara realtime
        const currentPending = iData.filter((i) => i.status === "pending");
        const currentPendingIds = new Set(currentPending.map((i) => i.id));

        if (!isInitialInvitationLoadRef.current) {
          for (const inv of currentPending) {
            if (!knownInvitationIdsRef.current.has(inv.id)) {
              playNotificationSound();
              addToast(
                "info",
                `📩 Undangan Baru: ${inv.inviterName || "Rekan"} mengundang Anda ke tugas "${inv.taskTitle}"!`
              );
              break;
            }
          }
        }

        knownInvitationIdsRef.current = currentPendingIds;
        isInitialInvitationLoadRef.current = false;

        setCourses(cData);
        setTasks(tData);
        setInvitations(iData);
        setInvitingTask((prev) => (prev ? tData.find((t) => t.id === prev.id) || null : null));
      } catch {
        // silent background error
      }
    };

    // Polling setiap 3 detik
    const pollInterval = setInterval(syncRealtime, 3000);

    // Sinkronisasi seketika saat pengguna membuka kembali tab browser
    const handleWindowFocus = () => {
      syncRealtime();
    };
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleWindowFocus);

    // Supabase Realtime channel jika dikonfigurasi
    let realtimeChannel: any = null;
    if (isSupabaseConfigured && supabase) {
      try {
        realtimeChannel = supabase
          .channel("tugasku-realtime")
          .on("postgres_changes", { event: "*", schema: "public", table: "collaboration_invitations" }, () => syncRealtime())
          .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => syncRealtime())
          .subscribe();
      } catch {}
    }

    return () => {
      clearInterval(timeInterval);
      clearInterval(pollInterval);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleWindowFocus);
      if (realtimeChannel && supabase) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, [user?.email, user?.id]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  // Helper pencarian tugas berdasarkan judul, deskripsi, deadline, mata kuliah, dosen, atau kode
  const isTaskMatching = (task: Task) => {
    if (!normalizedQuery) return true;
    const course = courses.find((c) => isTaskBelongsToCourse(task, c));
    return (
      task.title.toLowerCase().includes(normalizedQuery) ||
      (task.description && task.description.toLowerCase().includes(normalizedQuery)) ||
      (course && course.name.toLowerCase().includes(normalizedQuery)) ||
      (course && course.code && course.code.toLowerCase().includes(normalizedQuery)) ||
      (course && course.lecturer && course.lecturer.toLowerCase().includes(normalizedQuery)) ||
      (task.deadline && task.deadline.toLowerCase().includes(normalizedQuery))
    );
  };

  // Helper pencarian mata kuliah berdasarkan nama, kode, dosen, atau tugas di dalamnya
  const isCourseMatching = (course: Course) => {
    if (!normalizedQuery) return true;
    const hasMatchingTask = tasks.some(
      (t) =>
        isTaskBelongsToCourse(t, course) &&
        (t.title.toLowerCase().includes(normalizedQuery) ||
          (t.description && t.description.toLowerCase().includes(normalizedQuery)))
    );
    return (
      course.name.toLowerCase().includes(normalizedQuery) ||
      (course.code && course.code.toLowerCase().includes(normalizedQuery)) ||
      (course.lecturer && course.lecturer.toLowerCase().includes(normalizedQuery)) ||
      hasMatchingTask
    );
  };

  // Koleksi tugas yang cocok dengan pencarian
  const matchingTasks = useMemo(() => {
    if (!normalizedQuery) return [];
    return tasks.filter(isTaskMatching);
  }, [tasks, courses, normalizedQuery]);

  // Koleksi mata kuliah yang cocok dengan pencarian
  const matchingCourses = useMemo(() => {
    if (!normalizedQuery) return courses;
    return courses.filter(isCourseMatching);
  }, [courses, tasks, normalizedQuery]);

  // Filter and Sort Tasks for Dashboard
  const filteredDashboardTasks = useMemo(() => {
    let result = [...tasks];

    if (statusFilter !== "all") {
      result = result.filter((t) => getTaskStatus(t) === statusFilter);
    }
    if (typeFilter !== "all") {
      result = result.filter((t) => t.taskType === typeFilter);
    }
    if (selectedCourseFilter !== "all") {
      const filterCourse = courses.find((c) => c.id === selectedCourseFilter);
      if (filterCourse) {
        result = result.filter((t) => isTaskBelongsToCourse(t, filterCourse));
      } else {
        result = result.filter((t) => t.courseId === selectedCourseFilter);
      }
    }
    if (normalizedQuery) {
      result = result.filter(isTaskMatching);
    }

    result.sort((a, b) => {
      if (sortBy === "deadline") {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      if (sortBy === "progress_asc") return a.progress - b.progress;
      if (sortBy === "progress_desc") return b.progress - a.progress;
      if (sortBy === "title") return a.title.localeCompare(b.title);
      return 0;
    });

    return result;
  }, [tasks, statusFilter, typeFilter, selectedCourseFilter, normalizedQuery, sortBy, courses]);

  // Total counts for dashboard filter tabs
  const totalCounts = useMemo(() => {
    let all = tasks.length;
    let active = 0;
    let completed = 0;
    let overdue = 0;

    for (const t of tasks) {
      const s = getTaskStatus(t);
      if (s === "completed") completed++;
      else if (s === "overdue") overdue++;
      else active++;
    }
    return { all, active: active + overdue, completed, overdue };
  }, [tasks]);

  // Group tasks collection
  const groupTasks = useMemo(() => {
    const list = tasks.filter((t) => t.taskType === "group");
    return normalizedQuery ? list.filter(isTaskMatching) : list;
  }, [tasks, normalizedQuery, courses]);

  // Completed tasks collection
  const completedTasks = useMemo(() => {
    const done = tasks.filter((t) => getTaskStatus(t) === "completed");
    return normalizedQuery ? done.filter(isTaskMatching) : done;
  }, [tasks, normalizedQuery, courses]);

  // Calendar timeline tasks
  const agendaTasks = useMemo(() => {
    const activeTasks = normalizedQuery ? tasks.filter(isTaskMatching) : tasks;
    const withDeadline = activeTasks
      .filter((t) => t.deadline)
      .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());
    const withoutDeadline = activeTasks.filter((t) => !t.deadline);

    const urgent: Task[] = [];
    const thisWeek: Task[] = [];
    const upcoming: Task[] = [];

    const now = currentTime;
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;

    for (const t of withDeadline) {
      const diff = now > 0 ? new Date(t.deadline!).getTime() - now : 0;
      if (diff > 0 && diff <= oneDay) {
        urgent.push(t);
      } else if (diff > oneDay && diff <= oneWeek) {
        thisWeek.push(t);
      } else {
        upcoming.push(t);
      }
    }

    return { urgent, thisWeek, upcoming, withoutDeadline };
  }, [tasks, currentTime, normalizedQuery, courses]);

  // Undangan kolaborasi spesifik untuk mahasiswa yang sedang aktif
  const userInvitations = useMemo(() => {
    if (!user?.email) return [];
    const cleanUserEmail = user.email.toLowerCase().trim();
    return invitations.filter(
      (inv) => !inv.invitedEmail || inv.invitedEmail.toLowerCase().trim() === cleanUserEmail
    );
  }, [invitations, user?.email]);

  // Peringatan tugas yang mendekati deadline (H-1 atau kurang dari 24 jam)
  const deadlineAlerts: DeadlineTaskAlert[] = useMemo(() => {
    if (!currentTime) return [];
    return tasks
      .filter((task) => {
        if (!task.deadline || task.progress >= 100) return false;
        const deadlineTime = new Date(task.deadline).getTime();
        if (isNaN(deadlineTime)) return false;
        const diffHours = (deadlineTime - currentTime) / (1000 * 60 * 60);
        // H-1: Deadline dalam rentang 24 jam ke depan (atau belum selesai dan baru saja terlewat)
        return diffHours <= 24 && diffHours >= -48;
      })
      .map((task) => {
        const course = courses.find((c) => isTaskBelongsToCourse(task, c));
        const deadlineTime = new Date(task.deadline!).getTime();
        const hoursRemaining = Math.round((deadlineTime - currentTime) / (1000 * 60 * 60));
        return {
          task,
          courseName: course?.name || task.courseName,
          hoursRemaining,
        };
      })
      .sort((a, b) => {
        const tA = new Date(a.task.deadline!).getTime();
        const tB = new Date(b.task.deadline!).getTime();
        return tA - tB;
      });
  }, [tasks, courses, currentTime]);

  // Handlers for Tasks
  const handleCreateTask = async (taskData: Omit<Task, "id">) => {
    try {
      const created = await addTask(taskData);
      const allTasks = await fetchTasks(user);
      setTasks(allTasks);
      addToast("success", `Tugas "${created.title}" berhasil dibuat!`);
    } catch {
      addToast("error", "Gagal menyimpan tugas baru");
    }
  };

  const handleUpdateTask = async (id: string, updates: Partial<Task>) => {
    try {
      const updated = await updateTask(id, updates);
      setTasks(updated);
      addToast("success", "Perubahan tugas berhasil disimpan!");
    } catch {
      addToast("error", "Gagal memperbarui tugas");
    }
  };

  const handleUpdateProgress = async (id: string, newProgress: number) => {
    try {
      const updated = await updateTaskProgress(id, newProgress);
      setTasks(updated);
      if (newProgress === 100) {
        addToast("success", "🎉 Selamat! Tugas berhasil diselesaikan 100%!");
      } else {
        addToast("info", `Progres diperbarui ke ${newProgress}%`);
      }
    } catch {
      addToast("error", "Gagal memperbarui progres");
    }
  };

  const handleOpenEditTask = (target: Task) => {
    if (target.taskType === "group") {
      const cleanCurrent = (user?.id || user?.email || "").toLowerCase().trim();
      const isCreator = target.createdBy && target.createdBy.toLowerCase().trim() === cleanCurrent;
      const isOwnerMember = target.members?.some(
        (m) =>
          ((m.userId && m.userId.toLowerCase().trim() === cleanCurrent) ||
            (m.email && m.email.toLowerCase().trim() === cleanCurrent)) &&
          m.role === "owner"
      );
      if (!isCreator && !isOwnerMember) {
        addToast("info", "Sebagai anggota kolaborasi, Anda hanya dapat mengubah progres tugas.");
        return;
      }
    }
    setEditingTask(target);
  };

  const handleOpenInvite = (target: Task) => {
    if (target.taskType === "group") {
      const cleanCurrent = (user?.id || user?.email || "").toLowerCase().trim();
      const isCreator = target.createdBy && target.createdBy.toLowerCase().trim() === cleanCurrent;
      const isOwnerMember = target.members?.some(
        (m) =>
          ((m.userId && m.userId.toLowerCase().trim() === cleanCurrent) ||
            (m.email && m.email.toLowerCase().trim() === cleanCurrent)) &&
          m.role === "owner"
      );
      if (!isCreator && !isOwnerMember) {
        addToast("info", "Hanya ketua kolaborasi yang dapat mengundang anggota.");
        return;
      }
    }
    setInvitingTask(target);
  };

  const handleDeleteTaskConfirm = (id: string) => {
    const target = tasks.find((t) => t.id === id);
    if (target && target.taskType === "group") {
      const cleanCurrent = (user?.id || user?.email || "").toLowerCase().trim();
      const isCreator = target.createdBy && target.createdBy.toLowerCase().trim() === cleanCurrent;
      const isOwnerMember = target.members?.some(
        (m) =>
          ((m.userId && m.userId.toLowerCase().trim() === cleanCurrent) ||
            (m.email && m.email.toLowerCase().trim() === cleanCurrent)) &&
          m.role === "owner"
      );
      if (!isCreator && !isOwnerMember) {
        addToast("error", "Sebagai anggota kolaborasi, Anda hanya dapat mengubah progres tugas.");
        return;
      }
    }
    setDeleteModalState({
      isOpen: true,
      type: "task",
      id,
      title: "Hapus Tugas Ini?",
      description: `Apakah kamu yakin ingin menghapus tugas "${target?.title || "ini"}"? Tindakan ini tidak dapat dibatalkan.`,
      confirmLabel: "Hapus Sekarang",
    });
  };

  // Handlers for Courses
  const handleCreateCourse = async (courseData: Omit<Course, "id">) => {
    const val = validateCourseInput(courseData.name, courses);
    if (!val.valid) {
      addToast("error", val.error || "Nama mata kuliah sudah ada");
      return;
    }
    try {
      const created = await addCourse(courseData);
      setCourses((prev) => [created, ...prev]);
      addToast("success", `Mata kuliah "${created.name}" berhasil ditambahkan!`);
    } catch (err: any) {
      addToast("error", err?.message || "Gagal menambahkan mata kuliah");
    }
  };

  const handleUpdateCourse = async (id: string, updates: Partial<Course>) => {
    if (updates.name) {
      const val = validateCourseInput(updates.name, courses, id);
      if (!val.valid) {
        addToast("error", val.error || "Nama mata kuliah sudah ada");
        return;
      }
    }
    try {
      const updated = await updateCourse(id, updates);
      setCourses(updated);
      addToast("success", "Mata kuliah berhasil diperbarui!");
    } catch (err: any) {
      addToast("error", err?.message || "Gagal memperbarui mata kuliah");
    }
  };

  const handleDeleteCourseConfirm = (id: string) => {
    const target = courses.find((c) => c.id === id);
    const linkedTasks = target ? tasks.filter((t) => isTaskBelongsToCourse(t, target)) : [];
    const cleanCurrent = (user?.id || user?.email || "").toLowerCase().trim();

    // Periksa apakah ada tugas kolaborasi di mana pengguna saat ini adalah anggota (bukan ketua)
    const hasCollaborativeTaskAsMember = linkedTasks.some((t) => {
      if (t.taskType !== "group") return false;
      const isCreator = t.createdBy && t.createdBy.toLowerCase().trim() === cleanCurrent;
      const isOwnerMember = t.members?.some(
        (m) =>
          ((m.userId && m.userId.toLowerCase().trim() === cleanCurrent) ||
            (m.email && m.email.toLowerCase().trim() === cleanCurrent)) &&
          m.role === "owner"
      );
      return !isCreator && !isOwnerMember;
    });

    if (hasCollaborativeTaskAsMember) {
      setDeleteModalState({
        isOpen: true,
        type: "course",
        id,
        title: "Ada tugas kolaborasi pada matakuliah ini, yakin ingin menghapus?",
        description: `Mata kuliah "${target?.name}" akan dihapus dari akun Anda dan Anda otomatis terlepas dari tugas kolaborasi di dalamnya. Tugas kolaborasi akan tetap ada dan aman di ketua kolaborasi.`,
        confirmLabel: "Ya, Hapus",
      });
    } else {
      setDeleteModalState({
        isOpen: true,
        type: "course",
        id,
        title: `Hapus Mata Kuliah "${target?.name}"?`,
        description: `Perhatian: Penghapusan mata kuliah ini akan secara otomatis menghapus ${linkedTasks.length} tugas yang terkait di dalamnya.`,
        confirmLabel: "Hapus Sekarang",
      });
    }
  };

  // Execute confirmed delete
  const handleExecuteDelete = async () => {
    const { type, id } = deleteModalState;
    if (type === "task") {
      try {
        const remaining = await deleteTask(id);
        setTasks(remaining);
        addToast("success", "Tugas berhasil dihapus.");
      } catch {
        addToast("error", "Gagal menghapus tugas");
      }
    } else if (type === "course") {
      try {
        const targetCourseObj = courses.find((c) => c.id === id);
        const res = await deleteCourse(id, user, targetCourseObj);
        setCourses(res.courses);
        setTasks(res.tasks);
        if (selectedCourseId === id) {
          handleSelectCourse(null);
        }
        if (selectedCourseFilter === id) {
          setSelectedCourseFilter("all");
        }
        addToast("success", "Mata kuliah telah berhasil dihapus.");
      } catch {
        addToast("error", "Gagal menghapus mata kuliah");
      }
    }
  };

  // Handlers for Group Collaboration
  const handleAddMember = async (taskId: string, emailOrName: string) => {
    try {
      const taskObj = tasks.find((t) => t.id === taskId);
      const courseObj = taskObj ? courses.find((c) => isTaskBelongsToCourse(taskObj, c)) : undefined;

      const allStudents = await fetchRegisteredStudents();
      const cleanTarget = emailOrName.toLowerCase().trim();
      const matchedStudent = allStudents.find(
        (s) =>
          s.email.toLowerCase().trim() === cleanTarget ||
          s.fullName.toLowerCase().trim() === cleanTarget ||
          (s.nim && (s.nim.toLowerCase().trim() === cleanTarget || cleanTarget.includes(s.nim.toLowerCase().trim())))
      );

      const targetEmail = matchedStudent ? matchedStudent.email : emailOrName;
      const targetName = matchedStudent ? matchedStudent.fullName : emailOrName.split("@")[0];

      // Buat undangan kolaborasi formal ke storage notifikasi & server DB
      if (taskObj && user) {
        const invRes = await sendTaskInvitation({
          taskId,
          taskTitle: taskObj.title,
          courseName: courseObj?.name,
          invitedEmail: targetEmail,
          inviterUser: user,
          task: taskObj,
        });

        if (!invRes.success) {
          addToast("error", invRes.error || "Gagal mengirim undangan kolaborasi");
          return;
        }

        setInvitations(await fetchTaskInvitations(user.email));
      }

      // CATATAN: Pengguna yang diundang TIDAK langsung ditambahkan ke task.members atau diberi matakuliah.
      // Anggota dan mata kuliah hanya akan ditambahkan setelah pengguna tersebut mengklik "Terima" di notifikasi.
      addToast("success", `Undangan kolaborasi berhasil dikirim ke ${targetName}! Menunggu konfirmasi penerimaan.`);
    } catch {
      addToast("error", "Gagal mengirim undangan kolaborasi");
    }
  };

  const handleRemoveMember = async (taskId: string, userId: string) => {
    try {
      const updated = await removeMemberFromTask(taskId, userId);
      setTasks(updated);
      const current = updated.find((t) => t.id === taskId);
      if (current) setInvitingTask(current);
      addToast("info", "Anggota berhasil dikeluarkan dari kelompok.");
    } catch {
      addToast("error", "Gagal mengeluarkan anggota");
    }
  };

  // Handlers for Task Invitations & Deadline Notifications
  const handleAcceptInvitation = async (invId: string) => {
    if (!user) return;
    try {
      const result = await acceptTaskInvitation(invId, user);
      if (result.success) {
        setInvitations(await fetchTaskInvitations(user.email));
        // Refresh tugas DAN mata kuliah (karena mata kuliah otomatis ditambahkan jika belum ada)
        const [cData, tData] = await Promise.all([fetchCourses(user), fetchTasks(user)]);
        setCourses(cData);
        setTasks(tData);

        if (result.newCourseAdded) {
          addToast(
            "success",
            `🎉 Berhasil bergabung! Mata kuliah "${result.newCourseAdded.name}" otomatis ditambahkan ke daftar Anda.`
          );
        } else {
          addToast(
            "success",
            `🎉 Selamat! Tugas berhasil ditambahkan ke mata kuliah "${result.task?.courseName || "Tugas"}" Anda!`
          );
        }
      } else {
        addToast("error", result.error || "Gagal menerima undangan");
      }
    } catch {
      addToast("error", "Terjadi kesalahan saat menerima undangan");
    }
  };

  const handleDeclineInvitation = async (invId: string) => {
    try {
      const result = await declineTaskInvitation(invId);
      if (result.success) {
        if (user) {
          setInvitations(await fetchTaskInvitations(user.email));
        }
        addToast("info", "Undangan kolaborasi tugas telah ditolak.");
      } else {
        addToast("error", result.error || "Gagal menolak undangan");
      }
    } catch {
      addToast("error", "Terjadi kesalahan saat menolak undangan");
    }
  };

  const handleSelectTaskFromNotification = (taskId: string) => {
    const target = tasks.find((t) => t.id === taskId);
    if (target) {
      handleOpenEditTask(target);
    }
  };

  // Loading status pemeriksaan sesi
  if (isAuthChecking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F4F5FB] selection:bg-indigo-500 selection:text-white">
        <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3" />
        <p className="text-xs font-bold text-gray-500 tracking-wide uppercase">Memeriksa Sesi TugasKu...</p>
      </div>
    );
  }

  // JIKA BELUM LOGIN: Arahkan langsung ke halaman /login
  if (!user) {
    if (typeof window !== "undefined") {
      window.location.replace("/login");
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F4F5FB] selection:bg-indigo-500 selection:text-white">
        <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3" />
        <p className="text-xs font-bold text-gray-500 tracking-wide uppercase">Mengarahkan ke halaman Login...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#F4F5FB] text-[#1E1B4B] overflow-hidden">
      {/* 1. Left Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeTasksCount={metrics.activeTasks}
        groupTasksCount={groupTasks.length}
      />

      {/* 2. Middle Content Area (Expands fully, Right Panel is now inside Dashboard) */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Navbar */}
        <TopNavbar
          user={user}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          onOpenProfile={() => setIsProfileOpen(true)}
          invitations={userInvitations}
          deadlineAlerts={deadlineAlerts}
          onAcceptInvitation={handleAcceptInvitation}
          onDeclineInvitation={handleDeclineInvitation}
          onSelectTask={handleSelectTaskFromNotification}
        />

        {/* Scrollable Main Area */}
        <main className="flex-1 overflow-y-auto px-6 md:px-8 py-6 space-y-8">
          {/* TAB 1: DASHBOARD (OVERVIEW & WIDGETS ONLY OR GLOBAL SEARCH RESULTS) */}
          {currentTab === "dashboard" && (
            normalizedQuery ? (
              /* TAMPILAN HASIL PENCARIAN GLOBAL */
              <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
                  <div>
                    <h1 className="text-2xl font-black text-[#1E1B4B] flex items-center gap-2.5">
                      <Search className="w-7 h-7 text-indigo-600" />
                      <span>Hasil Pencarian: &ldquo;{searchQuery}&rdquo;</span>
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">
                      Ditemukan {matchingTasks.length} tugas dan {matchingCourses.filter(c => c.name.toLowerCase().includes(normalizedQuery) || (c.code && c.code.toLowerCase().includes(normalizedQuery)) || (c.lecturer && c.lecturer.toLowerCase().includes(normalizedQuery))).length} mata kuliah yang sesuai.
                    </p>
                  </div>

                  <button
                    onClick={() => setSearchQuery("")}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                    <span>Hapus Pencarian</span>
                  </button>
                </div>

                {/* Hasil Tugas Kuliah */}
                {matchingTasks.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-xs font-extrabold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Tugas Kuliah ({matchingTasks.length})</span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {matchingTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          course={courses.find((c) => isTaskBelongsToCourse(task, c))}
                          currentUserId={user?.id || user?.email}
                          onUpdateProgress={handleUpdateProgress}
                          onEdit={handleOpenEditTask}
                          onDelete={handleDeleteTaskConfirm}
                          onInvite={handleOpenInvite}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Hasil Mata Kuliah */}
                {matchingCourses.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <h2 className="text-xs font-extrabold uppercase tracking-wider text-purple-600 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4" />
                      <span>Mata Kuliah ({matchingCourses.length})</span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {matchingCourses.map((course) => {
                        const linkedTasks = tasks.filter((t) => isTaskBelongsToCourse(t, course));
                        const indivCount = linkedTasks.filter((t) => t.taskType === "individual").length;
                        const groupCount = linkedTasks.filter((t) => t.taskType === "group").length;
                        const stats = calculateCourseProgress(tasks, course);

                        return (
                          <div
                            key={course.id}
                            onClick={() => {
                              handleSelectTab("courses");
                              handleSelectCourse(course.id);
                            }}
                            className="clay-card clay-card-hover p-6 bg-white cursor-pointer border border-[#E2E8F5] hover:border-indigo-300 space-y-4 transition-all group flex flex-col justify-between"
                          >
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                                    {course.code || "KULIAH"}
                                  </span>
                                  <h3 className="text-lg font-bold text-[#1E1B4B] group-hover:text-indigo-600 transition-colors mt-1">
                                    {course.name}
                                  </h3>
                                  {course.lecturer && (
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      Dosen: {course.lecturer}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="space-y-1.5 pt-2 border-t border-gray-100">
                                <div className="flex justify-between items-center text-xs font-bold">
                                  <span className="text-gray-500">
                                    Progres Matakuliah: <strong className="text-[#1E1B4B]">{stats.earnedPoints} / {stats.totalPoints} Poin</strong>
                                  </span>
                                  <span className="text-indigo-600 font-extrabold">{stats.progress}%</span>
                                </div>
                                <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-300"
                                    style={{ width: `${stats.progress}%` }}
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2 text-gray-500 font-medium">
                                <span>{linkedTasks.length} Tugas Total</span>
                                <span className="text-gray-300">•</span>
                                <span className="text-sky-600 font-semibold">{indivCount} Individu</span>
                                <span className="text-gray-300">•</span>
                                <span className="text-purple-600 font-semibold">{groupCount} Kelompok</span>
                              </div>
                              <span className="font-bold text-indigo-600 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                                <span>Buka Matakuliah</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {matchingTasks.length === 0 && matchingCourses.length === 0 && (
                  <div className="clay-card p-12 text-center bg-white border border-[#E2E8F5]">
                    <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-[#1E1B4B]">
                      Tidak ada tugas atau mata kuliah yang cocok dengan &ldquo;{searchQuery}&rdquo;
                    </h3>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                      Coba cari dengan kata kunci lain seperti nama dosen, kode mata kuliah, atau topik tugas.
                    </p>
                    <button
                      onClick={() => setSearchQuery("")}
                      className="mt-4 px-4 py-2 clay-button-primary text-xs font-bold"
                    >
                      Bersihkan Pencarian
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-8">
                {/* Hero Banner */}
                <HeroBanner
                  user={user}
                  metrics={metrics}
                  onExploreClick={() => {
                    handleSelectTab("courses");
                    handleSelectCourse(null);
                  }}
                />

                {/* 2-Column Overview: Quick Actions & Semester Stats on Left, Widgets on Right */}
                <div className="flex flex-col xl:flex-row gap-8 items-start">
                  {/* Left Column: Quick Navigation & Semester Insights */}
                  <div className="flex-1 w-full space-y-6">
                    {/* Quick Shortcut Hub Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Shortcut 1: Mata Kuliah */}
                      <div
                        onClick={() => {
                          handleSelectTab("courses");
                          handleSelectCourse(null);
                        }}
                        className="clay-card clay-card-hover p-5 bg-white cursor-pointer border border-[#E2E8F5] flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-3.5">
                          <BookOpen className="w-6 h-6 text-indigo-600 shrink-0 group-hover:scale-110 transition-transform" />
                          <div>
                            <h3 className="text-sm font-bold text-[#1E1B4B] group-hover:text-indigo-600 transition-colors">
                              Mata Kuliah
                            </h3>
                            <p className="text-xs text-gray-400">
                              {courses.length} mata kuliah aktif
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                      </div>

                      {/* Shortcut 2: Riwayat Selesai */}
                      <div
                        onClick={() => handleSelectTab("completed")}
                        className="clay-card clay-card-hover p-5 bg-white cursor-pointer border border-[#E2E8F5] flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-3.5">
                          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 group-hover:scale-110 transition-transform" />
                          <div>
                            <h3 className="text-sm font-bold text-[#1E1B4B] group-hover:text-emerald-600 transition-colors">
                              Riwayat Selesai
                            </h3>
                            <p className="text-xs text-gray-400">
                              {metrics.completedTasks} tugas tuntas
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
                      </div>

                      {/* Shortcut 3: Jadwal Deadline */}
                      <div
                        onClick={() => handleSelectTab("calendar")}
                        className="clay-card clay-card-hover p-5 bg-white cursor-pointer border border-[#E2E8F5] flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-3.5">
                          <CalendarIcon className="w-6 h-6 text-amber-600 shrink-0 group-hover:scale-110 transition-transform" />
                          <div>
                            <h3 className="text-sm font-bold text-[#1E1B4B] group-hover:text-amber-600 transition-colors">
                              Jadwal Deadline
                            </h3>
                            <p className="text-xs text-gray-400">
                              {agendaTasks.urgent.length > 0 ? `${agendaTasks.urgent.length} tugas mendesak` : "Jadwal teratur"}
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
                      </div>
                    </div>

                    {/* Semester Progress Card */}
                    <div className="clay-card p-6 bg-white border border-[#E2E8F5] space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <Sparkles className="w-6 h-6 text-indigo-600 shrink-0" />
                          <div>
                            <h3 className="text-base font-bold text-[#1E1B4B]">
                              Pencapaian Belajar Semester
                            </h3>
                            <p className="text-xs text-gray-400">
                              Rata-rata progres dari seluruh mata kuliah
                            </p>
                          </div>
                        </div>
                        <span className="text-2xl font-black text-indigo-600">
                          {metrics.averageProgress}%
                        </span>
                      </div>

                      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden p-0.5">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-700"
                          style={{ width: `${metrics.averageProgress}%` }}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-3 pt-2 text-center text-xs">
                        <div className="p-3 rounded-2xl bg-[#F8F9FE] border border-gray-100">
                          <span className="text-gray-400 block text-[11px] font-medium">Total Tugas</span>
                          <span className="text-base font-black text-[#1E1B4B]">{metrics.totalTasks}</span>
                        </div>
                        <div className="p-3 rounded-2xl bg-[#F8F9FE] border border-gray-100">
                          <span className="text-gray-400 block text-[11px] font-medium">Tuntas</span>
                          <span className="text-base font-black text-emerald-600">{metrics.completedTasks}</span>
                        </div>
                        <div className="p-3 rounded-2xl bg-[#F8F9FE] border border-gray-100">
                          <span className="text-gray-400 block text-[11px] font-medium">Perlu Dikerjakan</span>
                          <span className="text-base font-black text-indigo-600">{metrics.activeTasks}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Widgets dipindahkan ke dalam halaman Dashboard */}
                  <RightPanel
                    metrics={metrics}
                    tasks={tasks}
                    onSelectTask={(t) => {
                      const matchedCourse = courses.find((c) => isTaskBelongsToCourse(t, c));
                      handleSelectCourse(matchedCourse ? matchedCourse.id : t.courseId);
                      handleSelectTab("courses");
                    }}
                    onOpenCreateTask={() => {
                      setCreateTaskCourseId(undefined);
                      setIsCreateTaskOpen(true);
                    }}
                  />
                </div>
              </div>
            )
          )}

          {/* TAB: MATA KULIAH (GRID MATA KULIAH & HALAMAN DETAIL TUGAS) */}
          {currentTab === "courses" && (
            <div className="space-y-6">
              {/* VIEW 1: GRID MATA KULIAH */}
              {selectedCourseId === null ? (
                <>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
                    <div>
                      <h1 className="text-2xl font-black text-[#1E1B4B] flex items-center gap-2.5">
                        <BookOpen className="w-7 h-7 text-indigo-600" />
                        <span>Mata Kuliah</span>
                      </h1>
                      <p className="text-xs text-gray-500 mt-1">
                        Pilih mata kuliah untuk melihat tugas individu &amp; kelompok di dalamnya.
                      </p>
                    </div>

                    <button
                      onClick={() => setIsCreateCourseOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 clay-button-primary text-xs font-bold shadow-md shadow-indigo-500/20"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Tambah Mata Kuliah</span>
                    </button>
                  </div>

                  {courses.length === 0 ? (
                    <div className="clay-card p-12 text-center bg-white">
                      <BookOpen className="w-12 h-12 text-indigo-300 mx-auto mb-3" />
                      <h3 className="text-base font-bold text-[#1E1B4B]">Belum ada mata kuliah yang dibuat</h3>
                      <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                        Buat mata kuliah untuk mulai mengelompokkan tugas perkuliahanmu.
                      </p>
                      <button
                        onClick={() => setIsCreateCourseOpen(true)}
                        className="mt-4 px-5 py-2.5 clay-button-primary text-xs font-bold"
                      >
                        Tambah Mata Kuliah Sekarang
                      </button>
                    </div>
                  ) : matchingCourses.length === 0 ? (
                    <div className="clay-card p-12 text-center bg-white border border-[#E2E8F5]">
                      <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <h3 className="text-base font-bold text-[#1E1B4B]">
                        Tidak ada mata kuliah yang cocok dengan &ldquo;{searchQuery}&rdquo;
                      </h3>
                      <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                        Silakan periksa kembali nama mata kuliah, kode, atau nama dosen.
                      </p>
                      <button
                        onClick={() => setSearchQuery("")}
                        className="mt-4 px-4 py-2 clay-button-primary text-xs font-bold"
                      >
                        Bersihkan Pencarian
                      </button>
                    </div>
                  ) : (
                    /* GRID MATA KULIAH */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {matchingCourses.map((course) => {
                        const linkedTasks = tasks.filter((t) => isTaskBelongsToCourse(t, course));
                        const indivCount = linkedTasks.filter((t) => t.taskType === "individual").length;
                        const groupCount = linkedTasks.filter((t) => t.taskType === "group").length;
                        const stats = calculateCourseProgress(tasks, course);

                        return (
                          <div
                            key={course.id}
                            onClick={() => handleSelectCourse(course.id)}
                            className="clay-card clay-card-hover p-6 bg-white cursor-pointer border border-[#E2E8F5] hover:border-indigo-300 space-y-4 transition-all group flex flex-col justify-between"
                          >
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                                    {course.code || "KULIAH"}
                                  </span>
                                  <h3 className="text-lg font-bold text-[#1E1B4B] group-hover:text-indigo-600 transition-colors mt-1">
                                    {course.name}
                                  </h3>
                                  {course.lecturer && (
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      Dosen: {course.lecturer}
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => setEditingCourse(course)}
                                    className="p-2 rounded-xl text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                    title="Edit Mata Kuliah"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteCourseConfirm(course.id)}
                                    className="p-2 rounded-xl text-gray-400 hover:text-pink-600 hover:bg-pink-50 transition-colors"
                                    title="Hapus Mata Kuliah"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              {/* Live Progress Bar with Points */}
                              <div className="space-y-1.5 pt-2 border-t border-gray-100">
                                <div className="flex justify-between items-center text-xs font-bold">
                                  <span className="text-gray-500">
                                    Progres Matakuliah: <strong className="text-[#1E1B4B]">{stats.earnedPoints} / {stats.totalPoints} Poin</strong>
                                  </span>
                                  <span className="text-indigo-600 font-extrabold">{stats.progress}%</span>
                                </div>
                                <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-300"
                                    style={{ width: `${stats.progress}%` }}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Task counts & CTA */}
                            <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2 text-gray-500 font-medium">
                                <span>{linkedTasks.length} Tugas Total</span>
                                <span className="text-gray-300">•</span>
                                <span className="text-sky-600 font-semibold">{indivCount} Individu</span>
                                <span className="text-gray-300">•</span>
                                <span className="text-purple-600 font-semibold">{groupCount} Kelompok</span>
                              </div>
                              <span className="font-bold text-indigo-600 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                                <span>Lihat Tugas</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                /* VIEW 2: HALAMAN TUGAS DARI MATA KULIAH TERPILIH */
                (() => {
                  const currentCourse = courses.find((c) => c.id === selectedCourseId);
                  if (!currentCourse) {
                    return (
                      <div className="p-8 text-center bg-white rounded-2xl">
                        <p className="text-sm text-gray-500">Mata kuliah tidak ditemukan.</p>
                        <button
                          onClick={() => handleSelectCourse(null)}
                          className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold"
                        >
                          Kembali ke Daftar Mata Kuliah
                        </button>
                      </div>
                    );
                  }

                  const courseTasks = tasks.filter((t) => isTaskBelongsToCourse(t, currentCourse));
                  const indivTasks = courseTasks.filter((t) => t.taskType === "individual");
                  const groupTasksForCourse = courseTasks.filter((t) => t.taskType === "group");
                  const stats = calculateCourseProgress(tasks, currentCourse);

                  // Filter tasks according to filter tabs and search query
                  const filteredCourseTasks = courseTasks.filter((t) => {
                    if (normalizedQuery && !isTaskMatching(t)) return false;
                    if (courseTaskFilter === "individual") return t.taskType === "individual";
                    if (courseTaskFilter === "group") return t.taskType === "group";
                    return true;
                  });

                  return (
                    <div className="space-y-6">
                      {/* Back button & Action Header */}
                      <div className="space-y-4">
                        <button
                          onClick={() => handleSelectCourse(null)}
                          className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors group cursor-pointer"
                        >
                          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                          <span>Kembali ke Semua Mata Kuliah</span>
                        </button>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                                {currentCourse.code || "KULIAH"}
                              </span>
                              <span className="text-gray-300">•</span>
                              <span className="text-xs font-semibold text-gray-400">
                                {courseTasks.length} Total Tugas
                              </span>
                            </div>
                            <h1 className="text-2xl font-black text-[#1E1B4B] mt-1">
                              {currentCourse.name}
                            </h1>
                            {currentCourse.lecturer && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                Dosen Pengampu: {currentCourse.lecturer}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setCreateTaskCourseId(currentCourse.id);
                                setIsCreateTaskOpen(true);
                              }}
                              className="inline-flex items-center gap-2 px-4 py-2.5 clay-button-primary text-xs font-bold shadow-md shadow-indigo-500/20"
                            >
                              <Plus className="w-4 h-4" />
                              <span>Tambah Tugas</span>
                            </button>
                            <button
                              onClick={() => setEditingCourse(currentCourse)}
                              className="p-2.5 rounded-2xl bg-white border border-[#E2E8F5] text-gray-500 hover:text-indigo-600 transition-colors"
                              title="Edit Mata Kuliah"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteCourseConfirm(currentCourse.id)}
                              className="p-2.5 rounded-2xl bg-white border border-[#E2E8F5] text-gray-500 hover:text-pink-600 transition-colors"
                              title="Hapus Mata Kuliah"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Course Live Progress Bar with Points Banner */}
                      <div className="clay-card p-5 bg-white border border-[#E2E8F5] space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <Sparkles className="w-5 h-5 text-indigo-600 shrink-0" />
                            <div>
                              <h3 className="text-sm font-bold text-[#1E1B4B]">
                                Progres Pengerjaan Mata Kuliah
                              </h3>
                              <p className="text-xs text-gray-400">
                                Akumulasi poin dari tugas individu ({indivTasks.length}) &amp; kelompok ({groupTasksForCourse.length})
                              </p>
                            </div>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-bold text-gray-500">
                              {stats.earnedPoints} / {stats.totalPoints} Poin
                            </span>
                            <span className="text-xl font-black text-indigo-600">
                              {stats.progress}%
                            </span>
                          </div>
                        </div>

                        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden p-0.5">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-500"
                            style={{ width: `${stats.progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Filter Tabs: Semua / Individu / Kelompok */}
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 p-1 bg-white rounded-2xl border border-[#E2E8F5]">
                          <button
                            onClick={() => setCourseTaskFilter("all")}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${courseTaskFilter === "all"
                                ? "bg-indigo-600 text-white shadow-sm"
                                : "text-gray-600 hover:text-gray-900"
                              }`}
                          >
                            Semua ({courseTasks.length})
                          </button>
                          <button
                            onClick={() => setCourseTaskFilter("individual")}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${courseTaskFilter === "individual"
                                ? "bg-indigo-600 text-white shadow-sm"
                                : "text-gray-600 hover:text-gray-900"
                              }`}
                          >
                            <User className="w-3.5 h-3.5" />
                            <span>Individu ({indivTasks.length})</span>
                          </button>
                          <button
                            onClick={() => setCourseTaskFilter("group")}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${courseTaskFilter === "group"
                                ? "bg-indigo-600 text-white shadow-sm"
                                : "text-gray-600 hover:text-gray-900"
                              }`}
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span>Kelompok ({groupTasksForCourse.length})</span>
                          </button>
                        </div>
                      </div>

                      {/* GRID TUGAS (TAMPIL SESUAI SCREENSHOT USER: 2-KOLOM GRID DENGAN CHECKBOX & POIN) */}
                      {filteredCourseTasks.length === 0 ? (
                        <div className="clay-card p-12 text-center bg-white border border-[#E2E8F5]">
                          {normalizedQuery ? (
                            <>
                              <Search className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                              <h3 className="text-sm font-bold text-[#1E1B4B]">
                                Tidak ada tugas yang cocok dengan &ldquo;{searchQuery}&rdquo;
                              </h3>
                              <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                                Coba kata kunci lain atau bersihkan pencarian untuk melihat semua tugas mata kuliah ini.
                              </p>
                              <button
                                onClick={() => setSearchQuery("")}
                                className="mt-4 px-4 py-2 clay-button-primary text-xs font-bold"
                              >
                                Bersihkan Pencarian
                              </button>
                            </>
                          ) : (
                            <>
                              <Inbox className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                              <h3 className="text-sm font-bold text-[#1E1B4B]">Belum ada tugas pada kategori ini</h3>
                              <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                                Buat tugas baru untuk mulai mengisi progres mata kuliah ini.
                              </p>
                              <button
                                onClick={() => {
                                  setCreateTaskCourseId(currentCourse.id);
                                  setIsCreateTaskOpen(true);
                                }}
                                className="mt-4 px-4 py-2 clay-button-primary text-xs font-bold"
                              >
                                + Tambah Tugas Sekarang
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          {filteredCourseTasks.map((task) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              course={currentCourse}
                              currentUserId={user?.id || user?.email}
                              onUpdateProgress={handleUpdateProgress}
                              onEdit={handleOpenEditTask}
                              onDelete={handleDeleteTaskConfirm}
                              onInvite={handleOpenInvite}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          )}

          {/* TAB 4: RIWAYAT SELESAI (DEDICATED COMPLETED VIEW) */}
          {currentTab === "completed" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
                <div>
                  <h1 className="text-2xl font-black text-[#1E1B4B] flex items-center gap-2.5">
                    <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                    <span>Riwayat Tugas Selesai</span>
                  </h1>
                  <p className="text-xs text-gray-500 mt-1">
                    Arsip seluruh tugas yang telah mencapai progres 100%.
                  </p>
                </div>

                <span className="text-sm font-bold text-emerald-600 flex items-center gap-1.5">
                  🎉 {completedTasks.length} Tugas Tuntas
                </span>
              </div>

              {completedTasks.length === 0 ? (
                <div className="clay-card p-12 text-center bg-white border border-[#E2E8F5]">
                  {normalizedQuery ? (
                    <>
                      <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <h3 className="text-base font-bold text-[#1E1B4B]">
                        Tidak ada riwayat tugas selesai yang cocok dengan &ldquo;{searchQuery}&rdquo;
                      </h3>
                      <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                        Coba periksa kembali kata kunci pencarian tugas atau mata kuliah Anda.
                      </p>
                      <button
                        onClick={() => setSearchQuery("")}
                        className="mt-4 px-4 py-2 clay-button-primary text-xs font-bold"
                      >
                        Bersihkan Pencarian
                      </button>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <h3 className="text-base font-bold text-[#1E1B4B]">Belum ada tugas yang selesai</h3>
                      <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                        Tingkatkan progres tugas menjadi 100% untuk memindahkannya ke riwayat selesai.
                      </p>
                      <button
                        onClick={() => handleSelectTab("dashboard")}
                        className="mt-4 px-5 py-2.5 clay-button-primary text-xs font-bold"
                      >
                        Buka Dashboard
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {completedTasks.map((task) => {
                    const course = courses.find((c) => isTaskBelongsToCourse(task, c));
                    return (
                      <div
                        key={task.id}
                        className="clay-card p-6 bg-white border border-emerald-100 space-y-4 hover:shadow-lg transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            {(course?.name || task.courseName) && (
                              <span className="text-xs font-bold text-emerald-600">
                                {course?.name || task.courseName}
                              </span>
                            )}
                            <h3 className="text-base font-bold text-[#1E1B4B] mt-2">
                              {task.title}
                            </h3>
                            {task.description && (
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                {task.description}
                              </p>
                            )}
                          </div>

                          <span className="text-xs font-black text-emerald-600 flex items-center gap-1 shrink-0">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>100% Selesai</span>
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-100">
                          <span>{formatDeadline(task.deadline)}</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleUpdateProgress(task.id, 90)}
                              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                              title="Buka kembali tugas jika memerlukan revisi"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Buka Kembali</span>
                            </button>
                            <button
                              onClick={() => handleDeleteTaskConfirm(task.id)}
                              className="text-xs font-bold text-pink-600 hover:text-pink-800 ml-2"
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: JADWAL DEADLINE (DEDICATED CALENDAR TIMELINE VIEW) */}
          {currentTab === "calendar" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
                <div>
                  <h1 className="text-2xl font-black text-[#1E1B4B] flex items-center gap-2.5">
                    <CalendarIcon className="w-7 h-7 text-indigo-600" />
                    <span>Jadwal & Agenda Deadline</span>
                  </h1>
                  <p className="text-xs text-gray-500 mt-1">
                    Urutan tugas terstruktur berdasarkan tanggal dan waktu pengumpulan terdekat.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setCreateTaskCourseId(undefined);
                    setIsCreateTaskOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 clay-button-primary text-xs font-bold shadow-md shadow-indigo-500/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Tugas Baru</span>
                </button>
              </div>

              {tasks.length === 0 ? (
                <div className="clay-card p-12 text-center bg-white">
                  <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-[#1E1B4B]">Belum ada jadwal tugas</h3>
                  <button
                    onClick={() => {
                      setCreateTaskCourseId(undefined);
                      setIsCreateTaskOpen(true);
                    }}
                    className="mt-4 px-5 py-2.5 clay-button-primary text-xs font-bold"
                  >
                    Buat Tugas Pertama
                  </button>
                </div>
              ) : agendaTasks.urgent.length === 0 &&
                agendaTasks.thisWeek.length === 0 &&
                agendaTasks.upcoming.length === 0 &&
                agendaTasks.withoutDeadline.length === 0 ? (
                <div className="clay-card p-12 text-center bg-white border border-[#E2E8F5]">
                  <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-[#1E1B4B]">
                    Tidak ada jadwal tugas yang cocok dengan &ldquo;{searchQuery}&rdquo;
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                    Coba gunakan kata kunci pencarian yang lain atau bersihkan input pencarian.
                  </p>
                  <button
                    onClick={() => setSearchQuery("")}
                    className="mt-4 px-4 py-2 clay-button-primary text-xs font-bold"
                  >
                    Bersihkan Pencarian
                  </button>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Urgent < 24 Hours */}
                  {agendaTasks.urgent.length > 0 && (
                    <div className="space-y-3">
                      <h2 className="text-xs font-extrabold uppercase tracking-wider text-pink-600 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Mendesak (&lt; 24 Jam)</span>
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {agendaTasks.urgent.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            course={courses.find((c) => isTaskBelongsToCourse(task, c))}
                            currentUserId={user?.id || user?.email}
                            onUpdateProgress={handleUpdateProgress}
                            onEdit={handleOpenEditTask}
                            onDelete={handleDeleteTaskConfirm}
                            onInvite={handleOpenInvite}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* This Week */}
                  {agendaTasks.thisWeek.length > 0 && (
                    <div className="space-y-3">
                      <h2 className="text-xs font-extrabold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
                        <Clock className="w-4 h-4" />
                        <span>Minggu Ini</span>
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {agendaTasks.thisWeek.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            course={courses.find((c) => isTaskBelongsToCourse(task, c))}
                            currentUserId={user?.id || user?.email}
                            onUpdateProgress={handleUpdateProgress}
                            onEdit={handleOpenEditTask}
                            onDelete={handleDeleteTaskConfirm}
                            onInvite={handleOpenInvite}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upcoming Later */}
                  {agendaTasks.upcoming.length > 0 && (
                    <div className="space-y-3">
                      <h2 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                        <CalendarIcon className="w-4 h-4" />
                        <span>Mendatang</span>
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {agendaTasks.upcoming.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            course={courses.find((c) => isTaskBelongsToCourse(task, c))}
                            currentUserId={user?.id || user?.email}
                            onUpdateProgress={handleUpdateProgress}
                            onEdit={handleOpenEditTask}
                            onDelete={handleDeleteTaskConfirm}
                            onInvite={handleOpenInvite}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Without Deadline */}
                  {agendaTasks.withoutDeadline.length > 0 && (
                    <div className="space-y-3">
                      <h2 className="text-xs font-extrabold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                        <span>Tanpa Deadline</span>
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {agendaTasks.withoutDeadline.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            course={courses.find((c) => isTaskBelongsToCourse(task, c))}
                            currentUserId={user?.id || user?.email}
                            onUpdateProgress={handleUpdateProgress}
                            onEdit={handleOpenEditTask}
                            onDelete={handleDeleteTaskConfirm}
                            onInvite={handleOpenInvite}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* MODALS */}
      <CreateTaskModal
        isOpen={isCreateTaskOpen}
        courses={courses}
        initialCourseId={createTaskCourseId}
        onClose={() => {
          setIsCreateTaskOpen(false);
          setCreateTaskCourseId(undefined);
        }}
        onSubmit={handleCreateTask}
      />

      <EditTaskModal
        isOpen={Boolean(editingTask)}
        task={editingTask}
        courses={courses}
        onClose={() => setEditingTask(null)}
        onSubmit={handleUpdateTask}
      />

      <CreateCourseModal
        isOpen={isCreateCourseOpen}
        existingCourses={courses}
        onClose={() => setIsCreateCourseOpen(false)}
        onSubmit={handleCreateCourse}
      />

      <EditCourseModal
        isOpen={Boolean(editingCourse)}
        course={editingCourse}
        existingCourses={courses}
        onClose={() => setEditingCourse(null)}
        onSubmit={handleUpdateCourse}
      />

      <InviteMemberModal
        isOpen={Boolean(invitingTask)}
        task={invitingTask}
        onClose={() => setInvitingTask(null)}
        onAddMember={handleAddMember}
        onRemoveMember={handleRemoveMember}
      />

      <DeleteConfirmModal
        isOpen={deleteModalState.isOpen}
        title={deleteModalState.title}
        description={deleteModalState.description}
        confirmLabel={deleteModalState.confirmLabel}
        onClose={() => setDeleteModalState((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleExecuteDelete}
      />

      {/* 8. Profile Modal (Lihat & Edit Profil Mahasiswa BSI) */}
      {user && (
        <ProfileModal
          isOpen={isProfileOpen}
          user={user}
          onClose={() => setIsProfileOpen(false)}
          onUpdate={handleUpdateProfile}
          onLogout={handleLogout}
        />
      )}

      {/* TOAST NOTIFICATION CONTAINER */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
