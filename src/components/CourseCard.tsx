"use client";

import React from "react";
import { BookOpen, MoreVertical, Edit2, Trash2, CheckCircle2 } from "lucide-react";
import { Course } from "@/types";

interface CourseCardProps {
  course: Course;
  taskStats: { total: number; progress: number };
  isSelected?: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function CourseCard({
  course,
  taskStats,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: CourseCardProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);

  // Palet warna clay sesuai tema
  const colorMap: Record<string, { bg: string; text: string; bar: string; iconBg: string }> = {
    indigo: {
      bg: "bg-indigo-50/70",
      text: "text-indigo-600",
      bar: "from-indigo-500 to-indigo-600",
      iconBg: "bg-indigo-100",
    },
    violet: {
      bg: "bg-purple-50/70",
      text: "text-purple-600",
      bar: "from-purple-500 to-purple-600",
      iconBg: "bg-purple-100",
    },
    blue: {
      bg: "bg-sky-50/70",
      text: "text-sky-600",
      bar: "from-sky-500 to-sky-600",
      iconBg: "bg-sky-100",
    },
    pink: {
      bg: "bg-pink-50/70",
      text: "text-pink-600",
      bar: "from-pink-500 to-pink-600",
      iconBg: "bg-pink-100",
    },
    emerald: {
      bg: "bg-emerald-50/70",
      text: "text-emerald-600",
      bar: "from-emerald-500 to-emerald-600",
      iconBg: "bg-emerald-100",
    },
  };

  const scheme = colorMap[course.color] || colorMap.indigo;

  return (
    <div
      onClick={onSelect}
      className={`clay-card clay-card-hover p-5 cursor-pointer relative overflow-hidden transition-all ${
        isSelected
          ? "ring-2 ring-indigo-500 bg-indigo-50/20 shadow-md shadow-indigo-100"
          : "bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <BookOpen className={`w-6 h-6 ${scheme.text} shrink-0`} />
          <div>
            <span className={`text-[11px] font-bold uppercase tracking-wider ${scheme.text}`}>
              {course.code || "KULIAH"}
            </span>
            <h3 className="text-sm font-bold text-[#1E1B4B] line-clamp-1">{course.name}</h3>
          </div>
        </div>

        {/* Action Menu */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-9 w-32 bg-white rounded-2xl shadow-xl border border-gray-100 p-1.5 z-30">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 rounded-xl"
              >
                <Edit2 className="w-3.5 h-3.5 text-indigo-500" />
                <span>Edit</span>
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-pink-600 hover:bg-pink-50 rounded-xl"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {course.lecturer && (
        <p className="text-xs text-gray-400 mb-4 font-medium line-clamp-1">
          Dosen: {course.lecturer}
        </p>
      )}

      {/* Progress & Task Count */}
      <div className="pt-2 border-t border-gray-100 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500 font-medium">
            {taskStats.total} tugas
          </span>
          <span className="font-bold text-[#1E1B4B]">
            {taskStats.progress}%
          </span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${scheme.bar} transition-all duration-500`}
            style={{ width: `${taskStats.progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
