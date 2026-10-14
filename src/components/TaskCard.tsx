"use client";

import React, { useState } from "react";
import { 
  Calendar, 
  Users, 
  User, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  MoreVertical, 
  Edit3, 
  Trash2, 
  UserPlus,
  Sparkles,
  Check
} from "lucide-react";
import { Task, Course } from "@/types";
import { getTaskStatus, getTaskStatusLabel, formatDeadline, isDeadlineNear } from "@/lib/businessRules";

interface TaskCardProps {
  task: Task;
  course?: Course;
  currentUserId?: string;
  onUpdateProgress: (taskId: string, newProgress: number) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onInvite: (task: Task) => void;
}

export function TaskCard({
  task,
  course,
  currentUserId,
  onUpdateProgress,
  onEdit,
  onDelete,
  onInvite,
}: TaskCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const status = getTaskStatus(task);
  const isUrgent = isDeadlineNear(task.deadline, 24);

  // Anggota kolaborasi hanya bisa ceklis progres saja (tidak bisa edit, undang, atau hapus tugas)
  const isOwner = React.useMemo(() => {
    if (task.taskType !== "group") return true;
    if (!currentUserId) return true;
    const cleanCurrent = currentUserId.toLowerCase().trim();
    if (task.createdBy && task.createdBy.toLowerCase().trim() === cleanCurrent) return true;
    const userMember = task.members?.find(
      (m) =>
        (m.userId && m.userId.toLowerCase().trim() === cleanCurrent) ||
        (m.email && m.email.toLowerCase().trim() === cleanCurrent)
    );
    if (userMember) {
      return userMember.role === "owner";
    }
    return false;
  }, [task, currentUserId]);

  // Status Styling
  const statusConfig = {
    completed: {
      textColor: "text-emerald-600",
      barGradient: "from-emerald-400 to-teal-500",
      icon: CheckCircle2,
    },
    overdue: {
      textColor: "text-rose-600",
      barGradient: "from-pink-500 to-rose-600",
      icon: AlertCircle,
    },
    in_progress: {
      textColor: "text-amber-600",
      barGradient: "from-amber-400 to-indigo-500",
      icon: Clock,
    },
    not_started: {
      textColor: "text-gray-500",
      barGradient: "from-gray-300 to-gray-400",
      icon: Clock,
    },
  }[status];

  const StatusIcon = statusConfig.icon;

  return (
    <div className="clay-card clay-card-hover p-6 bg-white relative transition-all">
      {/* Top Header: Course & Type Badges + Options */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex flex-wrap items-center gap-3">
          {course && (
            <span className="text-xs font-bold text-indigo-600">
              {course.name}
            </span>
          )}

          <span
            className={`inline-flex items-center gap-1 text-xs font-semibold ${
              task.taskType === "group" ? "text-purple-600" : "text-sky-600"
            }`}
          >
            {task.taskType === "group" ? (
              <>
                <Users className="w-3.5 h-3.5" />
                <span>Kelompok</span>
              </>
            ) : (
              <>
                <User className="w-3.5 h-3.5" />
                <span>Individu</span>
              </>
            )}
          </span>

          {isUrgent && status !== "completed" && (
            <span className="text-xs font-bold text-rose-600 animate-pulse flex items-center gap-1">
              🔥 Deadline &lt; 24 Jam
            </span>
          )}
        </div>

        {/* Action Menu (Hanya untuk pemilik/ketua tugas; Anggota kolaborasi hanya bisa ceklis progres) */}
        {isOwner ? (
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
              title="Opsi Tugas"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-9 w-36 bg-white rounded-2xl shadow-xl border border-gray-100 p-1.5 z-30">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit(task);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 rounded-xl cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Edit Tugas</span>
                </button>
                {task.taskType === "group" && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onInvite(task);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-50 rounded-xl cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-purple-500" />
                    <span>Undang Teman</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(task.id);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-pink-600 hover:bg-pink-50 rounded-xl cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Tugas</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <span
            className="text-[10px] font-bold px-2 py-1 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 select-none flex items-center gap-1 shadow-2xs"
            title="Anggota Kolaborasi (Hanya dapat mencentang progres tugas)"
          >
            <Users className="w-3 h-3 text-purple-500" />
            <span>Anggota</span>
          </span>
        )}
      </div>

      {/* Title & Description */}
      <h3 className="text-base font-bold text-[#1E1B4B] mb-1.5 leading-snug">
        {task.title}
      </h3>
      {task.description && (
        <p className="text-xs text-gray-500 mb-4 line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Deadline Info */}
      <div className="flex items-center gap-2 text-xs text-gray-500 font-medium mb-5">
        <Calendar className="w-4 h-4 text-gray-400" />
        <span>{formatDeadline(task.deadline)}</span>
      </div>

      {/* Checkbox & Point Reward Card */}
      <div
        className={`p-4 rounded-2xl border transition-all ${
          task.progress === 100
            ? "bg-emerald-50/40 border-emerald-100"
            : "bg-[#F8F9FE] border-[#E2E8F5]"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onUpdateProgress(task.id, task.progress === 100 ? 0 : 100)}
            className="flex items-center gap-3 cursor-pointer group text-left select-none flex-1 focus:outline-none"
          >
            {/* Custom Interactive Checkbox */}
            <div
              className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${
                task.progress === 100
                  ? "bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-500/20"
                  : "border-gray-300 bg-white group-hover:border-indigo-400"
              }`}
            >
              {task.progress === 100 && (
                <Check className="w-4 h-4 stroke-[3]" />
              )}
            </div>

            <div className="flex flex-col">
              <span
                className={`text-xs font-bold transition-colors ${
                  task.progress === 100 ? "text-emerald-700" : "text-[#1E1B4B]"
                }`}
              >
                {task.progress === 100 ? "Selesai Dikerjakan" : "Tandai Selesai"}
              </span>
              <span className="text-[11px] text-gray-400">
                {task.progress === 100 ? "Poin aktif di progres matkul" : "Klik untuk menyelesaikan tugas"}
              </span>
            </div>
          </button>

          {/* Points Display */}
          <div className="flex flex-col items-end shrink-0">
            <span
              className={`text-xs font-black ${
                task.progress === 100 ? "text-emerald-600" : "text-indigo-600"
              }`}
            >
              +{task.points ?? 50} Poin
            </span>
            <span className="text-[10px] text-gray-400">
              {task.progress === 100 ? "✓ Diperoleh" : "Bobot matkul"}
            </span>
          </div>
        </div>
      </div>

      {/* Collaboration Avatar Stack (For Group Tasks) */}
      {task.taskType === "group" && (
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-400 font-medium">Anggota:</span>
            <div className="flex -space-x-2 overflow-hidden">
              {(task.members || []).slice(0, 4).map((m, idx) => (
                <div
                  key={idx}
                  title={`${m.fullName} (${m.role})`}
                  className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center"
                >
                  {m.fullName.charAt(0)}
                </div>
              ))}
            </div>
            {(task.members?.length || 0) > 4 && (
              <span className="text-[11px] font-bold text-gray-500">
                +{(task.members?.length || 0) - 4}
              </span>
            )}
          </div>

          {isOwner && (
            <button
              onClick={() => onInvite(task)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Undang</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
