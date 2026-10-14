"use client";

import React from "react";
import { Menu, Search, X } from "lucide-react";
import { UserProfile, TaskInvitation } from "@/types";
import { NotificationDropdown, DeadlineTaskAlert } from "./NotificationDropdown";

interface TopNavbarProps {
  user: UserProfile;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onOpenProfile?: () => void;
  invitations?: TaskInvitation[];
  deadlineAlerts?: DeadlineTaskAlert[];
  onAcceptInvitation?: (invId: string) => Promise<void>;
  onDeclineInvitation?: (invId: string) => Promise<void>;
  onSelectTask?: (taskId: string) => void;
}

export function TopNavbar({
  user,
  searchQuery,
  onSearchChange,
  isSidebarOpen = true,
  onToggleSidebar,
  onOpenProfile,
  invitations = [],
  deadlineAlerts = [],
  onAcceptInvitation = async () => {},
  onDeclineInvitation = async () => {},
  onSelectTask = () => {},
}: TopNavbarProps) {
  return (
    <header className="h-20 px-6 md:px-8 flex items-center justify-between gap-4 border-b border-[#E2E8F5]/60 bg-white/80 backdrop-blur-md sticky top-0 z-40 transition-colors duration-200">
      {/* Left: Hamburger Icon + Search Input */}
      <div className="flex items-center gap-3 flex-1 max-w-lg">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="w-10 h-10 rounded-2xl bg-white border border-[#E2E8F5] text-gray-600 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm flex items-center justify-center shrink-0 cursor-pointer"
            title={isSidebarOpen ? "Kecilkan Menu (Hanya Ikon)" : "Perluas Menu"}
            aria-label="Toggle Sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari tugas, deadline, atau mata kuliah..."
            className="w-full pl-11 pr-10 py-2.5 bg-white/90 border border-[#E2E8F5] rounded-2xl text-sm placeholder:text-gray-400 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 shadow-sm transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="w-6 h-6 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 absolute right-3 top-1/2 -translate-y-1/2 transition-colors cursor-pointer"
              title="Bersihkan pencarian"
              aria-label="Bersihkan pencarian"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Right: Notifications & User Profile */}
      <div className="flex items-center gap-3">
        {/* Notifikasi Undangan Kolaborasi & Deadline Tugas H-1 */}
        <NotificationDropdown
          currentUser={user}
          invitations={invitations}
          deadlineAlerts={deadlineAlerts}
          onAcceptInvitation={onAcceptInvitation}
          onDeclineInvitation={onDeclineInvitation}
          onSelectTask={onSelectTask}
        />

        {/* User Profile (Click to View & Edit Profile) */}
        <button
          type="button"
          onClick={onOpenProfile}
          className="flex items-center gap-3 p-1.5 -mr-1.5 rounded-2xl hover:bg-white/90 border border-transparent hover:border-[#E2E8F5] transition-all cursor-pointer group text-left shadow-xs hover:shadow-sm"
          title="Klik untuk Lihat & Edit Profil Mahasiswa"
        >
          <img
            src={user.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"}
            alt={user.fullName}
            className="w-10 h-10 rounded-2xl object-cover ring-2 ring-indigo-100 group-hover:ring-indigo-300 shadow-sm transition-all"
          />
          <div className="hidden md:block text-left">
            <p className="text-xs font-bold text-[#1E1B4B] group-hover:text-indigo-600 transition-colors leading-tight">
              {user.fullName}
            </p>
            <p className="text-[11px] text-gray-400 group-hover:text-gray-600 font-medium leading-tight">
              {user.nim ? `${user.nim} • BSI` : "Mahasiswa Aktif"}
            </p>
          </div>
        </button>
      </div>
    </header>
  );
}
