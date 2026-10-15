"use client";

import React, { useState, useMemo, useEffect } from "react";
import { X, UserPlus, Users, Copy, Check, Trash2, Search, AlertCircle, CheckCircle2, Loader2, Clock } from "lucide-react";
import { Task, UserProfile } from "@/types";
import { fetchRegisteredStudents, getCurrentUser, getTaskInvitations } from "@/lib/storage";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

interface InviteMemberModalProps {
  isOpen: boolean;
  task: Task | null;
  onClose: () => void;
  onAddMember: (taskId: string, email: string) => void;
  onRemoveMember: (taskId: string, userId: string) => void;
}

export function InviteMemberModal({
  isOpen,
  task,
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

  const currentUser = useMemo(() => getCurrentUser(), [isOpen]);

  // Sinkronkan status undangan aktif dari server DB untuk tugas ini
  useEffect(() => {
    if (!isOpen || !task?.id) {
      setServerPendingEmails([]);
      return;
    }

    let isMounted = true;
    fetch(`/api/db/invitations?taskId=${encodeURIComponent(task.id)}`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.success && Array.isArray(data.invitations)) {
          const pending = data.invitations
            .filter((inv: any) => inv.status === "pending")
            .map((inv: any) => inv.invitedEmail.toLowerCase().trim());
          setServerPendingEmails(pending);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [isOpen, task?.id, feedbackMsg]);

  // Reset pencarian saat modal ditutup / dibuka
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setDebouncedQuery("");
      setRegisteredStudents([]);
      setFeedbackMsg(null);
    }
  }, [isOpen]);

  // Debounce input pencarian
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Ambil daftar mahasiswa dari Server DB secara asinkron HANYA jika sudah mengetik minimal 1 huruf
  useEffect(() => {
    if (!isOpen) {
      setRegisteredStudents([]);
      return;
    }

    const clean = debouncedQuery.trim();
    if (clean.length === 0) {
      setRegisteredStudents([]);
      setIsLoadingStudents(false);
      return;
    }

    let isMounted = true;
    setIsLoadingStudents(true);

    fetchRegisteredStudents(clean)
      .then((students) => {
        if (isMounted) {
          setRegisteredStudents(students);
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
 
  // Realtime subscription untuk mendeteksi pembaruan profil / avatar mahasiswa lain secara langsung
  useEffect(() => {
    if (!isOpen || !isSupabaseConfigured || !supabase) return;

    const client = supabase;
    const channel = client
      .channel("invite-modal-profiles-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          const clean = debouncedQuery.trim();
          if (clean.length > 0) {
            fetchRegisteredStudents(clean).then((fresh) => {
              setRegisteredStudents(fresh);
            });
          }
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [isOpen, debouncedQuery]);

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

  if (!isOpen || !task) return null;

  const currentMembers = task.members || [];

  const isMember = (student: UserProfile) => {
    return currentMembers.some(
      (m) =>
        m.userId === student.id ||
        m.fullName.toLowerCase().trim() === student.fullName.toLowerCase().trim() ||
        (student.email && m.fullName.toLowerCase().includes(student.email.split("@")[0].toLowerCase()))
    );
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
          <h2 className="text-xl font-bold text-[#1E1B4B]">Kolaborasi Tugas Kelompok</h2>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
            {task.title}
          </p>
        </div>

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

        {/* 3. Daftar Anggota Aktif Saat Ini */}
        <div>
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-700 mb-3">
            Anggota Aktif Saat Ini ({currentMembers.length})
          </h3>

          <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
            {currentMembers.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-2">Belum ada anggota yang bergabung.</p>
            ) : (
              currentMembers.map((m) => (
                <div
                  key={m.userId}
                  className="flex items-center justify-between p-2.5 rounded-2xl bg-white border border-gray-100 hover:border-gray-200 transition-all shadow-2xs"
                >
                  <div className="flex items-center gap-2.5">
                    <img
                      src={
                        m.avatarUrl ||
                        `https://api.dicebear.com/7.x/bottts/svg?seed=${m.fullName}`
                      }
                      alt={m.fullName}
                      className="w-8 h-8 rounded-xl object-cover bg-purple-50 ring-1 ring-purple-100"
                    />
                    <div>
                      <p className="text-xs font-bold text-[#1E1B4B]">{m.fullName}</p>
                      <span className="text-[10px] text-gray-400 capitalize">
                        {m.role === "owner" ? "Ketua Kelompok" : "Anggota"}
                      </span>
                    </div>
                  </div>

                  {m.role !== "owner" && (
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
              ))
            )}
          </div>
        </div>

        <div className="flex items-center justify-end pt-5 mt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-gray-100 text-xs font-bold text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
}
