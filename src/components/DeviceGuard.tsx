"use client";

import React, { useState, useEffect } from "react";
import {
  Laptop,
  Tablet,
  Smartphone,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  Info,
  Maximize2,
  ExternalLink,
} from "lucide-react";
import { checkDeviceSupport, DeviceInfo } from "@/lib/deviceDetection";

interface DeviceGuardProps {
  children: React.ReactNode;
}

export function DeviceGuard({ children }: DeviceGuardProps) {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const performCheck = () => {
    setIsChecking(true);
    const info = checkDeviceSupport();
    setDeviceInfo(info);
    setTimeout(() => {
      setIsChecking(false);
    }, 400);
  };

  useEffect(() => {
    performCheck();

    const handleResize = () => {
      setDeviceInfo(checkDeviceSupport());
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  // Hanya tampilkan layar pemblokir jika perangkat di client sudah terdeteksi dan TIDAK didukung
  if (deviceInfo && !deviceInfo.isSupported) {

  // ==========================================================================
  // TAMPILAN BLOKIR ELEGAN: AKSES DITOLAK (PERANGKAT DI BAWAH 8.7 INCI)
  // ==========================================================================
  return (
    <div className="min-h-screen w-full bg-[#0F172A] text-white flex items-center justify-center p-4 sm:p-6 selection:bg-indigo-500 selection:text-white relative overflow-hidden font-sans">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-pink-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl relative z-10 animate-fade-in">
        {/* Main Glassmorphic Card */}
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-slate-700/60 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/60 relative overflow-hidden">
          
          {/* Top Decorative Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-500 via-rose-500 to-indigo-500" />

          {/* Security Alert Header */}
          <div className="text-center space-y-3 mb-6">
            <div className="inline-flex p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 shadow-lg shadow-rose-500/10 animate-pulse">
              <ShieldAlert className="w-9 h-9" />
            </div>
            
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold uppercase tracking-wider">
                <XCircle className="w-3.5 h-3.5" />
                Akses Ditolak &bull; Perangkat Tidak Memenuhi Syarat
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-2">
                Hanya Untuk Laptop &amp; Tablet
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 font-medium">
                Ukuran Layar Kerja Minimal: <strong className="text-indigo-400">8.7 Inci</strong>
              </p>
            </div>
          </div>

          {/* Desktop Mode Detection Notice (If Phone Used Desktop Mode) */}
          {deviceInfo.isDesktopModeOnMobile && (
            <div className="mb-5 p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="text-amber-300">Mode Desktop Terdeteksi: </strong>
                Meskipun Anda mengaktifkan <em>&quot;Situs Desktop / Desktop Site&quot;</em> pada ponsel, sistem tetap mendeteksi bahwa dimensi fisik layar Anda adalah smartphone di bawah 8.7 inci.
              </div>
            </div>
          )}

          {/* Diagnostic Info Box */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 mb-6 space-y-2.5 text-xs">
            <div className="flex items-center justify-between text-slate-400 font-semibold border-b border-slate-700/60 pb-2">
              <span className="flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-rose-400" />
                Status Perangkat Anda:
              </span>
              <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 font-bold">
                {deviceInfo.deviceType === "phone" ? "Smartphone" : "Tablet Kecil (< 8.7\")"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 text-slate-300">
              <div>
                <span className="text-slate-400 block text-[11px]">Estimasi Ukuran Fisik:</span>
                <span className="font-bold text-rose-400 text-sm">~{deviceInfo.estimatedInches} Inci</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Syarat Minimal:</span>
                <span className="font-bold text-emerald-400 text-sm">&ge; 8.7 Inci</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Resolusi Terbaca:</span>
                <span className="font-medium text-slate-200">{deviceInfo.screenWidth} &times; {deviceInfo.screenHeight} px</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Status Kebijakan:</span>
                <span className="font-semibold text-rose-300">Otomatis Ditolak</span>
              </div>
            </div>
          </div>

          {/* Device Comparison Matrix */}
          <div className="space-y-2.5 mb-6">
            <p className="text-xs font-bold text-slate-300 uppercase tracking-wider text-center">
              Ketentuan Perangkat yang Diizinkan
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Allowed Devices */}
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                  <Laptop className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-emerald-300 font-bold text-xs">
                    <span>Laptop / Komputer</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Layar 11&quot; &ndash; 16&quot;+ dengan keyboard &amp; trackpad.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                  <Tablet className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-emerald-300 font-bold text-xs">
                    <span>Tablet &ge; 8.7 Inci</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Contoh: Samsung Tab A9 (8.7&quot;), iPad 10.2&quot;+, dsb.
                  </p>
                </div>
              </div>
            </div>

            {/* Blocked Device Note */}
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-2.5 text-xs text-rose-300">
              <Smartphone className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                <strong>Smartphone (Semua Merek / Ukuran):</strong> Ditolak secara mutlak termasuk saat menggunakan mode desktop.
              </span>
            </div>
          </div>

          {/* Explanation Reason */}
          <div className="p-3.5 rounded-2xl bg-slate-800/50 border border-slate-700/50 text-[11px] text-slate-400 leading-relaxed mb-6">
            <p className="text-slate-300 font-semibold mb-1 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Mengapa Kebijakan Ini Diterapkan?
            </p>
            TugasKu merupakan portal produktivitas akademik komprehensif yang memuat matriks tugas, matriks bobot nilai, kolaborasi kelompok, dan visualisasi progres 0-100%. Layar kerja minimal 8.7 inci diwajibkan demi menjaga kenyamanan membaca, kemudahan navigasi, dan integritas antarmuka mahasiswa.
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            <button
              onClick={performCheck}
              disabled={isChecking}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className={`w-4 h-4 ${isChecking ? "animate-spin" : ""}`} />
              <span>{isChecking ? "Memeriksa Perangkat..." : "Periksa Ulang Perangkat"}</span>
            </button>
          </div>

          {/* Bottom Footer Note */}
          <div className="mt-5 text-center text-[11px] text-slate-500">
            TugasKu &bull; Universitas BSI (Bina Sarana Informatika)
          </div>
        </div>
      </div>
    </div>
  );
}

// Render konten normal (Laptop, Tablet >= 8.7 Inci, atau SSR)
return <>{children}</>;
}
