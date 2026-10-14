"use client";

import React, { useState } from "react";
import { X, BookOpen, AlertCircle } from "lucide-react";
import { Course } from "@/types";
import { validateCourseInput } from "@/lib/businessRules";

interface CreateCourseModalProps {
  isOpen: boolean;
  existingCourses?: Course[];
  onClose: () => void;
  onSubmit: (course: Omit<Course, "id">) => void;
}

export function CreateCourseModal({
  isOpen,
  existingCourses,
  onClose,
  onSubmit,
}: CreateCourseModalProps) {
  const [name, setName] = useState("");
  const [lecturer, setLecturer] = useState("");
  const [code, setCode] = useState("");
  const [color, setColor] = useState("indigo");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setLecturer("");
    setCode("");
    setColor("indigo");
    setFieldErrors({});
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  React.useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const colorOptions = [
    { id: "indigo", label: "Indigo", bg: "bg-indigo-500" },
    { id: "violet", label: "Violet", bg: "bg-purple-500" },
    { id: "blue", label: "Sky Blue", bg: "bg-sky-500" },
    { id: "pink", label: "Rose Pink", bg: "bg-pink-500" },
    { id: "emerald", label: "Emerald", bg: "bg-emerald-500" },
  ];

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

    // Semua field pada form wajib diisi
    if (!name.trim()) {
      errors.name = "Nama mata kuliah wajib diisi";
    }
    if (!code.trim()) {
      errors.code = "Kode mata kuliah wajib diisi";
    }
    if (!lecturer.trim()) {
      errors.lecturer = "Dosen pengampu wajib diisi";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const validation = validateCourseInput(name, existingCourses);
    if (!validation.valid) {
      setFieldErrors((prev) => ({ ...prev, name: validation.error || "Input tidak valid" }));
      setError(validation.error || "Input tidak valid");
      return;
    }

    onSubmit({
      name: name.trim(),
      lecturer: lecturer.trim(),
      code: code.trim(),
      color,
    });

    setName("");
    setLecturer("");
    setCode("");
    setColor("indigo");
    setFieldErrors({});
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 md:p-8 shadow-2xl border border-gray-100 relative">
        <button
          onClick={handleClose}
          className="absolute right-5 top-5 w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-6">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-2">
            <BookOpen className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-[#1E1B4B]">Tambah Mata Kuliah</h2>
          <p className="text-xs text-gray-500 mt-1">
            Buat mata kuliah baru untuk mengelompokkan tugas-tugas perkuliahan.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-pink-50 border border-pink-200 text-xs font-semibold text-pink-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Nama Mata Kuliah
            </label>
            <input
              type="text"
              maxLength={100}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                clearFieldError("name");
              }}
              placeholder="Contoh: Pemrograman Web Lanjut"
              className={`w-full px-4 py-2.5 rounded-2xl text-sm transition-all focus:outline-none ${
                fieldErrors.name
                  ? "bg-pink-50/30 border-2 border-pink-500 focus:ring-2 focus:ring-pink-300"
                  : "bg-[#F8F9FE] border border-[#E2E8F5] focus:ring-2 focus:ring-indigo-400"
              }`}
            />
            {fieldErrors.name && (
              <p className="text-[11px] font-semibold text-pink-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {fieldErrors.name}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Kode MK
              </label>
              <input
                type="text"
                maxLength={30}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  clearFieldError("code");
                }}
                placeholder="IF101"
                className={`w-full px-4 py-2.5 rounded-2xl text-sm transition-all focus:outline-none ${
                  fieldErrors.code
                    ? "bg-pink-50/30 border-2 border-pink-500 focus:ring-2 focus:ring-pink-300"
                    : "bg-[#F8F9FE] border border-[#E2E8F5] focus:ring-2 focus:ring-indigo-400"
                }`}
              />
              {fieldErrors.code && (
                <p className="text-[11px] font-semibold text-pink-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {fieldErrors.code}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Dosen Pengampu
              </label>
              <input
                type="text"
                maxLength={100}
                value={lecturer}
                onChange={(e) => {
                  setLecturer(e.target.value);
                  clearFieldError("lecturer");
                }}
                placeholder="Dr. Andi, M.Kom"
                className={`w-full px-4 py-2.5 rounded-2xl text-sm transition-all focus:outline-none ${
                  fieldErrors.lecturer
                    ? "bg-pink-50/30 border-2 border-pink-500 focus:ring-2 focus:ring-pink-300"
                    : "bg-[#F8F9FE] border border-[#E2E8F5] focus:ring-2 focus:ring-indigo-400"
                }`}
              />
              {fieldErrors.lecturer && (
                <p className="text-[11px] font-semibold text-pink-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {fieldErrors.lecturer}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2">
              Warna Tema Kartu
            </label>
            <div className="flex items-center gap-3">
              {colorOptions.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.id)}
                  className={`w-7 h-7 rounded-full ${c.bg} transition-all ${
                    color === c.id ? "ring-4 ring-offset-2 ring-indigo-300 scale-110" : "opacity-70 hover:opacity-100"
                  }`}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 clay-button-primary text-xs font-bold shadow-md shadow-indigo-500/20"
            >
              Simpan Mata Kuliah
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
