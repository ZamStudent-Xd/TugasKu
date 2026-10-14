"use client";

import React, { useState } from "react";
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
  ArrowLeft
} from "lucide-react";
import { UserProfile } from "@/types";
import { 
  loginStudent, 
  requestStudentRegistration, 
  verifyStudentRegistration 
} from "@/lib/storage";
import {
  validateStudentEmail,
  validateNim,
  validateFullName,
  validatePassword,
  validateOtpCode,
} from "@/lib/securityValidation";
import { checkDeviceSupport } from "@/lib/deviceDetection";
import { DashboardLoadingTransition } from "@/components/DashboardLoadingTransition";

interface AuthModalProps {
  isOpen: boolean;
  onSuccess: (user: UserProfile) => void;
}

export function AuthModal({ isOpen, onSuccess }: AuthModalProps) {
  const [tab, setTab] = useState<"login" | "register">("login");
  
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

  // Verification Step State
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Form Field Errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Loading Transition State (Delay Animasi Sebelum Masuk Dashboard)
  const [transitioningUser, setTransitioningUser] = useState<UserProfile | null>(null);
  const [transitionType, setTransitionType] = useState<"login" | "register">("login");

  if (!isOpen) return null;

  // Jika sedang masa transisi loading delay animasi masuk dashboard
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

  // Demo Login Handler
  const handleDemoLogin = async () => {
    const res = await loginStudent("12220101@bsi.ac.id", "password123");
    if (res.success && res.user) {
      setTransitionType("login");
      setTransitioningUser(res.user);
    }
  };

  // Handle Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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

    const res = await loginStudent(emailCheck.cleanEmail, loginPassword);
    if (!res.success || !res.user) {
      setLoginError(res.error || "Login gagal");
      return;
    }

    setTransitionType("login");
    setTransitioningUser(res.user);
  };

  // Handle Register Request (Step 1)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
    if (!nameCheck.isValid) errors.regFullName = nameCheck.error || "Nama lengkap tidak valid";

    const nimCheck = validateNim(regNim);
    if (!nimCheck.isValid) errors.regNim = nimCheck.error || "NIM mahasiswa tidak valid";

    const emailCheck = validateStudentEmail(regEmail);
    if (!emailCheck.isValid) errors.regEmail = emailCheck.error || "Email student tidak valid";

    const passCheck = validatePassword(regPassword);
    if (!passCheck.isValid) errors.regPassword = passCheck.error || "Password minimal 8 karakter";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const res = await requestStudentRegistration({
      fullName: nameCheck.cleanName,
      nim: nimCheck.cleanNim,
      email: emailCheck.cleanEmail,
      password: passCheck.cleanPassword || regPassword,
    });

    if (!res.success) {
      setFieldErrors({ general: res.error || "Gagal memproses pendaftaran" });
      return;
    }

    if (res.user) {
      setTransitionType("register");
      setTransitioningUser(res.user);
      return;
    }

    // Pindah ke step verifikasi kode
    setIsVerifying(true);
    setVerifyError(null);
  };

  // Handle Verify Code Submit (Step 2)
  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const codeCheck = validateOtpCode(verificationCode);
    if (!codeCheck.isValid) {
      setVerifyError(codeCheck.error || "Masukkan 6 digit kode verifikasi");
      return;
    }

    const emailCheck = validateStudentEmail(regEmail);
    if (!emailCheck.isValid) {
      setVerifyError(emailCheck.error || "Email student tidak valid");
      return;
    }

    const res = await verifyStudentRegistration(emailCheck.cleanEmail, codeCheck.cleanCode);
    if (!res.success || !res.user) {
      setVerifyError(res.error || "Kode verifikasi tidak sesuai atau telah kedaluwarsa");
      return;
    }

    setTransitionType("register");
    setTransitioningUser(res.user);
  };

  // Resend verification code
  const handleResendCode = async () => {
    const res = await requestStudentRegistration({
      fullName: regFullName,
      nim: regNim,
      email: regEmail,
      password: regPassword,
    });
    if (res.success) {
      setVerifyError(null);
    } else {
      setVerifyError(res.error || "Gagal mengirim ulang kode OTP");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 md:p-8 shadow-2xl border border-gray-100 relative">
        {/* Logo and Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 mx-auto mb-3">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-[#1E1B4B] tracking-tight">TugasKu</h2>
          <p className="text-xs text-indigo-600 font-bold uppercase tracking-wider mt-0.5">
            Portal Tugas Mahasiswa BSI
          </p>
        </div>

        {/* STEP VERIFIKASI KODE KETIKA MENDAFTAR */}
        {isVerifying ? (
          <div className="space-y-4 animate-fade-in">
            <div className="text-center space-y-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-bold">
                <KeyRound className="w-3.5 h-3.5" />
                Verifikasi Email Student
              </span>
              <h3 className="text-lg font-bold text-[#1E1B4B] mt-2">Masukkan Kode Verifikasi</h3>
              <p className="text-xs text-gray-500">
                Kode 6 digit telah dikirimkan ke email student Anda:
              </p>
              <p className="text-xs font-bold text-indigo-600">{regEmail}</p>
            </div>

            {/* Privasi Keamanan Kode: Rahasia hanya ke email pengguna */}
            <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div className="text-[11px] text-gray-600 leading-relaxed">
                <span className="font-bold text-[#1E1B4B]">Privasi Terjamin: </span>
                Kode autentikasi 6-digit dikirimkan secara rahasia langsung ke email Anda demi keamanan akun.
              </div>
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
                  className="w-full text-center text-xl font-bold tracking-widest py-3 bg-[#F8F9FE] border-2 border-indigo-200 rounded-2xl focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-300 font-mono"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 clay-button-primary text-xs font-bold shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
              >
                <span>Verifikasi & Masuk Sekarang</span>
                <ArrowRight className="w-4 h-4" />
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
            {/* Toggle Tab Masuk / Daftar */}
            <div className="grid grid-cols-2 p-1 bg-[#F1F3F9] rounded-2xl mb-6">
              <button
                type="button"
                onClick={() => {
                  setTab("login");
                  setFieldErrors({});
                  setLoginError(null);
                }}
                className={`py-2 text-xs font-bold rounded-xl transition-all ${
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
                }}
                className={`py-2 text-xs font-bold rounded-xl transition-all ${
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
                  className="w-full py-3 clay-button-primary text-xs font-bold shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 mt-2"
                >
                  <span>Masuk ke TugasKu</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
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
                      Email Student (@bsi.ac.id)
                    </label>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => {
                        setRegEmail(e.target.value);
                        clearFieldError("regEmail");
                      }}
                      placeholder="nim@bsi.ac.id"
                      className={`w-full px-3.5 py-2.5 rounded-2xl text-sm transition-all focus:outline-none ${
                        fieldErrors.regEmail
                          ? "bg-pink-50/30 border-2 border-pink-500 focus:ring-2 focus:ring-pink-300"
                          : "bg-[#F8F9FE] border border-[#E2E8F5] focus:ring-2 focus:ring-indigo-400"
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
                  className="w-full py-3 clay-button-primary text-xs font-bold shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 mt-2"
                >
                  <span>Daftar & Minta Kode Verifikasi</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
