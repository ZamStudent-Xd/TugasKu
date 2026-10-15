"use client";

import React, { useState, useEffect } from "react";
import { 
  GraduationCap, 
  Lock, 
  Mail, 
  User, 
  KeyRound, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff,
  Sparkles,
  RefreshCw,
  ArrowLeft,
  RotateCcw
} from "lucide-react";
import { UserProfile } from "@/types";
import { 
  loginStudent, 
  requestStudentRegistration, 
  verifyStudentRegistration
} from "@/lib/storage";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  validateStudentEmail,
  validateNim,
  validateFullName,
  validatePassword,
  validateOtpCode,
} from "@/lib/securityValidation";
import { checkDeviceSupport } from "@/lib/deviceDetection";
import { DashboardLoadingTransition } from "@/components/DashboardLoadingTransition";

interface AuthPageProps {
  initialTab?: "login" | "register";
  onSuccess: (user: UserProfile) => void;
}

export function AuthPage({ initialTab = "login", onSuccess }: AuthPageProps) {
  const [tab, setTab] = useState<"login" | "register">(initialTab);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.location.pathname === "/register") {
        setTab("register");
      } else if (window.location.pathname === "/login") {
        setTab("login");
      }
    }
  }, []);

  useEffect(() => {
    if (initialTab) {
      setTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== "undefined") {
        if (window.location.pathname === "/register") {
          setTab("register");
        } else {
          setTab("login");
        }
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
  
  // Login State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Register State
  const [regFullName, setRegFullName] = useState("");
  const [regNim, setRegNim] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Verification Step State (Privasi Penuh: Kode rahasia hanya ada di inbox email pengguna)
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [supabaseNotice, setSupabaseNotice] = useState<string | null>(null);

  // Form Field Errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Loading Transition State (Delay Animasi Sebelum Masuk Dashboard)
  const [transitioningUser, setTransitioningUser] = useState<UserProfile | null>(null);
  const [transitionType, setTransitionType] = useState<"login" | "register">("login");

  const clearFieldError = (field: string) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    setLoginError(null);
    setVerifyError(null);
  };

  // Reset isian field form Login
  const handleResetLoginForm = () => {
    setLoginEmail("");
    setLoginPassword("");
    setLoginError(null);
    setFieldErrors({});
  };

  // Reset isian field form Pendaftaran
  const handleResetRegisterForm = () => {
    setRegFullName("");
    setRegNim("");
    setRegEmail("");
    setRegPassword("");
    setFieldErrors({});
  };

  // Demo Login Handler
  const handleDemoLogin = async () => {
    setIsSubmitting(true);
    setLoginError(null);
    try {
      const res = await loginStudent("12220101@bsi.ac.id", "password123");
      if (res.success && res.user) {
        setTransitionType("login");
        setTransitioningUser(res.user);
      } else {
        setLoginError(res.error || "Gagal masuk demo");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Login Submit dengan Zero-Trust Validation & Pemeriksaan Perangkat
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Verifikasi Kelayakan Perangkat (Laptop atau Tablet min. 8.7 Inci)
    const deviceCheck = checkDeviceSupport();
    if (!deviceCheck.isSupported) {
      setLoginError(
        deviceCheck.rejectionReason ||
          "Akses ditolak: TugasKu hanya dapat digunakan melalui Laptop atau Tablet minimal 8.7 inci."
      );
      return;
    }

    const errors: Record<string, string> = {};

    const emailCheck = validateStudentEmail(loginEmail);
    if (!emailCheck.isValid) {
      errors.loginEmail = emailCheck.error || "Email student tidak valid";
    }

    if (!loginPassword || !loginPassword.trim()) {
      errors.loginPassword = "Password wajib diisi";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setLoginError(null);
    try {
      const res = await loginStudent(emailCheck.cleanEmail, loginPassword);
      if (!res.success || !res.user) {
        setLoginError(res.error || "Login gagal. Silakan periksa kembali email & password Anda.");
        return;
      }
      setTransitionType("login");
      setTransitioningUser(res.user);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Register Request (Step 1) dengan Zero-Trust Validation Ketat
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Verifikasi Kelayakan Perangkat (Laptop atau Tablet min. 8.7 Inci)
    const deviceCheck = checkDeviceSupport();
    if (!deviceCheck.isSupported) {
      setFieldErrors({
        general:
          deviceCheck.rejectionReason ||
          "Akses ditolak: Pendaftaran hanya diizinkan melalui Laptop atau Tablet minimal 8.7 inci.",
      });
      return;
    }

    const errors: Record<string, string> = {};

    const nameCheck = validateFullName(regFullName);
    if (!nameCheck.isValid) {
      errors.regFullName = nameCheck.error || "Nama lengkap tidak valid";
    }

    const nimCheck = validateNim(regNim);
    if (!nimCheck.isValid) {
      errors.regNim = nimCheck.error || "NIM mahasiswa tidak valid";
    }

    const emailCheck = validateStudentEmail(regEmail);
    if (!emailCheck.isValid) {
      errors.regEmail = emailCheck.error || "Email student tidak valid";
    }

    const passCheck = validatePassword(regPassword);
    if (!passCheck.isValid) {
      errors.regPassword = passCheck.error || "Password minimal 8 karakter dengan kombinasi huruf dan angka";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});
    try {
      const res = await requestStudentRegistration({
        fullName: nameCheck.cleanName,
        nim: nimCheck.cleanNim,
        email: emailCheck.cleanEmail,
        password: passCheck.cleanPassword!,
      });

      if (!res.success) {
        setFieldErrors({ general: res.error || "Gagal memproses pendaftaran akun" });
        return;
      }

      if (res.user) {
        setTransitionType("register");
        setTransitioningUser(res.user);
        return;
      }

      setSupabaseNotice("Kode autentikasi 6 digit telah dikirimkan secara privat ke inbox email student Anda.");
      setIsVerifying(true);
      setVerifyError(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Verify Code Submit (Step 2) dengan Validasi OTP Ketat
  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const codeCheck = validateOtpCode(verificationCode);
    if (!codeCheck.isValid) {
      setVerifyError(codeCheck.error || "Masukkan 6 digit kode numerik yang dikirimkan ke email Anda");
      return;
    }

    const emailCheck = validateStudentEmail(regEmail);
    if (!emailCheck.isValid) {
      setVerifyError("Sesi email tidak valid. Silakan kembali dan daftar ulang.");
      return;
    }

    setIsSubmitting(true);
    setVerifyError(null);
    try {
      const res = await verifyStudentRegistration(emailCheck.cleanEmail, codeCheck.cleanCode);
      if (!res.success || !res.user) {
        setVerifyError(res.error || "Kode verifikasi salah atau telah kedaluwarsa. Periksa kembali email Anda.");
        return;
      }

      setTransitionType("register");
      setTransitioningUser(res.user);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resend verification code secara privat
  const handleResendCode = async () => {
    setIsSubmitting(true);
    try {
      const nameCheck = validateFullName(regFullName);
      const nimCheck = validateNim(regNim);
      const emailCheck = validateStudentEmail(regEmail);
      const passCheck = validatePassword(regPassword);

      const res = await requestStudentRegistration({
        fullName: nameCheck.isValid ? nameCheck.cleanName : regFullName,
        nim: nimCheck.isValid ? nimCheck.cleanNim : regNim,
        email: emailCheck.isValid ? emailCheck.cleanEmail : regEmail,
        password: passCheck.isValid ? passCheck.cleanPassword! : regPassword,
      });
      if (res.success) {
        setVerifyError(null);
        setSupabaseNotice("Kode baru telah dikirimkan ulang ke email Anda.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delay Animasi Loading Transisi Sebelum Masuk Dashboard
  if (transitioningUser) {
    return (
      <DashboardLoadingTransition
        user={transitioningUser}
        type={transitionType}
        onComplete={() => {
          onSuccess(transitioningUser);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#F4F5FB] flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Top Simple Header */}
      <header className="w-full px-6 md:px-12 py-5 flex items-center justify-between border-b border-[#E2E8F5]/70 bg-white/70 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xl font-black tracking-tight text-[#1E1B4B]">TugasKu</span>
          </div>
        </div>
      </header>

      {/* Main Full-Page Content - Centered Login Form Only */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 md:py-12">
        <div className="w-full max-w-md mx-auto">
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-[#E2E8F5] relative">
              
              {/* STEP VERIFIKASI KODE KETIKA MENDAFTAR */}
              {isVerifying ? (
                <div className="space-y-4 animate-fade-in">
                  <div className="text-center space-y-1">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-bold">
                      <KeyRound className="w-3.5 h-3.5" />
                      Verifikasi Email Student
                    </span>
                    <h3 className="text-xl font-bold text-[#1E1B4B] mt-2">Masukkan Kode Verifikasi</h3>
                    <p className="text-xs text-gray-500">
                      Kode 6 digit telah dikirimkan ke email student Anda:
                    </p>
                    <p className="text-xs font-bold text-indigo-600">{regEmail}</p>
                  </div>

                  {supabaseNotice && (
                    <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{supabaseNotice}</span>
                    </div>
                  )}


                  {/* Privasi & Keamanan: Kode OTP dikirimkan murni ke inbox email, tidak pernah bocor di layar */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200/70 space-y-1.5">
                    <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs">
                      <Lock className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>Privasi &amp; Keamanan Terjamin</span>
                    </div>
                    <p className="text-[11px] text-gray-600 leading-relaxed">
                      Kode verifikasi 6 digit telah dikirimkan secara privat ke kotak masuk email student Anda. Kode bersifat rahasia dan tidak ditampilkan di layar demi mencegah akses pihak ketiga.
                    </p>
                  </div>

                  {verifyError && (
                    <div className="p-3 rounded-2xl bg-pink-50 border border-pink-200 text-xs font-semibold text-pink-700 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{verifyError}</span>
                    </div>
                  )}

                  <form onSubmit={handleVerifySubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5 text-center">
                        Kode Verifikasi (6 Digit)
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        value={verificationCode}
                        onChange={(e) => {
                          setVerificationCode(e.target.value.replace(/[^0-9]/g, ""));
                          setVerifyError(null);
                        }}
                        placeholder="Contoh: 123456"
                        className="w-full text-center text-2xl font-bold tracking-widest py-3 bg-[#F8F9FE] border-2 border-indigo-200 rounded-2xl focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-300 font-mono"
                        autoFocus
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3 clay-button-primary text-xs font-bold shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Memverifikasi Akun...</span>
                        </>
                      ) : (
                        <>
                          <span>Verifikasi & Masuk Sekarang</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>

                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        onClick={() => setIsVerifying(false)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Kembali</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleResendCode}
                        className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Kirim Ulang Kode</span>
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <>
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-black text-[#1E1B4B]">
                      {tab === "login" ? "Masuk ke TugasKu" : "Daftar Akun Mahasiswa"}
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                      {tab === "login"
                        ? "Masukkan email student BSI dan password Anda"
                        : "Gunakan email student resmi nim@bsi.ac.id"}
                    </p>
                  </div>

                  {/* Toggle Tab Masuk / Daftar */}
                  <div className="grid grid-cols-2 p-1.5 bg-[#F1F3F9] rounded-2xl mb-6">
                    <button
                      type="button"
                      onClick={() => {
                        setTab("login");
                        setFieldErrors({});
                        setLoginError(null);
                        if (typeof window !== "undefined") {
                          window.history.pushState(null, "", "/login");
                        }
                      }}
                      className={`py-2.5 text-xs font-bold rounded-xl transition-all ${
                        tab === "login"
                          ? "bg-white text-indigo-700 shadow-sm"
                          : "text-gray-500 hover:text-gray-800"
                      }`}
                    >
                      Masuk Mahasiswa
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTab("register");
                        setFieldErrors({});
                        setLoginError(null);
                        if (typeof window !== "undefined") {
                          window.history.pushState(null, "", "/register");
                        }
                      }}
                      className={`py-2.5 text-xs font-bold rounded-xl transition-all ${
                        tab === "register"
                          ? "bg-white text-indigo-700 shadow-sm"
                          : "text-gray-500 hover:text-gray-800"
                      }`}
                    >
                      Daftar Akun Baru
                    </button>
                  </div>

                  {/* TAB 1: FORM LOGIN */}
                  {tab === "login" && (
                    <form onSubmit={handleLoginSubmit} className="space-y-4">
                      {loginError && (
                        <div className="p-3 rounded-2xl bg-pink-50 border border-pink-200 text-xs font-semibold text-pink-700 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{loginError}</span>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">
                          Email Student BSI
                        </label>
                        <div className="relative">
                          <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="email"
                            value={loginEmail}
                            onChange={(e) => {
                              setLoginEmail(e.target.value);
                              clearFieldError("loginEmail");
                            }}
                            placeholder="nim@bsi.ac.id"
                            className={`w-full pl-10 pr-4 py-2.5 rounded-2xl text-sm transition-all focus:outline-none ${
                              fieldErrors.loginEmail
                                ? "bg-pink-50/30 border-2 border-pink-500 focus:ring-2 focus:ring-pink-300"
                                : "bg-[#F8F9FE] border border-[#E2E8F5] focus:ring-2 focus:ring-indigo-400"
                            }`}
                          />
                        </div>
                        {fieldErrors.loginEmail && (
                          <p className="text-[11px] font-semibold text-pink-600 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            {fieldErrors.loginEmail}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">
                          Password
                        </label>
                        <div className="relative">
                          <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type={showLoginPassword ? "text" : "password"}
                            value={loginPassword}
                            onChange={(e) => {
                              setLoginPassword(e.target.value);
                              clearFieldError("loginPassword");
                            }}
                            placeholder="Masukkan password Anda"
                            className={`w-full pl-10 pr-10 py-2.5 rounded-2xl text-sm transition-all focus:outline-none ${
                              fieldErrors.loginPassword
                                ? "bg-pink-50/30 border-2 border-pink-500 focus:ring-2 focus:ring-pink-300"
                                : "bg-[#F8F9FE] border border-[#E2E8F5] focus:ring-2 focus:ring-indigo-400"
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowLoginPassword(!showLoginPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {fieldErrors.loginPassword && (
                          <p className="text-[11px] font-semibold text-pink-600 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            {fieldErrors.loginPassword}
                          </p>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3 clay-button-primary text-xs font-bold shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Memproses Masuk...</span>
                          </>
                        ) : (
                          <>
                            <span>Masuk ke TugasKu</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>

                      {/* Quick Demo Login */}
                      <div className="pt-2 text-center space-y-2">  
                        <button
                          type="button"
                          onClick={handleResetLoginForm}
                          className="text-xs font-semibold text-gray-400 hover:text-indigo-600 transition-colors inline-flex items-center gap-1.5 py-1"
                          title="Kosongkan semua isian form login"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset Isian Form</span>
                        </button>
                      </div>
                    </form>
                  )}

                  {/* TAB 2: FORM PENDAFTARAN (DENGAN VERIFIKASI KODE) */}
                  {tab === "register" && (
                    <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                      {fieldErrors.general && (
                        <div className="p-3 rounded-2xl bg-pink-50 border border-pink-200 text-xs font-semibold text-pink-700 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{fieldErrors.general}</span>
                        </div>
                      )}

                      {/* Nama Lengkap */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Nama Lengkap
                        </label>
                        <div className="relative">
                          <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={regFullName}
                            onChange={(e) => {
                              setRegFullName(e.target.value);
                              clearFieldError("regFullName");
                            }}
                            placeholder="Contoh: Budi Santoso"
                            className={`w-full pl-10 pr-4 py-2.5 rounded-2xl text-sm transition-all focus:outline-none ${
                              fieldErrors.regFullName
                                ? "bg-pink-50/30 border-2 border-pink-500 focus:ring-2 focus:ring-pink-300"
                                : "bg-[#F8F9FE] border border-[#E2E8F5] focus:ring-2 focus:ring-indigo-400"
                            }`}
                          />
                        </div>
                        {fieldErrors.regFullName && (
                          <p className="text-[11px] font-semibold text-pink-600 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            {fieldErrors.regFullName}
                          </p>
                        )}
                      </div>

                      {/* NIM & Email Student */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">
                            NIM Mahasiswa
                          </label>
                          <input
                            type="text"
                            value={regNim}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRegNim(val);
                              clearFieldError("regNim");
                              if (val.trim()) {
                                setRegEmail(`${val.trim()}@bsi.ac.id`);
                                clearFieldError("regEmail");
                              } else {
                                setRegEmail("");
                              }
                            }}
                            placeholder="12220888"
                            className={`w-full px-3.5 py-2.5 rounded-2xl text-sm transition-all focus:outline-none ${
                              fieldErrors.regNim
                                ? "bg-pink-50/30 border-2 border-pink-500 focus:ring-2 focus:ring-pink-300"
                                : "bg-[#F8F9FE] border border-[#E2E8F5] focus:ring-2 focus:ring-indigo-400"
                            }`}
                          />
                          {fieldErrors.regNim && (
                            <p className="text-[11px] font-semibold text-pink-600 mt-1 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              {fieldErrors.regNim}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">
                            Email Student
                          </label>
                          <input
                            type="email"
                            value={regEmail}
                            readOnly
                            placeholder="nim@bsi.ac.id"
                            title="Email student terisi otomatis sesuai NIM"
                            className={`w-full px-3.5 py-2.5 rounded-2xl text-sm transition-all focus:outline-none cursor-not-allowed select-none ${
                              fieldErrors.regEmail
                                ? "bg-pink-50/50 border-2 border-pink-500 text-pink-700"
                                : "bg-slate-100 border border-slate-200 text-slate-600"
                            }`}
                          />
                          {fieldErrors.regEmail && (
                            <p className="text-[11px] font-semibold text-pink-600 mt-1 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              {fieldErrors.regEmail}
                            </p>
                          )}
                        </div>
                      </div>



                      {/* Password */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Buat Password
                        </label>
                        <div className="relative">
                          <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type={showRegPassword ? "text" : "password"}
                            value={regPassword}
                            onChange={(e) => {
                              setRegPassword(e.target.value);
                              clearFieldError("regPassword");
                            }}
                            placeholder="Minimal 6 karakter"
                            className={`w-full pl-10 pr-10 py-2.5 rounded-2xl text-sm transition-all focus:outline-none ${
                              fieldErrors.regPassword
                                ? "bg-pink-50/30 border-2 border-pink-500 focus:ring-2 focus:ring-pink-300"
                                : "bg-[#F8F9FE] border border-[#E2E8F5] focus:ring-2 focus:ring-indigo-400"
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegPassword(!showRegPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {fieldErrors.regPassword && (
                          <p className="text-[11px] font-semibold text-pink-600 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            {fieldErrors.regPassword}
                          </p>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3 clay-button-primary text-xs font-bold shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Mendaftarkan Mahasiswa...</span>
                          </>
                        ) : (
                          <>
                            <span>Daftar & Minta Kode Verifikasi</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>

                      <div className="pt-2 text-center border-t border-gray-100 mt-3">
                        <button
                          type="button"
                          onClick={handleResetRegisterForm}
                          className="text-xs font-semibold text-gray-400 hover:text-indigo-600 transition-colors inline-flex items-center gap-1.5 py-1"
                          title="Kosongkan semua isian form pendaftaran"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset Isian Form</span>
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-5 text-center text-xs text-gray-400 border-t border-[#E2E8F5]/60 bg-white/40">
        <p>© 2026 TugasKu • Universitas Bina Sarana Informatika. Hak Cipta Dilindungi.</p>
      </footer>
    </div>
  );
}
