"use client";

import React, { useState, useEffect } from "react";
import { X, Calendar, Users, User, Check, AlertCircle } from "lucide-react";
import { Course, Task, TaskType } from "@/types";
import { validateTaskInput } from "@/lib/businessRules";

interface EditTaskModalProps {
  isOpen: boolean;
  task: Task | null;
  courses: Course[];
  onClose: () => void;
  onSubmit: (id: string, updates: Partial<Task>) => void;
}

export function EditTaskModal({
  isOpen,
  task,
  courses,
  onClose,
  onSubmit,
}: EditTaskModalProps) {
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState("");
  const [description, setDescription] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("individual");
  const [progress, setProgress] = useState(0);
  const [deadline, setDeadline] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setCourseId(task.courseId);
      setDescription(task.description || "");
      setTaskType(task.taskType);
      setProgress(task.progress);
      setFieldErrors({});
      setError(null);

      if (task.deadline) {
        try {
          const d = new Date(task.deadline);
          const pad = (n: number) => String(n).padStart(2, "0");
          const localStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
          setDeadline(localStr);
        } catch {
          setDeadline("");
        }
      } else {
        setDeadline("");
      }
    }
  }, [task, isOpen]);

  if (!isOpen || !task) return null;

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

    // Semua form wajib diisi kecuali status awal
    if (!title.trim()) {
      errors.title = "Nama tugas wajib diisi";
    }
    if (!courseId) {
      errors.courseId = "Mata kuliah wajib dipilih";
    }
    if (!deadline) {
      errors.deadline = "Tenggat waktu / deadline wajib diisi";
    }
    if (!description.trim()) {
      errors.description = "Deskripsi tugas wajib diisi";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const validation = validateTaskInput(title, progress);
    if (!validation.valid) {
      setError(validation.error || "Input tidak valid");
      return;
    }

    const selectedCourse = courses.find((c) => c.id === courseId);
    onSubmit(task.id, {
      title: title.trim(),
      courseId,
      courseName: selectedCourse?.name || task.courseName,
      description: description.trim(),
      taskType,
      progress: progress === 100 ? 100 : 0,
      deadline: new Date(deadline).toISOString(),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-gray-100 relative">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-6">
          <h2 className="text-xl font-bold text-[#1E1B4B]">Edit Tugas</h2>
          <p className="text-xs text-gray-500 mt-1">Perbarui informasi tugas perkuliahan.</p>
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
              Nama Tugas
            </label>
            <input
              type="text"
              maxLength={150}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                clearFieldError("title");
              }}
              className={`w-full px-4 py-2.5 rounded-2xl text-sm transition-all focus:outline-none ${
                fieldErrors.title
                  ? "bg-pink-50/30 border-2 border-pink-500 focus:ring-2 focus:ring-pink-300"
                  : "bg-[#F8F9FE] border border-[#E2E8F5] focus:ring-2 focus:ring-indigo-400"
              }`}
            />
            {fieldErrors.title && (
              <p className="text-[11px] font-semibold text-pink-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {fieldErrors.title}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Mata Kuliah
              </label>
              <select
                value={courseId}
                onChange={(e) => {
                  setCourseId(e.target.value);
                  clearFieldError("courseId");
                }}
                className={`w-full px-4 py-2.5 rounded-2xl text-sm transition-all focus:outline-none ${
                  fieldErrors.courseId
                    ? "bg-pink-50/30 border-2 border-pink-500 focus:ring-2 focus:ring-pink-300"
                    : "bg-[#F8F9FE] border border-[#E2E8F5] focus:ring-2 focus:ring-indigo-400"
                }`}
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {fieldErrors.courseId && (
                <p className="text-[11px] font-semibold text-pink-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {fieldErrors.courseId}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Tipe Tugas
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTaskType("individual")}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                    taskType === "individual"
                      ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                      : "bg-[#F8F9FE] border-[#E2E8F5] text-gray-600"
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Individu</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTaskType("group")}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                    taskType === "group"
                      ? "bg-purple-50 border-purple-300 text-purple-700"
                      : "bg-[#F8F9FE] border-[#E2E8F5] text-gray-600"
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Kelompok</span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Tenggat Waktu / Deadline
              </label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => {
                  setDeadline(e.target.value);
                  clearFieldError("deadline");
                }}
                className={`w-full px-4 py-2 rounded-2xl text-sm transition-all focus:outline-none h-[42px] ${
                  fieldErrors.deadline
                    ? "bg-pink-50/30 border-2 border-pink-500 focus:ring-2 focus:ring-pink-300"
                    : "bg-[#F8F9FE] border border-[#E2E8F5] focus:ring-2 focus:ring-indigo-400"
                }`}
              />
              {fieldErrors.deadline && (
                <p className="text-[11px] font-semibold text-pink-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {fieldErrors.deadline}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Status Tugas
              </label>
              <button
                type="button"
                onClick={() => setProgress(progress === 100 ? 0 : 100)}
                className={`w-full py-2 px-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border transition-all h-[42px] ${
                  progress === 100
                    ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                    : "bg-[#F8F9FE] border-[#E2E8F5] text-gray-600"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center ${
                    progress === 100
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  {progress === 100 && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span>{progress === 100 ? "Sudah Selesai" : "Belum Selesai"}</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Deskripsi Tugas
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                clearFieldError("description");
              }}
              className={`w-full px-4 py-2.5 rounded-2xl text-sm transition-all focus:outline-none ${
                fieldErrors.description
                  ? "bg-pink-50/30 border-2 border-pink-500 focus:ring-2 focus:ring-pink-300"
                  : "bg-[#F8F9FE] border border-[#E2E8F5] focus:ring-2 focus:ring-indigo-400"
              }`}
            />
            {fieldErrors.description && (
              <p className="text-[11px] font-semibold text-pink-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {fieldErrors.description}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
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
              Simpan Perubahan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
