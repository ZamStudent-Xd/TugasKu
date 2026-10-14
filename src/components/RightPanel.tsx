"use client";

import React from "react";
import { 
  Clock, 
  Calendar, 
  Users, 
  ChevronRight, 
  CheckCircle2 
} from "lucide-react";
import { Task, DashboardMetrics } from "@/types";
import { formatDeadline, getTaskStatus } from "@/lib/businessRules";

interface RightPanelProps {
  metrics: DashboardMetrics;
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  onOpenCreateTask: () => void;
}

export function RightPanel({
  metrics,
  tasks,
  onSelectTask,
  onOpenCreateTask,
}: RightPanelProps) {
  // Tugas mendatang yang belum selesai, diurutkan berdasarkan deadline terdekat
  const upcomingTasks = tasks
    .filter((t) => getTaskStatus(t) !== "completed" && t.deadline)
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
    .slice(0, 3);

  // Daftar tim kolaborasi aktif
  const groupTasks = tasks.filter((t) => t.taskType === "group");

  return (
    <div className="w-full xl:w-80 flex flex-col gap-6 shrink-0">

      {/* Deadlines Terdekat / Quick List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1E1B4B] flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            <span>Deadline Terdekat</span>
          </h3>
          <span className="text-[11px] text-indigo-600 font-bold">
            {upcomingTasks.length} Mendatang
          </span>
        </div>

        {upcomingTasks.length === 0 ? (
          <div className="p-4 text-center rounded-2xl bg-gray-50/60 border border-dashed border-gray-200">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
            <p className="text-xs text-gray-500 font-medium">Tidak ada deadline mendesak!</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {upcomingTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => onSelectTask(task)}
                className="p-3.5 rounded-2xl bg-white border border-[#E2E8F5] hover:border-indigo-300 transition-all cursor-pointer shadow-sm group"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className="text-xs font-bold text-[#1E1B4B] group-hover:text-indigo-600 transition-colors line-clamp-1">
                    {task.title}
                  </h4>
                  <span className="text-xs font-black text-indigo-600">
                    {task.progress}%
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-gray-400">
                  <Calendar className="w-3 h-3 text-gray-400" />
                  <span>{formatDeadline(task.deadline)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Kolaborasi Tim Aktif */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1E1B4B] flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-purple-600" />
            <span>Tugas Kelompok Aktif</span>
          </h3>
          <span className="text-[11px] text-purple-600 font-bold">
            {groupTasks.length} Tugas
          </span>
        </div>

        {groupTasks.length === 0 ? (
          <div className="p-4 text-center rounded-2xl bg-gray-50/60 border border-dashed border-gray-200">
            <p className="text-xs text-gray-400 font-medium">Belum ada tugas kelompok aktif.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {groupTasks.slice(0, 3).map((gt) => (
              <div
                key={gt.id}
                onClick={() => onSelectTask(gt)}
                className="p-3 rounded-2xl bg-[#F8F9FE] border border-gray-100 hover:border-purple-200 cursor-pointer transition-all"
              >
                <p className="text-xs font-bold text-[#1E1B4B] line-clamp-1 mb-1">
                  {gt.title}
                </p>
                <div className="flex items-center justify-between text-[11px] text-gray-500">
                  <span>{(gt.members || []).length} Anggota</span>
                  <span className="font-bold text-purple-700">{gt.progress}% Progres</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
