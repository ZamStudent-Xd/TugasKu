import { NextRequest, NextResponse } from "next/server";
import { saveRegisteredStudentToDb, searchRegisteredStudentsFromDb } from "@/lib/serverDb";
import { UserProfile } from "@/types";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes("your-project") || key.includes("your-anon-key")) {
    return null;
  }
  return createClient(url, key);
}

const isValidUuid = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") || searchParams.get("search") || "").trim();

    if (!query) {
      return NextResponse.json({ success: true, students: [] });
    }

    const studentsMap = new Map<string, UserProfile>();

    // 1. Ambil dari Supabase PostgreSQL Cloud
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .or(`full_name.ilike.%${query}%,nim.ilike.%${query}%,email.ilike.%${query}%`);

        if (!error && Array.isArray(data)) {
          for (const row of data) {
            const student: UserProfile = {
              id: row.id,
              fullName: row.full_name,
              email: row.email,
              nim: row.nim || "",
              major: row.major || "Teknologi Informasi",
              semester: row.semester || 1,
              campus: row.campus || "Universitas BSI (Bina Sarana Informatika)",
              avatarUrl: row.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${row.nim || row.id}`,
              createdAt: row.created_at,
            };
            studentsMap.set(student.email.toLowerCase().trim(), student);
          }
        }
      } catch (err) {
        console.warn("[API STUDENTS] Supabase profiles query error:", err);
      }
    }

    // 2. Ambil dari Server Database lokal (sebagai fallback/cadangan)
    try {
      const localStudents = searchRegisteredStudentsFromDb(query);
      for (const s of localStudents) {
        const key = s.email.toLowerCase().trim();
        if (!studentsMap.has(key)) {
          studentsMap.set(key, s);
        }
      }
    } catch {
      // ignore
    }

    return NextResponse.json({
      success: true,
      students: Array.from(studentsMap.values()),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal mencari data mahasiswa";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const user = (body.user || body.student) as UserProfile;
    const password = body.password as string | undefined;

    if (!user || !user.email) {
      return NextResponse.json({ success: false, error: "Data mahasiswa tidak lengkap" }, { status: 400 });
    }

    // 1. Simpan ke Supabase (Cloud Database)
    const supabase = getSupabase();
    if (supabase) {
      try {
        let authUserId = isValidUuid(user.id) ? user.id : null;

        // Jika ada password, daftarkan ke auth.users
        if (password) {
          const { data: authData } = await supabase.auth.signUp({
            email: user.email,
            password: password,
            options: {
              data: {
                full_name: user.fullName,
                nim: user.nim,
                major: user.major,
                semester: user.semester,
                campus: user.campus,
                avatar_url: user.avatarUrl,
              },
            },
          });

          if (authData?.user?.id) {
            authUserId = authData.user.id;
            user.id = authUserId;
          }
        }

        // Upsert ke public.profiles
        const profileId = authUserId || (isValidUuid(user.id) ? user.id : crypto.randomUUID());
        user.id = profileId;

        await supabase.from("profiles").upsert({
          id: profileId,
          full_name: user.fullName,
          email: user.email,
          nim: user.nim,
          major: user.major,
          semester: user.semester,
          campus: user.campus,
          avatar_url: user.avatarUrl,
        });
      } catch (err) {
        console.warn("[API STUDENTS] Supabase upsert note:", err);
      }
    }

    // 2. Simpan juga ke file lokal sebagai cadangan (jika filesystem mengizinkan)
    try {
      saveRegisteredStudentToDb(user, password || "");
    } catch {
      // ignore pada lingkungan read-only serverless seperti Vercel
    }

    return NextResponse.json({ success: true, user });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal menyimpan data mahasiswa";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
