"use client";

import React from "react";
import { 
  LayoutDashboard, 
  BookOpen, 
  Calendar, 
  CheckCircle2, 
  GraduationCap,
  X
} from "lucide-react";

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  activeTasksCount?: number;
  groupTasksCount?: number;
}

export function Sidebar({
  currentTab,
  onSelectTab,
  isOpen = true,
  onClose,
}: SidebarProps) {
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "courses", label: "Mata Kuliah", icon: BookOpen },
    { id: "completed", label: "Riwayat Selesai", icon: CheckCircle2 },
    { id: "calendar", label: "Jadwal Deadline", icon: Calendar },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay when Sidebar is open */}
      {isOpen && onClose && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-20 md:hidden animate-fade-in"
        />
      )}

      <aside
        className={`bg-white/90 backdrop-blur-md border-r border-[#E2E8F5]/70 flex flex-col justify-between shrink-0 z-30 transition-all duration-300 ease-in-out ${
          isOpen ? "w-64 p-6" : "w-20 px-3 py-6"
        }`}
      >
        <div className="w-full">
          {/* App Logo & Mobile Close Button */}
          <div className={`flex items-center mb-8 ${isOpen ? "justify-between px-2" : "justify-center"}`}>
            <div 
              onClick={() => onSelectTab("dashboard")}
              className="flex items-center gap-3 overflow-hidden cursor-pointer group"
              title="Kembali ke Dashboard"
            >
              <div
                className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 shrink-0 group-hover:scale-105 transition-transform"
              >
                <GraduationCap className="w-6 h-6" />
              </div>
              {isOpen && (
                <div className="transition-opacity duration-200 whitespace-nowrap overflow-hidden">
                  <h1 className="text-xl font-bold tracking-tight text-[#1E1B4B] group-hover:text-indigo-600 transition-colors">TugasKu</h1>
                  <p className="text-[11px] font-semibold tracking-wider text-indigo-500 uppercase">StudyTrack MVP</p>
                </div>
              )}
            </div>

            {isOpen && onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 md:hidden transition-colors"
                title="Tutup Menu"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  title={item.label}
                  className={`w-full flex items-center rounded-2xl text-sm font-semibold transition-all relative ${
                    isOpen
                      ? "px-3.5 py-3 justify-between"
                      : "px-0 py-3 justify-center"
                  } ${
                    isActive
                      ? "bg-indigo-50/80 text-indigo-600 shadow-sm font-bold"
                      : "text-gray-600 hover:bg-gray-100/70 hover:text-gray-900"
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-2.5 bottom-2.5 w-1.5 bg-gradient-to-b from-[#6366F1] to-[#8B5CF6] rounded-r-full" />
                  )}
                  <div className={`flex items-center gap-3 ${isOpen ? "" : "justify-center"}`}>
                    <Icon
                      className={`w-5 h-5 shrink-0 transition-transform ${
                        isActive ? "text-indigo-600 scale-105" : "text-gray-400"
                      }`}
                      strokeWidth={1.8}
                    />
                    {isOpen && (
                      <span className="whitespace-nowrap overflow-hidden text-left">{item.label}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}
