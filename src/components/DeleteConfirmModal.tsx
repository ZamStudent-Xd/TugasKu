"use client";

import React from "react";
import { AlertTriangle, X } from "lucide-react";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel = "Hapus Sekarang",
  onClose,
  onConfirm,
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 relative text-center">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-pink-50 border border-pink-100 text-pink-600 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <h3 className="text-base font-bold text-[#1E1B4B] mb-2">{title}</h3>
        <p className="text-xs text-gray-500 mb-6 leading-relaxed">{description}</p>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-all"
          >
            Batal
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 py-2.5 rounded-xl bg-pink-600 text-white text-xs font-bold hover:bg-pink-700 transition-all shadow-md shadow-pink-500/20"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
