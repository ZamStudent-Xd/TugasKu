import { NextRequest, NextResponse } from "next/server";
import { saveRegisteredStudentToDb, searchRegisteredStudentsFromDb, getAllStudentsFromDb } from "@/lib/serverDb";
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

    const studentsMap = new Map<string, UserProfile>();

    // 1. Ambil dari Supabase PostgreSQL Cloud
    const supabase = getSupabase();
    if (supabase) {
      const activeEmailsInProfiles = new Set<string>();

      // 1.1 Ambil akun sah dari tabel profiles Supabase (Single Source of Truth)
      try {
        let supaQuery = supabase.from("profiles").select("*");
        if (query) {
          supaQuery = supaQuery.or(`full_name.ilike.%${query}%,nim.ilike.%${query}%,email.ilike.%${query}%`);
        } else {
          supaQuery = supaQuery.limit(100);
        }
        const { data, error } = await supaQuery;

        if (!error && Array.isArray(data)) {
          for (const row of data) {
            const clean = row.email?.toLowerCase().trim();
            if (clean) {
              activeEmailsInProfiles.add(clean);
              studentsMap.set(clean, {
                id: row.id,
                fullName: row.full_name,
                email: row.email,
                nim: row.nim || "",
                major: row.major || "Teknologi Informasi",
                semester: row.semester || 1,
                campus: row.campus || "Universitas BSI (Bina Sarana Informatika)",
                avatarUrl: row.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${row.nim || row.id}`,
                createdAt: row.created_at,
              });
            }
          }
        }
      } catch (err) {
        console.warn("[API STUDENTS] Supabase profiles query error:", err);
      }

      // 1.2 Sinkronkan foto avatar realtime dari PROFILE_RECORD HANYA untuk akun yang masih ada di profiles
      // Jika akun sudah dihapus dari profiles, bersihkan PROFILE_RECORD yatim dari database!
      try {
        const { data: profileRecords } = await supabase
          .from("collaboration_invitations")
          .select("*")
          .eq("task_id", "PROFILE_RECORD");

        if (Array.isArray(profileRecords)) {
          for (const row of profileRecords) {
            const clean = row.invited_email?.toLowerCase().trim();
            if (clean) {
              if (activeEmailsInProfiles.has(clean)) {
                const existing = studentsMap.get(clean);
                if (existing) {
                  const updatedAvatar = row.inviter_avatar || (row.task_payload as any)?.avatarUrl;
                  if (updatedAvatar) existing.avatarUrl = updatedAvatar;
                }
              } else {
                // Akun sudah dihapus dari database! Hapus PROFILE_RECORD yatim ini
                await supabase.from("collaboration_invitations").delete().eq("id", row.id);
              }
            }
          }
        }
      } catch (err) {
        console.warn("[API STUDENTS] PROFILE_RECORD sync/clean error:", err);
      }
    } else {
      // 2. Ambil dari Server Database lokal HANYA jika Supabase tidak terkonfigurasi (offline mode)
      try {
        const localStudents = query ? searchRegisteredStudentsFromDb(query) : getAllStudentsFromDb();
        for (const s of localStudents) {
          const key = s.email.toLowerCase().trim();
          if (!studentsMap.has(key)) {
            studentsMap.set(key, s);
          }
        }
      } catch {
        // ignore
      }
    }

    let results = Array.from(studentsMap.values());
    if (query) {
      const q = query.toLowerCase();
      results = results.filter(
        (s) =>
          s.fullName.toLowerCase().includes(q) ||
          (s.nim && s.nim.toLowerCase().includes(q)) ||
          s.email.toLowerCase().includes(q)
      );
    }

    return NextResponse.json(
      {
        success: true,
        students: results,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
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

    const cleanEmail = user.email.toLowerCase().trim();

    // 1. Simpan ke Supabase (Cloud Database)
    const supabase = getSupabase();
    if (supabase) {
      try {
        let authUserId = isValidUuid(user.id) ? user.id : null;

        // Jika ada password, daftarkan ke auth.users
        if (password) {
          try {
            const { data: authData } = await supabase.auth.signUp({
              email: cleanEmail,
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
          } catch {
            // ignore
          }
        }

        // Cari ID profil yang sudah ada di tabel profiles Supabase berdasarkan email atau ID
        let targetProfileId: string | null = authUserId || (isValidUuid(user.id) ? user.id : null);
        if (!targetProfileId) {
          const { data: existingProf } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", cleanEmail)
            .maybeSingle();

          if (existingProf?.id) {
            targetProfileId = existingProf.id;
          }
        }

        if (targetProfileId) {
          user.id = targetProfileId;
          await supabase
            .from("profiles")
            .update({
              full_name: user.fullName,
              nim: user.nim,
              major: user.major,
              semester: user.semester,
              campus: user.campus,
              avatar_url: user.avatarUrl,
            })
            .eq("id", targetProfileId);
        } else {
          const newId = crypto.randomUUID();
          user.id = newId;
          await supabase.from("profiles").insert({
            id: newId,
            full_name: user.fullName,
            email: cleanEmail,
            nim: user.nim,
            major: user.major,
            semester: user.semester,
            campus: user.campus,
            avatar_url: user.avatarUrl,
          });
        }

        // Simpan PROFILE_RECORD di collaboration_invitations (bebas RLS & memicu Realtime ke semua browser)
        try {
          await supabase
            .from("collaboration_invitations")
            .upsert({
              id: `profile-record-${cleanEmail}`,
              task_id: "PROFILE_RECORD",
              task_title: user.fullName,
              course_name: null,
              invited_email: cleanEmail,
              token_hash: "profile",
              status: "active",
              expires_at: new Date(Date.now() + 365 * 86400000).toISOString(),
              invited_by: targetProfileId || user.id || cleanEmail,
              inviter_name: user.fullName,
              inviter_avatar: user.avatarUrl,
              task_payload: {
                ...user,
                avatarUrl: user.avatarUrl,
                updatedAt: new Date().toISOString(),
              },
            });
        } catch (e) {
          console.warn("[API STUDENTS] PROFILE_RECORD upsert note:", e);
        }

        // Sinkronisasi avatar & nama di tabel collaboration_invitations secara realtime
        try {
          await supabase
            .from("collaboration_invitations")
            .update({
              inviter_name: user.fullName,
              inviter_avatar: user.avatarUrl,
            })
            .eq("invited_email", cleanEmail);

          if (targetProfileId) {
            await supabase
              .from("collaboration_invitations")
              .update({
                inviter_name: user.fullName,
                inviter_avatar: user.avatarUrl,
              })
              .eq("invited_by", targetProfileId);
          }
        } catch {
          // ignore
        }
      } catch (err) {
        console.warn("[API STUDENTS] Supabase profile sync note:", err);
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
