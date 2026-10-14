"use client";

import React, { useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, Users, ArrowRight, Sparkles, GraduationCap } from "lucide-react";

function InviteContent() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;
  const [accepted, setAccepted] = useState(false);

  const handleJoin = () => {
    setAccepted(true);
    setTimeout(() => {
      router.push("/");
    }, 1500);
  };

  return (
    <div className="max-w-md w-full clay-card p-8 bg-white border border-gray-100 text-center relative overflow-hidden">
      {/* Decorative glow */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-purple-200/50 rounded-full blur-2xl pointer-events-none" />

      <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] text-white flex items-center justify-center mx-auto mb-5 shadow-lg shadow-indigo-500/25">
        <GraduationCap className="w-8 h-8" />
      </div>

      <div className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 mb-3">
        <Sparkles className="w-4 h-4 text-purple-500" />
        <span>Undangan Kolaborasi Tugas</span>
      </div>

      <h1 className="text-xl font-extrabold text-[#1E1B4B] mb-2">
        Bergabung ke Tugas Kelompok
      </h1>

      <p className="text-xs text-gray-500 mb-6 leading-relaxed">
        Kamu diundang oleh rekan kelompok untuk berkolaborasi dan melacak progres bersama di TugasKu.
      </p>

      <div className="p-4 rounded-2xl bg-[#F8F9FE] border border-[#E2E8F5] mb-6 text-left">
        <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
          Token Undangan
        </span>
        <p className="text-xs font-mono font-bold text-indigo-700 truncate">
          {token || "tk-valid-token"}
        </p>
        <span className="text-[10px] text-emerald-600 font-semibold mt-1 block">
          ✓ Status: Valid & Belum Kedaluwarsa
        </span>
      </div>

      {accepted ? (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Berhasil Bergabung! Mengarahkan ke Dashboard...</span>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <button
            onClick={handleJoin}
            className="w-full py-3 clay-button-primary text-xs font-bold shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2"
          >
            <span>Terima Undangan & Gabung</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => router.push("/")}
            className="text-xs font-semibold text-gray-400 hover:text-gray-600 py-1"
          >
            Kembali ke Beranda
          </button>
        </div>
      )}
    </div>
  );
}

export default function InviteAcceptancePage() {
  return (
    <div className="min-h-screen bg-[#F4F5FB] flex flex-col items-center justify-center p-6">
      <Suspense fallback={<div className="text-xs text-gray-400 font-bold">Memverifikasi undangan...</div>}>
        <InviteContent />
      </Suspense>
    </div>
  );
}
