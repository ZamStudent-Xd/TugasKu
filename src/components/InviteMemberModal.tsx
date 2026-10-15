"use client";

import React, { useState, useMemo, useEffect } from "react";
import { X, UserPlus, Users, Copy, Check, Trash2, Search, AlertCircle, CheckCircle2, Loader2, Clock } from "lucide-react";
import { Task, UserProfile, TaskMember } from "@/types";
import { 
  fetchRegisteredStudents, 
  getCurrentUser, 
  getTaskInvitations, 
  checkIsTaskOwner, 
  cleanAndDeduplicateMembers 
} from "@/lib/storage";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

interface InviteMemberModalProps {
  isOpen: boolean;
  task: Task | null;
  currentUser?: UserProfile | null;
  onClose: () => void;
  onAddMember: (taskId: string, email: string) => void;
  onRemoveMember: (taskId: string, userId: string) => void;
}

export function InviteMemberModal({
  isOpen,
  task,
  currentUser: propUser,
  onClose,
  onAddMember,
  onRemoveMember,
}: InviteMemberModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [registeredStudents, setRegisteredStudents] = useState<UserProfile[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [serverPendingEmails, setServerPendingEmails] = useState<string[]>([]);
  const [serverMembers, setServerMembers] = useState<TaskMember[]>([]);

  const currentUser = useMemo(() => propUser || getCurrentUser(), [propUser, isOpen]);
  const isOwner = useMemo(() => {
    if (!task) return false;
    return checkIsTaskOwner(task, currentUser);
  }, [task, currentUser]);

  // Sinkronkan status undangan & seluruh anggota aktif dari server DB untuk tugas ini
  useEffect(() => {
    if (!isOpen || !task?.id) {
      setServerPendingEmails([]);
      setServerMembers([]);
      return;
    }

    let isMounted = true;
    fetch(`/api/db/invitations?taskId=${encodeURIComponent(task.id)}`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.success && Array.isArray(data.invitations)) {
          const pending = data.invitations
            .filter((inv: any) => inv.status === "pending")
            .map((inv: any) => (inv.invited_email || inv.invitedEmail || "").toLowerCase().trim());
          setServerPendingEmails(pending);

          const invList = data.invitations as any[];
          const extraMembers: TaskMember[] = [];

          // 1. Dapatkan Ketua Kolaborasi dari baris undangan (utamakan task-base-)
          const baseRow =
            invList.find((inv: any) => inv.id?.startsWith("task-base-")) ||
            invList.find((inv: any) => inv.invited_by || inv.inviter_name) ||
            invList[0];
          if (baseRow) {
            const ownerId = (baseRow.invited_by || baseRow.invitedBy || task.createdBy || "").trim();
            const ownerName = (baseRow.inviter_name || baseRow.inviterName || "").trim() || "Ketua Kolaborasi";
            const ownerAvatar = baseRow.inviter_avatar || baseRow.inviterAvatar;
            const ownerBaseEmail = (baseRow.id?.startsWith("task-base-") ? baseRow.invited_email : "") || "";

            const matchedOwnerStudent = registeredStudents.find(
              (s) =>
                (ownerId && s.id?.toLowerCase() === ownerId.toLowerCase()) ||
                (ownerBaseEmail && s.email?.toLowerCase().trim() === ownerBaseEmail.toLowerCase().trim()) ||
                (ownerName && s.fullName?.toLowerCase().trim() === ownerName.toLowerCase().trim())
            );

            extraMembers.push({
              userId: matchedOwnerStudent?.id || ownerId || "owner-task",
              taskId: task.id,
              fullName: matchedOwnerStudent?.fullName || ownerName,
              avatarUrl: matchedOwnerStudent?.avatarUrl || ownerAvatar,
              role: "owner",
              joinedAt: baseRow.created_at || baseRow.createdAt || new Date().toISOString(),
            });
          }

          // 2. Dapatkan seluruh Anggota yang sudah menerima (accepted)
          const acceptedInvs = invList.filter((inv) => inv.status === "accepted" && !inv.id.startsWith("task-base-"));
          for (const aInv of acceptedInvs) {
            const cleanTargetEmail = (aInv.invited_email || aInv.invitedEmail || "").toLowerCase().trim();
            const s = registeredStudents.find((st) => st.email.toLowerCase().trim() === cleanTargetEmail);
            extraMembers.push({
              userId: s?.id || cleanTargetEmail,
              taskId: task.id,
              fullName: s?.fullName || cleanTargetEmail.split("@")[0],
              avatarUrl: s?.avatarUrl,
              role: "member",
              joinedAt: aInv.created_at || aInv.createdAt || new Date().toISOString(),
            });
          }

          setServerMembers(extraMembers);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [isOpen, task?.id, feedbackMsg]);

  // Prefetch data mahasiswa seketika saat modal dibuka agar pencarian berlangsung instan (0 ms)
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setDebouncedQuery("");
      setFeedbackMsg(null);
      return;
    }

    let isMounted = true;
    fetchRegisteredStudents()
      .then((students) => {
        if (isMounted && students.length > 0) {
          setRegisteredStudents(students);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Debounce input pencarian (150ms agar sangat responsif tanpa jeda lama)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Refetch data terbaru jika ada kata kunci pencarian
  useEffect(() => {
    if (!isOpen) return;

    const clean = debouncedQuery.trim();
    if (clean.length === 0) {
      setIsLoadingStudents(false);
      return;
    }

    let isMounted = true;
    if (registeredStudents.length === 0) {
      setIsLoadingStudents(true);
    }

    fetchRegisteredStudents(clean)
      .then((fresh) => {
        if (isMounted && fresh.length > 0) {
          setRegisteredStudents((prev) => {
            const map = new Map<string, UserProfile>();
            for (const s of prev) {
              map.set(s.email.toLowerCase().trim(), s);
            }
            for (const s of fresh) {
              map.set(s.email.toLowerCase().trim(), s);
            }
            return Array.from(map.values());
          });
        }
      })
      .catch((err) => {
        console.warn("Gagal mengambil data mahasiswa terdaftar:", err);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingStudents(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, debouncedQuery]);

  // Realtime subscription untuk mendeteksi pembaruan profil & foto avatar mahasiswa lain secara seketika
  useEffect(() => {
    if (!isOpen) return;

    const handleProfileUpdated = (e: Event) => {
      const updated = (e as CustomEvent).detail as UserProfile;
      if (updated && updated.email) {
        const clean = updated.email.toLowerCase().trim();
        setRegisteredStudents((prev) => {
          const idx = prev.findIndex((s) => s.email.toLowerCase().trim() === clean);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], ...updated };
            return copy;
          }
          return [...prev, updated];
        });
      }
    };
    window.addEventListener("tugasku_profile_updated", handleProfileUpdated);

    let channel: any = null;
    if (isSupabaseConfigured && supabase) {
      channel = supabase
        .channel(`invite-modal-sync-${Date.now()}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "collaboration_invitations" },
          (payload: any) => {
            if (payload.new && payload.new.task_id === "PROFILE_RECORD") {
              const p = payload.new.task_payload as UserProfile | undefined;
              if (p && p.email) {
                const clean = p.email.toLowerCase().trim();
                setRegisteredStudents((prev) => {
                  const idx = prev.findIndex((s) => s.email.toLowerCase().trim() === clean);
                  const updatedStudent: UserProfile = {
                    ...p,
                    avatarUrl: payload.new.inviter_avatar || p.avatarUrl,
                    fullName: payload.new.inviter_name || p.fullName,
                  };
                  if (idx >= 0) {
                    const copy = [...prev];
                    copy[idx] = { ...copy[idx], ...updatedStudent };
                    return copy;
                  }
                  return [...prev, updatedStudent];
                });
              }
            }
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "profiles" },
          () => {
            fetchRegisteredStudents().then((fresh) => {
              if (fresh.length > 0) setRegisteredStudents(fresh);
            });
          }
        )
        .subscribe();
    }

    return () => {
      window.removeEventListener("tugasku_profile_updated", handleProfileUpdated);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [isOpen]);

  // Filter mahasiswa: JANGAN TAMPILKAN PENGGUNA APAPUN SEBELUM MENGETIK MINIMAL 1 HURUF
  const filteredStudents = useMemo(() => {
    const clean = searchQuery.trim().toLowerCase();
    if (clean.length === 0) return []; // Wajib mulai dari 1 huruf baru pengguna muncul

    const currentEmail = currentUser?.email?.toLowerCase().trim();

    return registeredStudents.filter((s) => {
      // Sembunyikan akun pengguna yang sedang login (diri sendiri)
      if (currentEmail && s.email.toLowerCase().trim() === currentEmail) {
        return false;
      }
      return (
        s.fullName.toLowerCase().includes(clean) ||
        (s.nim && s.nim.toLowerCase().includes(clean)) ||
        s.email.toLowerCase().includes(clean)
      );
    });
  }, [searchQuery, registeredStudents, currentUser]);

  // Daftar email yang sedang dalam status undangan pending untuk tugas ini
  const pendingInvitedEmails = useMemo(() => {
    if (!task) return new Set<string>();
    const allInv = getTaskInvitations();
    const set = new Set<string>();
    for (const inv of allInv) {
      if (inv.taskId === task.id && inv.status === "pending") {
        set.add(inv.invitedEmail.toLowerCase().trim());
      }
    }
    return set;
  }, [task?.id, feedbackMsg, isOpen]);

  const currentMembers = useMemo(() => {
    if (!task) return [];
    const source = [...(task.members || []), ...serverMembers];
    const cleaned = cleanAndDeduplicateMembers(source, registeredStudents);
    return cleaned.sort((a, b) => {
      if (a?.role === "owner") return -1;
      if (b?.role === "owner") return 1;
      const nameA = a?.fullName || "";
      const nameB = b?.fullName || "";
      return nameA.localeCompare(nameB);
    });
  }, [task?.members, serverMembers, registeredStudents]);

  if (!isOpen || !task) return null;

  const getStudentInfo = (m: TaskMember) => {
    if (!m) return undefined;
    const rawUserId = (m.userId || "").toLowerCase().trim();
    const rawName = (m.fullName || "").toLowerCase().trim();
    const rawEmail = ((m as any).email || "").toLowerCase().trim();

    return registeredStudents.find((s) => {
      if (!s) return false;
      const sId = (s.id || "").toLowerCase().trim();
      const sEmail = (s.email || "").toLowerCase().trim();
      const sName = (s.fullName || "").toLowerCase().trim();
      const sNim = (s.nim || "").toLowerCase().trim();

      if (sId && sId === rawUserId) return true;
      if (sEmail && (sEmail === rawUserId || (rawEmail && sEmail === rawEmail))) return true;
      if (sName && sName === rawName) return true;
      if (sNim && (rawName === sNim || rawUserId.includes(sNim))) return true;
      return false;
    });
  };

  const isCurrentUserMember = (m: TaskMember) => {
    if (!currentUser || !m) return false;
    const myId = (currentUser.id || "").toLowerCase().trim();
    const myEmail = (currentUser.email || "").toLowerCase().trim();
    const myName = (currentUser.fullName || "").toLowerCase().trim();

    const mUserId = (m.userId || "").toLowerCase().trim();
    const mEmail = ((m as any).email || "").toLowerCase().trim();
    const mName = (m.fullName || "").toLowerCase().trim();

    return (
      (myId && (mUserId === myId || mUserId === myEmail)) ||
      (myEmail && (mEmail === myEmail || mUserId === myEmail)) ||
      (myName && mName === myName)
    );
  };

  const isMember = (student: UserProfile) => {
    if (!student) return false;
    const sId = (student.id || "").toLowerCase().trim();
    const sName = (student.fullName || "").toLowerCase().trim();
    const sEmail = (student.email || "").toLowerCase().trim();
    const sPrefix = sEmail ? sEmail.split("@")[0] : "";

    return currentMembers.some((m) => {
      if (!m) return false;
      const mId = (m.userId || "").toLowerCase().trim();
      const mName = (m.fullName || "").toLowerCase().trim();
      return (
        (sId && mId === sId) ||
        (sName && mName === sName) ||
        (sPrefix && mName.includes(sPrefix))
      );
    });
  };

  const isPendingInvite = (student: UserProfile) => {
    const clean = student.email.toLowerCase().trim();
    return pendingInvitedEmails.has(clean) || serverPendingEmails.includes(clean);
  };

  const handleSelectStudent = (student: UserProfile) => {
    if (isMember(student)) {
      setFeedbackMsg({
        type: "error",
        text: `${student.fullName} sudah menjadi anggota kelompok tugas ini.`,
      });
      return;
    }

    if (isPendingInvite(student)) {
      setFeedbackMsg({
        type: "error",
        text: `Undangan sudah pernah dikirimkan ke ${student.fullName}. Menunggu konfirmasi penerimaan dari yang bersangkutan.`,
      });
      return;
    }

    onAddMember(task.id, student.email);
    setServerPendingEmails((prev) => [...prev, student.email.toLowerCase().trim()]);
    setFeedbackMsg({
      type: "success",
      text: `Undangan kolaborasi berhasil dikirimkan ke ${student.fullName}! Data tugas & mata kuliah akan aktif setelah disetujui.`,
    });
  };

  const inviteLink = typeof window !== "undefined"
    ? `${window.location.origin}/invite/tk-${task.id.slice(-6)}`
    : `https://tugasku.app/invite/tk-${task.id.slice(-6)}`;

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-gray-100 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-5">
          <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 mb-2.5">
            <Users className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-[#1E1B4B]">
            {isOwner ? "Kolaborasi Tugas Kelompok" : "Lihat Anggota Lainnya"}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
            {task.title}
          </p>
        </div>

        {!isOwner && (
          <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-purple-50/90 to-indigo-50/90 border border-purple-100 flex items-start gap-3.5 shadow-2xs">
            <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 shrink-0 mt-0.5 shadow-2xs">
              <Users className="w-4.5 h-4.5" />
            </div>
            <div className="text-left text-xs text-purple-950">
              <div className="font-bold flex items-center gap-2">
                <span>Daftar Anggota Lainnya</span>
                <span className="text-[10px] bg-purple-200/90 text-purple-800 font-extrabold px-2 py-0.5 rounded-lg">
                  Tergabung
                </span>
              </div>
              <p className="text-[11px] text-purple-700 mt-1 leading-relaxed">
                Berikut adalah daftar seluruh rekan mahasiswa yang tergabung dalam pengerjaan tugas kelompok ini, termasuk Ketua Kolaborasi dan rekan anggota lainnya.
              </p>
            </div>
          </div>
        )}

        {feedbackMsg && (
          <div
            className={`mb-4 p-3 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
              feedbackMsg.type === "success"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                : "bg-pink-50 border border-pink-200 text-pink-800"
            }`}
          >
            {feedbackMsg.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-pink-600 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* Bagian Khusus Ketua Kolaborasi: Cari & Undang serta Bagikan Tautan */}
        {isOwner && (
          <>
            {/* 1. Pencarian Mahasiswa Berdasarkan Nama */}
            <div className="mb-6 space-y-2">
              <label className="block text-xs font-bold text-gray-700">
                Cari Nama Mahasiswa Terdaftar di Sistem
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (feedbackMsg) setFeedbackMsg(null);
                  }}
                  placeholder="Ketik minimal 1 huruf nama atau NIM mahasiswa..."
                  className="w-full pl-10 pr-10 py-2.5 bg-[#F8F9FE] border border-[#E2E8F5] rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 text-gray-800 placeholder:text-gray-400 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Hasil Pencarian Nama Mahasiswa dari Database */}
              <div className="mt-2 space-y-2 max-h-56 overflow-y-auto pr-1">
                {searchQuery.trim().length === 0 ? (
                  /* State saat kolom pencarian belum diisi */
                  <div className="p-5 rounded-2xl bg-[#F8F9FE] border border-dashed border-[#E2E8F5] text-center space-y-1.5">
                    <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 mx-auto">
                      <Search className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-bold text-gray-700">Mulai Pencarian Rekan</p>
                    <p className="text-[11px] text-gray-400">
                      Ketik minimal 1 huruf nama atau NIM mahasiswa di atas untuk mencari rekan kolaborasi.
                    </p>
                  </div>
                ) : isLoadingStudents ? (
                  <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex items-center justify-center gap-2.5 text-xs font-semibold text-indigo-700">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600 shrink-0" />
                    <span>Mencari di database mahasiswa TugasKu...</span>
                  </div>
                ) : filteredStudents.length > 0 ? (
                  filteredStudents.map((student) => {
                    const alreadyMember = isMember(student);
                    const isPending = isPendingInvite(student);

                    return (
                      <div
                        key={student.id || student.email}
                        className="flex items-center justify-between p-2.5 rounded-2xl bg-white border border-gray-100 hover:border-purple-200 transition-all shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={
                              student.avatarUrl ||
                              `https://api.dicebear.com/7.x/bottts/svg?seed=${student.fullName}`
                            }
                            alt={student.fullName}
                            className="w-8 h-8 rounded-xl object-cover bg-gray-100 ring-1 ring-gray-200 shrink-0"
                          />
                          <div className="min-w-0 text-left">
                            <p className="text-xs font-bold text-[#1E1B4B] truncate">
                              {student.fullName}
                            </p>
                            <p className="text-[10px] text-gray-400 truncate">
                              {student.nim ? `${student.nim} • ` : ""}{student.major || "Mahasiswa BSI"}
                            </p>
                          </div>
                        </div>

                        {alreadyMember ? (
                          <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 text-[10px] font-black border border-emerald-200/60 shrink-0 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            <span>Anggota</span>
                          </span>
                        ) : isPending ? (
                          <span className="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-700 text-[10px] font-black border border-amber-200/60 shrink-0 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Menunggu Diterima</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSelectStudent(student)}
                            className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold transition-all shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                          >
                            <UserPlus className="w-3 h-3" />
                            <span>Undang</span>
                          </button>
                        )}
                      </div>
                    );
                  })
                ) : (
                  /* State jika nama mahasiswa BELUM TERDAFTAR dalam sistem */
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-left space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-amber-800">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Mahasiswa Belum Terdaftar</span>
                    </div>
                    <p className="text-[11px] text-amber-700 leading-relaxed">
                      Mahasiswa dengan nama &ldquo;<strong>{searchQuery}</strong>&rdquo; belum ditemukan di database akun TugasKu. Pastikan rekan mahasiswa Anda sudah mendaftar akun terlebih dahulu.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Tautan Undangan Tugas (Opsional) */}
            <div className="mb-6 p-4 rounded-2xl bg-[#F8F9FE] border border-[#E2E8F5]">
              <span className="block text-[11px] font-bold text-gray-500 mb-1.5">
                Atau Bagikan Tautan Undangan Langsung (Berlaku 7 Hari)
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteLink}
                  className="w-full bg-white px-3 py-1.5 text-xs text-gray-600 rounded-xl border border-gray-200 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:text-purple-600 hover:border-purple-200 transition-all shrink-0 cursor-pointer"
                  title="Salin Tautan"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </>
        )}

        {/* 3. Daftar Anggota Kelompok (Dapat Dilihat Oleh Semua Anggota & Ketua) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-purple-600" />
              <span>Daftar Anggota Lainnya ({currentMembers.length})</span>
            </h3>
            <span className="text-[11px] text-gray-400 font-medium">
              {currentMembers.filter((m) => m?.role === "owner").length > 0 ? "1 Ketua • " : ""}
              {currentMembers.filter((m) => m?.role !== "owner").length} Anggota
            </span>
          </div>

          <div className={`${isOwner ? "max-h-44" : "max-h-72"} overflow-y-auto space-y-2 pr-1`}>
            {currentMembers.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-2">Belum ada anggota yang bergabung.</p>
            ) : (
              currentMembers.map((m, idx) => {
                const info = getStudentInfo(m);
                const isMe = isCurrentUserMember(m);
                const memberName = m?.fullName || "Mahasiswa";
                const avatarSrc = info?.avatarUrl || m?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(memberName)}`;
                const subtitle = info?.nim
                  ? `${info.nim} • ${info.major || "Mahasiswa BSI"}`
                  : (info?.email || (m as any)?.email || (m?.role === "owner" ? "Ketua Kelompok" : "Mahasiswa BSI"));

                return (
                  <div
                    key={m?.userId || memberName || `mem-${idx}`}
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-white border border-gray-100 hover:border-purple-200 transition-all shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={avatarSrc}
                        alt={memberName}
                        className="w-9 h-9 rounded-xl object-cover bg-purple-50 ring-1 ring-purple-100 shrink-0"
                      />
                      <div className="min-w-0 text-left">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-bold text-[#1E1B4B] truncate">{memberName}</p>
                          {isMe && (
                            <span className="px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700 text-[9px] font-black shrink-0">
                              Anda
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400 truncate">
                          {subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {m?.role === "owner" ? (
                        <span className="px-2.5 py-1 rounded-xl bg-amber-100/90 text-amber-900 text-[10px] font-black border border-amber-300 flex items-center gap-1 shadow-2xs shrink-0">
                          <span>👑 Ketua Kolaborasi</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-200/60 flex items-center gap-1 shadow-2xs shrink-0">
                          <span>Anggota</span>
                        </span>
                      )}

                      {isOwner && m.role !== "owner" && !isMe && (
                        <button
                          type="button"
                          onClick={() => onRemoveMember(task.id, m.userId)}
                          className="p-1.5 rounded-xl text-gray-400 hover:text-pink-600 hover:bg-pink-50 transition-colors cursor-pointer"
                          title="Keluarkan dari kelompok"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex items-center justify-end pt-5 mt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-gray-100 text-xs font-bold text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
          >
            {isOwner ? "Selesai" : "Tutup"}
          </button>
        </div>
      </div>
    </div>
  );
}
