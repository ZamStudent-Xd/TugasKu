"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthPage } from "@/components/AuthPage";
import { getCurrentUser } from "@/lib/storage";

export default function LoginPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const user = getCurrentUser();
    if (user) {
      router.replace("/dashboard");
    }
  }, [router]);

  if (!mounted) return null;

  return (
    <AuthPage
      initialTab="login"
      onSuccess={() => {
        router.push("/dashboard");
      }}
    />
  );
}
