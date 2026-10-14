"use client";

import React from "react";
import { Filter, ArrowUpDown } from "lucide-react";
import { Course } from "@/types";

interface TaskFiltersProps {
  statusFilter: string;
  onStatusChange: (status: string) => void;
  typeFilter: string;
  onTypeChange: (type: string) => void;
  selectedCourseId: string;
  onCourseChange: (courseId: string) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  courses: Course[];
  totalCounts: {
    all: number;
    active: number;
    completed: number;
    overdue: number;
  };
}

export function TaskFilters({
  statusFilter,
  onStatusChange,
  typeFilter,
  onTypeChange,
  selectedCourseId,
  onCourseChange,
  sortBy,
  onSortChange,
  courses,
  totalCounts,
}: TaskFiltersProps) {
  const statusTabs = [
    { id: "all", label: "Semua", count: totalCounts.all },
    { id: "active", label: "Aktif", count: totalCounts.active },
    { id: "completed", label: "Selesai", count: totalCounts.completed },
    { id: "overdue", label: "Terlambat", count: totalCounts.overdue },
  ];

  return (
    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 py-2">
      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-white/80 backdrop-blur-sm rounded-2xl border border-[#E2E8F5] overflow-x-auto">
        {statusTabs.map((tab) => {
          const isActive = statusFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onStatusChange(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                isActive
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/60"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Secondary Controls: Type, Course, and Sort */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Type Filter */}
        <select
          value={typeFilter}
          onChange={(e) => onTypeChange(e.target.value)}
          className="bg-white/90 border border-[#E2E8F5] text-xs font-bold text-gray-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 shadow-sm"
        >
          <option value="all">Semua Tipe</option>
          <option value="individual">👤 Individu</option>
          <option value="group">👥 Kelompok</option>
        </select>

        {/* Course Filter */}
        <select
          value={selectedCourseId}
          onChange={(e) => onCourseChange(e.target.value)}
          className="bg-white/90 border border-[#E2E8F5] text-xs font-bold text-gray-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 shadow-sm max-w-[160px] truncate"
        >
          <option value="all">Semua Mata Kuliah</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Sort Order */}
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="bg-white/90 border border-[#E2E8F5] text-xs font-bold text-gray-700 rounded-xl px-3 py-2 pl-7 focus:outline-none focus:ring-1 focus:ring-indigo-400 shadow-sm"
          >
            <option value="deadline">Deadline Terdekat</option>
            <option value="progress_asc">Progres Terendah</option>
            <option value="progress_desc">Progres Tertinggi</option>
            <option value="title">Judul A-Z</option>
          </select>
          <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>
    </div>
  );
}
