"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/storage";
import { AuthPage } from "@/components/AuthPage";
import { MainApp } from "@/components/MainApp";

export default function RootPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [hasUser, setHasUser] = useState<boolean | null>(null);

  useEffect(() => {
    setMounted(true);
    const user = getCurrentUser();
    if (user) {
      setHasUser(true);
      router.replace("/dashboard");
    } else {
      setHasUser(false);
      router.replace("/login");
    }
  }, [router]);

  if (!mounted || hasUser === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F4F5FB]">
        <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3" />
        <p className="text-xs font-bold text-gray-500 tracking-wide uppercase">Memuat TugasKu...</p>
      </div>
    );
  }

  if (hasUser) {
    return <MainApp initialTab="dashboard" />;
  }

  return (
    <AuthPage
      initialTab="login"
      onSuccess={() => {
        router.push("/dashboard");
      }}
    />
  );
}
