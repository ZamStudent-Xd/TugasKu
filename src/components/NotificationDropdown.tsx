"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Bell,
  Check,
  X,
  Users,
  Clock,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import { Task, Course, TaskInvitation, UserProfile } from "@/types";
import { formatDeadline } from "@/lib/businessRules";

export interface DeadlineTaskAlert {
  task: Task;
  courseName?: string;
  hoursRemaining: number;
}

interface NotificationDropdownProps {
  currentUser: UserProfile;
  invitations: TaskInvitation[];
  deadlineAlerts: DeadlineTaskAlert[];
  onAcceptInvitation: (invitationId: string) => Promise<void>;
  onDeclineInvitation: (invitationId: string) => Promise<void>;
  onSelectTask: (taskId: string) => void;
}

export function NotificationDropdown({
  currentUser,
  invitations,
  deadlineAlerts,
  onAcceptInvitation,
  onDeclineInvitation,
  onSelectTask,
}: NotificationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "invitations" | "deadlines">("all");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const pendingInvitations = invitations.filter((inv) => inv.status === "pending");
  const totalCount = pendingInvitations.length + deadlineAlerts.length;

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleAccept = async (invId: string) => {
    setProcessingId(invId);
    try {
      await onAcceptInvitation(invId);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (invId: string) => {
    setProcessingId(invId);
    try {
      await onDeclineInvitation(invId);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notification Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative w-10 h-10 rounded-2xl border transition-all flex items-center justify-center shrink-0 cursor-pointer ${
          isOpen
            ? "bg-indigo-50 border-indigo-300 text-indigo-600 shadow-sm"
            : "bg-white border-[#E2E8F5] text-gray-600 hover:text-indigo-600 hover:border-indigo-200 shadow-xs hover:shadow-sm"
        }`}
        title="Notifikasi & Undangan Kolaborasi"
        aria-label="Buka Notifikasi"
      >
        <Bell className="w-5 h-5" />
        {totalCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-black flex items-center justify-center border-2 border-white shadow-sm shadow-rose-500/50 animate-pulse">
            {totalCount > 9 ? "9+" : totalCount}
          </span>
        )}
      </button>

      {/* Notification Panel Popover */}
      {isOpen && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full mt-2 w-[360px] sm:w-[430px] bg-white rounded-3xl shadow-2xl shadow-indigo-950/25 border border-[#E2E8F5] z-[100] overflow-hidden animate-fade-in text-left ring-1 ring-black/5"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50/90 to-indigo-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-[#1E1B4B]">Notifikasi TugasKu</h3>
                <p className="text-[11px] text-gray-500 font-medium">
                  Undangan kelompok &amp; peringatan deadline
                </p>
              </div>
            </div>
            {totalCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-rose-500 text-white text-[11px] font-black shadow-xs">
                {totalCount} Baru
              </span>
            )}
          </div>

          {/* Segmented Filter Tabs */}
          <div className="p-2.5 bg-gray-50/80 border-b border-gray-100">
            <div className="grid grid-cols-3 gap-1 bg-gray-200/60 p-1 rounded-2xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`py-2 px-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap text-[11px] ${
                  activeTab === "all"
                    ? "bg-white text-indigo-700 shadow-xs font-black"
                    : "text-gray-500 hover:text-gray-800 font-semibold"
                }`}
              >
                <span>Semua</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === "all" ? "bg-indigo-100 text-indigo-700 font-black" : "bg-gray-200/80 text-gray-600"}`}>
                  {totalCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("invitations")}
                className={`py-2 px-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap text-[11px] ${
                  activeTab === "invitations"
                    ? "bg-white text-purple-700 shadow-xs font-black"
                    : "text-gray-500 hover:text-gray-800 font-semibold"
                }`}
              >
                <span>Undangan</span>
                {pendingInvitations.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-black">
                    {pendingInvitations.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("deadlines")}
                className={`py-2 px-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap text-[11px] ${
                  activeTab === "deadlines"
                    ? "bg-white text-amber-700 shadow-xs font-black"
                    : "text-gray-500 hover:text-gray-800 font-semibold"
                }`}
              >
                <span>Deadline H-1</span>
                {deadlineAlerts.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">
                    {deadlineAlerts.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Content Body */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-100 p-2 space-y-2">
            
            {/* 1. SEKSI UNDANGAN KOLABORASI */}
            {(activeTab === "all" || activeTab === "invitations") &&
              pendingInvitations.map((inv) => (
                <div
                  key={inv.id}
                  className="p-3.5 rounded-2xl bg-purple-50/50 border border-purple-100 hover:border-purple-200 transition-all text-left space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <img
                        src={
                          inv.inviterAvatar ||
                          `https://api.dicebear.com/7.x/bottts/svg?seed=${inv.inviterName || "bsi"}`
                        }
                        alt={inv.inviterName || "Pengundang"}
                        className="w-7 h-7 rounded-xl object-cover bg-white ring-1 ring-purple-200"
                      />
                      <div>
                        <span className="text-[11px] font-black text-purple-800 block leading-tight">
                          {inv.inviterName || "Rekan Mahasiswa"}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          Mengundang Anda ke tugas kelompok
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 text-[10px] font-bold shrink-0">
                      Undangan Tim
                    </span>
                  </div>

                  {/* Detail Tugas */}
                  <div className="bg-white/80 rounded-xl p-2.5 border border-purple-100/80">
                    <h4 className="text-xs font-bold text-[#1E1B4B] leading-snug">
                      {inv.taskTitle || "Tugas Kelompok Mahasiswa"}
                    </h4>
                    {inv.courseName && (
                      <span className="inline-block mt-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                        {inv.courseName}
                      </span>
                    )}
                  </div>

                  {/* Tombol Tindakan Terima & Tolak */}
                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      disabled={processingId === inv.id}
                      onClick={() => handleAccept(inv.id)}
                      className="flex-1 py-1.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all active:scale-[0.98]"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{processingId === inv.id ? "Memproses..." : "Terima"}</span>
                    </button>
                    <button
                      type="button"
                      disabled={processingId === inv.id}
                      onClick={() => handleDecline(inv.id)}
                      className="py-1.5 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 transition-all active:scale-[0.98]"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Tolak</span>
                    </button>
                  </div>
                </div>
              ))}

            {/* 2. SEKSI PERINGATAN DEADLINE H-1 */}
            {(activeTab === "all" || activeTab === "deadlines") &&
              deadlineAlerts.map(({ task, courseName, hoursRemaining }) => (
                <div
                  key={task.id}
                  className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/80 hover:border-amber-300 transition-all text-left space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-wider">
                      <Clock className="w-3 h-3 text-amber-700" />
                      {hoursRemaining <= 0
                        ? "Melewati Batas Waktu"
                        : hoursRemaining <= 12
                        ? "Kritis (< 12 Jam)"
                        : "Tenggat H-1"}
                    </span>
                    <span className="text-[10px] font-bold text-amber-700">
                      {hoursRemaining <= 0
                        ? "Hari Ini"
                        : `Sisa ~${Math.ceil(hoursRemaining)} Jam`}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-gray-900 leading-snug">
                      {task.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      {courseName && (
                        <span className="text-[10px] font-bold text-gray-600 bg-white px-2 py-0.5 rounded-md border border-amber-200/60">
                          {courseName}
                        </span>
                      )}
                      <span className="text-[10px] text-gray-500 font-medium flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        {formatDeadline(task.deadline)}
                      </span>
                    </div>
                  </div>

                  {/* Progres Tugas */}
                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <span className="text-gray-500">Progres saat ini:</span>
                    <span className="font-bold text-indigo-600">{task.progress}%</span>
                  </div>

                  {/* Tombol Lihat Tugas */}
                  <button
                    type="button"
                    onClick={() => {
                      onSelectTask(task.id);
                      setIsOpen(false);
                    }}
                    className="w-full py-1.5 px-3 rounded-xl bg-white border border-amber-300/80 hover:bg-amber-100/60 text-amber-900 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  >
                    <span>Buka &amp; Kerjakan Tugas</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

            {/* EMPTY STATE JIKA TIDAK ADA NOTIFIKASI */}
            {totalCount === 0 && (
              <div className="py-10 px-4 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                </div>
                <h4 className="text-xs font-bold text-gray-800">
                  Tidak Ada Notifikasi Baru
                </h4>
                <p className="text-[11px] text-gray-400 max-w-xs mx-auto leading-relaxed">
                  Semua tugas kelompok dan deadline akademik Anda terkendali dengan baik. Tetap semangat kuliah!
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 bg-gray-50 border-t border-gray-100 text-center">
            <span className="text-[10px] text-gray-400 font-medium">
              Notifikasi otomatis diperbarui secara real-time
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
