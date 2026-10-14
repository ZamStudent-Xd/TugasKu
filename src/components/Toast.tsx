"use client";

import React, { useEffect } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  // Hanya tampilkan 1 alert terbaru (tidak menumpuk, langsung berganti)
  const latestToast = toasts.length > 0 ? toasts[toasts.length - 1] : null;
  if (!latestToast) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm pointer-events-none animate-fade-in">
      <ToastItem key={latestToast.id} toast={latestToast} onDismiss={onDismiss} />
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 3500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const config = {
    success: {
      bg: "bg-emerald-600 text-white",
      icon: CheckCircle2,
    },
    error: {
      bg: "bg-pink-600 text-white",
      icon: AlertCircle,
    },
    info: {
      bg: "bg-indigo-600 text-white",
      icon: Info,
    },
  }[toast.type];

  const Icon = config.icon;

  return (
    <div
      className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-2xl shadow-xl transition-all animate-bounce-in ${config.bg}`}
    >
      <div className="flex items-center gap-2.5">
        <Icon className="w-4 h-4 shrink-0" />
        <p className="text-xs font-bold leading-snug">{toast.message}</p>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-1 hover:bg-white/20 rounded-lg transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
