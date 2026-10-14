"use client";

import React from "react";
import { ArrowRight, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { DashboardMetrics, UserProfile } from "@/types";

interface HeroBannerProps {
  user: UserProfile;
  metrics: DashboardMetrics;
  onExploreClick: () => void;
}

export function HeroBanner({ user, metrics, onExploreClick }: HeroBannerProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl p-7 md:p-8 text-white shadow-xl shadow-indigo-500/20 bg-gradient-to-r from-[#6366F1] via-[#7466F3] to-[#8B5CF6]">
      {/* Decorative Blur Circles */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 -mb-12 w-48 h-48 bg-purple-400/20 rounded-full blur-xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="max-w-xl space-y-2.5">

          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Hi, {user.fullName.split(" ")[0]}! 👋
          </h2>

          <p className="text-sm text-indigo-100 leading-relaxed">
            Kamu memiliki <strong className="text-white font-bold">{metrics.activeTasks} tugas aktif</strong>. 
            Rata-rata progres tugasmu saat ini berada di angka{" "}
            <strong className="text-white font-bold">{metrics.averageProgress}%</strong>. Terus pertahankan ritme belajarmu!
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={onExploreClick}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-indigo-600 font-bold text-xs hover:bg-indigo-50 transition-all shadow-md shadow-black/5"
            >
              <span>Semua Tugas</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            {metrics.overdueTasks > 0 && (
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-pink-200">
                <AlertTriangle className="w-3.5 h-3.5 text-pink-200" />
                <span>{metrics.overdueTasks} tugas perlu perhatian</span>
              </div>
            )}
          </div>
        </div>

        {/* Crisp Solid White Stat Cards */}
        <div className="grid grid-cols-2 gap-4 w-full md:w-auto shrink-0">
          {/* Card 1: Tugas Aktif */}
          <div className="bg-white rounded-2xl p-4.5 min-w-[155px] shadow-lg shadow-indigo-950/15 border border-indigo-100 flex flex-col justify-between transition-all hover:-translate-y-1 hover:shadow-xl">
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                Tugas Aktif
              </span>
              <Clock className="w-6 h-6 text-amber-500 shrink-0" strokeWidth={2.2} />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-black text-[#1E1B4B] tracking-tight">
                {metrics.activeTasks}
              </span>
              <span className="text-xs font-bold text-amber-600">
                Berjalan
              </span>
            </div>
          </div>

          {/* Card 2: Selesai */}
          <div className="bg-white rounded-2xl p-4.5 min-w-[155px] shadow-lg shadow-indigo-950/15 border border-indigo-100 flex flex-col justify-between transition-all hover:-translate-y-1 hover:shadow-xl">
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                Selesai
              </span>
              <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" strokeWidth={2.2} />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-black text-[#1E1B4B] tracking-tight">
                {metrics.completedTasks}
              </span>
              <span className="text-xs font-bold text-emerald-600">
                Tuntas
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
