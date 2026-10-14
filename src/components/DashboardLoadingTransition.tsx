"use client";

import React, { useState, useEffect } from "react";
import { GraduationCap, CheckCircle2, Sparkles, BookOpen, Layers } from "lucide-react";
import { UserProfile } from "@/types";

interface DashboardLoadingTransitionProps {
  user: UserProfile;
  type?: "login" | "register";
  onComplete: () => void;
  durationMs?: number;
}

export function DashboardLoadingTransition({
  user,
  type = "login",
  onComplete,
  durationMs = 2400,
}: DashboardLoadingTransitionProps) {
  const [progress, setProgress] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const steps = [
    {
      percent: 30,
      title: type === "register" ? "Akun Mahasiswa Berhasil Dibuat" : "Autentikasi Akun Berhasil",
      desc: "Kredensial dan sesi keamanan mahasiswa BSI tervalidasi.",
      icon: CheckCircle2,
    },
    {
      percent: 70,
      title: "Sinkronisasi Data Akademik",
      desc: "Menghubungkan jadwal mata kuliah, matriks tugas, dan poin progres.",
      icon: BookOpen,
    },
    {
      percent: 100,
      title: "Menyiapkan Dashboard TugasKu",
      desc: `Selamat datang kembali, ${user.fullName.split(" ")[0]}!`,
      icon: Sparkles,
    },
  ];

  useEffect(() => {
    const startTime = performance.now();

    const interval = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / durationMs) * 100));
      setProgress(pct);

      if (pct < 35) {
        setCurrentStepIndex(0);
      } else if (pct < 75) {
        setCurrentStepIndex(1);
      } else {
        setCurrentStepIndex(2);
      }

      if (elapsed >= durationMs) {
        clearInterval(interval);
        setTimeout(() => {
          onComplete();
        }, 150);
      }
    }, 25);

    return () => clearInterval(interval);
  }, [durationMs, onComplete]);

  const currentStep = steps[currentStepIndex];
  const StepIcon = currentStep.icon;

  return (
    <div className="fixed inset-0 z-50 bg-[#F4F5FB] flex flex-col items-center justify-center p-4 selection:bg-indigo-500 selection:text-white font-sans overflow-hidden">
      {/* Background Soft Ambient Lights */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-indigo-200/50 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-purple-200/50 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 text-center animate-fade-in">
        {/* Animated Central Card */}
        <div className="bg-white/90 backdrop-blur-2xl rounded-3xl p-8 shadow-2xl border border-[#E2E8F5] relative overflow-hidden">
          
          {/* Top Decorative Progress Bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gray-100">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-75 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Animated 3D Floating Icon */}
          <div className="relative inline-flex items-center justify-center mb-6">
            {/* Spinning Aura Ring */}
            <div className="absolute -inset-3 rounded-3xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 opacity-20 blur-lg animate-pulse" />
            <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] flex items-center justify-center text-white shadow-xl shadow-indigo-500/30 transform hover:scale-105 transition-all">
              <GraduationCap className="w-10 h-10 animate-bounce" />
            </div>

            {/* Micro Badge for Status */}
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-white shadow-md">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          {/* Greeting & Student Info */}
          <div className="space-y-1 mb-5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              {type === "register" ? "Registrasi Berhasil" : "Login Berhasil"}
            </span>
            <h2 className="text-xl font-black text-[#1E1B4B] tracking-tight pt-1">
              {user.fullName}
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              NIM: <span className="font-bold text-gray-700">{user.nim}</span> &bull; {user.campus || "Universitas BSI"}
            </p>
          </div>

          {/* Animated Progress Meter */}
          <div className="space-y-2 mb-6">
            <div className="flex items-center justify-between text-xs font-bold text-gray-500 px-1">
              <span className="flex items-center gap-1.5 text-indigo-600">
                <StepIcon className="w-4 h-4" />
                {currentStep.title}
              </span>
              <span className="text-indigo-600 font-black">{progress}%</span>
            </div>

            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden p-0.5 border border-gray-200/70">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 transition-all duration-75 ease-out shadow-sm shadow-indigo-500/50"
                style={{ width: `${progress}%` }}
              />
            </div>

            <p className="text-[11px] text-gray-400 min-h-[16px] transition-all">
              {currentStep.desc}
            </p>
          </div>

          {/* Steps Indicator Dots */}
          <div className="flex items-center justify-center gap-2 pt-2 border-t border-gray-100">
            {steps.map((st, idx) => (
              <div
                key={idx}
                className={`transition-all duration-300 rounded-full ${
                  idx === currentStepIndex
                    ? "w-7 h-2 bg-indigo-600"
                    : idx < currentStepIndex
                    ? "w-2 h-2 bg-emerald-500"
                    : "w-2 h-2 bg-gray-200"
                }`}
              />
            ))}
          </div>

        </div>

        {/* Footer Brand */}
        <p className="text-xs text-gray-400 mt-4 font-semibold tracking-wide">
          TugasKu &bull; Universitas BSI (Bina Sarana Informatika)
        </p>
      </div>
    </div>
  );
}
