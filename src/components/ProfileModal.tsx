"use client";

import React, { useState, useEffect } from "react";
import { 
  X, 
  User, 
  Mail, 
  GraduationCap, 
  BookOpen, 
  Calendar, 
  LogOut, 
  Check, 
  AlertCircle,
  Sparkles,
  Camera
} from "lucide-react";
import { UserProfile } from "@/types";

// Helper untuk kompresi dan resize gambar agar aman, cepat, dan ringan
function compressImage(file: File, maxWidth = 240, maxHeight = 240, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

interface ProfileModalProps {
  isOpen: boolean;
  user: UserProfile;
  onClose: () => void;
  onUpdate: (updatedUser: UserProfile) => void;
  onLogout: () => void;
}

const PRESET_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=120&auto=format&fit=crop&q=80",
];

export function ProfileModal({
  isOpen,
  user,
  onClose,
  onUpdate,
  onLogout,
}: ProfileModalProps) {
  const [fullName, setFullName] = useState("");
  const [nim, setNim] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isConfirmLogout, setIsConfirmLogout] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (user && isOpen) {
      setFullName(user.fullName || "");
      setNim(user.nim || "");
      setEmail(user.email || "");
      setAvatarUrl(user.avatarUrl || PRESET_AVATARS[0]);
      setFieldErrors({});
      setError(null);
      setUploadError(null);
      setIsConfirmLogout(false);
    }
  }, [user, isOpen]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("File harus berupa gambar (JPG, PNG, WebP, dll)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Ukuran foto maksimal 5MB");
      return;
    }

    setUploadError(null);

    try {
      const compressedDataUrl = await compressImage(file, 240, 240, 0.8);
      setAvatarUrl(compressedDataUrl);
    } catch {
      setUploadError("Gagal memproses gambar. Silakan coba file lain.");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const isCustomAvatar = Boolean(avatarUrl && !PRESET_AVATARS.includes(avatarUrl));

  if (!isOpen) return null;

  const clearFieldError = (field: string) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (error) setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!fullName.trim()) {
      errors.fullName = "Nama lengkap wajib diisi";
    }
    if (!nim.trim()) {
      errors.nim = "NIM mahasiswa wajib diisi";
    }
    if (!email.trim()) {
      errors.email = "Email student wajib diisi";
    } else if (!email.trim().toLowerCase().endsWith("@bsi.ac.id")) {
      errors.email = "Email student harus berakhiran @bsi.ac.id";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    onUpdate({
      ...user,
      fullName: fullName.trim(),
      nim: nim.trim(),
      email: email.trim().toLowerCase(),
      avatarUrl: avatarUrl.trim() || PRESET_AVATARS[0],
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-gray-100 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
          title="Tutup"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header & Avatar Profile Card */}
        <div className="flex flex-col sm:flex-row items-center gap-5 p-5 bg-gradient-to-br from-indigo-50/70 to-purple-50/50 border border-indigo-100/60 rounded-2xl mb-6">
          <div className="relative group">
            <img
              src={avatarUrl || PRESET_AVATARS[0]}
              alt={fullName}
              className="w-20 h-20 rounded-2xl object-cover ring-4 ring-white shadow-md"
            />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow">
              <GraduationCap className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="text-center sm:text-left flex-1">
            <span className="inline-block text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-md mb-1">
              Universitas BSI • Mahasiswa Aktif
            </span>
            <h2 className="text-lg font-bold text-[#1E1B4B] leading-tight">{fullName || "Nama Mahasiswa"}</h2>
            <p className="text-xs text-indigo-600 font-semibold mt-0.5">{email || "nim@bsi.ac.id"}</p>
            <p className="text-[11px] text-gray-500 mt-1 font-medium">
              NIM: {nim || "-"} • Universitas BSI
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-pink-50 border border-pink-200 text-xs font-semibold text-pink-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Pilihan Preset & Unggah Foto Sendiri */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2">
              Pilih Foto Profil
            </label>

            {/* Input file tersembunyi */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />

            <div className="flex items-center gap-2.5 overflow-x-auto pb-1 pt-0.5">
              {/* Tombol Unggah Foto Kustom */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-11 h-11 rounded-xl border-2 border-dashed border-indigo-300 hover:border-indigo-600 bg-indigo-50/60 hover:bg-indigo-50 flex flex-col items-center justify-center text-indigo-600 transition-all shrink-0 group cursor-pointer"
                title="Pilih foto dari komputer atau perangkat Anda"
              >
                <Camera className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span className="text-[9px] font-bold mt-0.5">Unggah</span>
              </button>

              {/* Tampilkan Tile Foto Kustom yang Diunggah Jika Ada */}
              {isCustomAvatar && (
                <div
                  className="w-11 h-11 rounded-xl overflow-hidden border-2 border-indigo-600 ring-2 ring-indigo-300 scale-105 shrink-0 relative group"
                  title="Foto kustom pilihan Anda saat ini"
                >
                  <img src={avatarUrl} alt="Foto Kustom" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-indigo-900/30 flex items-center justify-center text-white">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                </div>
              )}

              {/* Pilihan Avatar Preset */}
              {PRESET_AVATARS.map((url, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setAvatarUrl(url);
                    setUploadError(null);
                  }}
                  className={`w-11 h-11 rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                    avatarUrl === url
                      ? "border-indigo-600 ring-2 ring-indigo-300 scale-105"
                      : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                  title={`Avatar bawaan ${idx + 1}`}
                >
                  <img src={url} alt={`Avatar ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>

            {uploadError && (
              <p className="text-[11px] font-semibold text-pink-600 mt-1.5 flex items-center gap-1 animate-fade-in">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{uploadError}</span>
              </p>
            )}
          </div>

          {/* Nama Lengkap */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Nama Lengkap
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                clearFieldError("fullName");
              }}
              placeholder="Contoh: Ahmad Zamzam"
              className={`w-full px-4 py-2.5 rounded-2xl text-sm transition-all focus:outline-none ${
                fieldErrors.fullName
                  ? "bg-pink-50/30 border-2 border-pink-500 focus:ring-2 focus:ring-pink-300"
                  : "bg-[#F8F9FE] border border-[#E2E8F5] focus:ring-2 focus:ring-indigo-400"
              }`}
            />
            {fieldErrors.fullName && (
              <p className="text-[11px] font-semibold text-pink-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {fieldErrors.fullName}
              </p>
            )}
          </div>

          {/* NIM & Email Student */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                NIM Mahasiswa
              </label>
              <input
                type="text"
                value={nim}
                onChange={(e) => {
                  const val = e.target.value;
                  setNim(val);
                  clearFieldError("nim");
                  // Otomatis sinkronkan email jika email berformat nim@bsi.ac.id
                  if (val.trim() && (!email || email.includes("@bsi.ac.id"))) {
                    setEmail(`${val.trim()}@bsi.ac.id`);
                    clearFieldError("email");
                  }
                }}
                placeholder="Contoh: 12220101"
                className={`w-full px-4 py-2.5 rounded-2xl text-sm transition-all focus:outline-none ${
                  fieldErrors.nim
                    ? "bg-pink-50/30 border-2 border-pink-500 focus:ring-2 focus:ring-pink-300"
                    : "bg-[#F8F9FE] border border-[#E2E8F5] focus:ring-2 focus:ring-indigo-400"
                }`}
              />
              {fieldErrors.nim && (
                <p className="text-[11px] font-semibold text-pink-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {fieldErrors.nim}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Email Student BSI
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearFieldError("email");
                }}
                placeholder="nim@bsi.ac.id"
                className={`w-full px-4 py-2.5 rounded-2xl text-sm transition-all focus:outline-none ${
                  fieldErrors.email
                    ? "bg-pink-50/30 border-2 border-pink-500 focus:ring-2 focus:ring-pink-300"
                    : "bg-[#F8F9FE] border border-[#E2E8F5] focus:ring-2 focus:ring-indigo-400"
                }`}
              />
              {fieldErrors.email && (
                <p className="text-[11px] font-semibold text-pink-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {fieldErrors.email}
                </p>
              )}
            </div>
          </div>



          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-5 border-t border-gray-100">
            {!isConfirmLogout ? (
              <button
                type="button"
                onClick={() => setIsConfirmLogout(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar Akun</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onLogout}
                  className="px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 transition-colors"
                >
                  Ya, Keluar
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmLogout(false)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Batal
                </button>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-all"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 clay-button-primary text-xs font-bold shadow-md shadow-indigo-500/20"
              >
                Simpan Profil
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
