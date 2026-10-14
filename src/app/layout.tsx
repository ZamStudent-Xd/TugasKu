import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "TugasKu (StudyTrack) - Manajemen Tugas & Progres Kuliah",
  description: "Aplikasi manajemen tugas kuliah, pelacakan progres 0-100%, dan kolaborasi tugas kelompok mahasiswa.",
};

export const instant = false;

import { DeviceGuard } from "@/components/DeviceGuard";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${plusJakartaSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#F4F5FB] text-[#4B5563]">
        <DeviceGuard>
          {children}
        </DeviceGuard>
      </body>
    </html>
  );
}
