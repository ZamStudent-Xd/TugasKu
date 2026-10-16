import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateStudentEmail, validatePassword } from "@/lib/securityValidation";
import { UserProfile } from "@/types";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey || serviceKey.includes("your-service-key")) {
    return null;
  }
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getSupabaseAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey || anonKey.includes("your-anon-key")) {
    return null;
  }
  return createClient(url, anonKey);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    const emailCheck = validateStudentEmail(email);
    if (!emailCheck.isValid) {
      return NextResponse.json({ success: false, error: emailCheck.error }, { status: 400 });
    }
    const cleanEmail = emailCheck.cleanEmail;

    const passCheck = validatePassword(password);
    if (!passCheck.isValid) {
      return NextResponse.json({ success: false, error: passCheck.error }, { status: 400 });
    }
    const cleanPass = passCheck.cleanPassword!;

    const supabaseAdmin = getSupabaseAdmin();
    const supabaseAnon = getSupabaseAnon();

    // 1. Ambil data profil mahasiswa dari tabel profiles
    let userProfile: UserProfile | null = null;
    const client = supabaseAdmin || supabaseAnon;
    if (client) {
      try {
        const { data: prof } = await client
          .from("profiles")
          .select("*")
          .eq("email", cleanEmail)
          .maybeSingle();

        if (prof) {
          userProfile = {
            id: prof.id,
            fullName: prof.full_name,
            email: prof.email,
            nim: prof.nim || "",
            major: prof.major || "Teknologi Informasi",
            semester: prof.semester || 1,
            campus: prof.campus || "Universitas BSI (Bina Sarana Informatika)",
            avatarUrl: prof.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${prof.nim || prof.id}`,
            createdAt: prof.created_at,
          };
        }
      } catch (e) {
        console.warn("[RESET-PASSWORD API] Error fetching profile:", e);
      }
    }

    // 2. Jika Admin Client tersedia (SUPABASE_SERVICE_ROLE_KEY aktif di server)
    if (supabaseAdmin) {
      let authUserId: string | null = null;
      try {
        const { data: usersData, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
        if (!listErr && Array.isArray(usersData?.users)) {
          const match = usersData.users.find(
            (u) => u.email?.toLowerCase().trim() === cleanEmail
          );
          if (match) {
            authUserId = match.id;
          }
        }
      } catch (err) {
        console.warn("[RESET-PASSWORD API] listUsers note:", err);
      }

      if (authUserId) {
        // Akun sudah ada di auth.users: perbarui password & pastikan email_confirm bernilai true
        const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
          password: cleanPass,
          email_confirm: true,
          user_metadata: userProfile
            ? {
                full_name: userProfile.fullName,
                nim: userProfile.nim,
                major: userProfile.major,
                semester: userProfile.semester,
                campus: userProfile.campus,
                avatar_url: userProfile.avatarUrl,
              }
            : undefined,
        });

        if (updateErr) {
          console.error("[RESET-PASSWORD API] updateUserById error:", updateErr);
          return NextResponse.json(
            { success: false, error: "Gagal memperbarui kata sandi: " + updateErr.message },
            { status: 500 }
          );
        }
      } else {
        // Akun belum ada di auth.users: buat user baru dengan kata sandi baru & otomatis aktif
        const { data: createdData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: cleanEmail,
          password: cleanPass,
          email_confirm: true,
          user_metadata: userProfile
            ? {
                full_name: userProfile.fullName,
                nim: userProfile.nim,
                major: userProfile.major,
                semester: userProfile.semester,
                campus: userProfile.campus,
                avatar_url: userProfile.avatarUrl,
              }
            : undefined,
        });

        if (createErr) {
          console.error("[RESET-PASSWORD API] createUser error:", createErr);
          return NextResponse.json(
            { success: false, error: "Gagal mendaftarkan kata sandi baru: " + createErr.message },
            { status: 500 }
          );
        }

        if (createdData?.user?.id && userProfile) {
          userProfile.id = createdData.user.id;
          // Sinkronkan id auth ke tabel profiles jika belum sama
          try {
            await supabaseAdmin.from("profiles").upsert({
              id: createdData.user.id,
              full_name: userProfile.fullName,
              email: cleanEmail,
              nim: userProfile.nim,
              major: userProfile.major,
              semester: userProfile.semester,
              campus: userProfile.campus,
              avatar_url: userProfile.avatarUrl,
            });
          } catch {}
        }
      }

      return NextResponse.json({
        success: true,
        message: "Kata sandi berhasil diperbarui dan akun aktif secara instan.",
        user: userProfile,
      });
    }

    // 3. Fallback jika SUPABASE_SERVICE_ROLE_KEY belum ditambahkan di environment
    if (supabaseAnon) {
      try {
        await supabaseAnon.auth.signUp({
          email: cleanEmail,
          password: cleanPass,
        });
      } catch (e) {
        console.warn("[RESET-PASSWORD API] Anon fallback note:", e);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Kata sandi berhasil diproses.",
      user: userProfile,
      warning: "SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di environment.",
    });
  } catch (error: any) {
    console.error("[RESET-PASSWORD API] Fatal error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Terjadi kesalahan internal pada server" },
      { status: 500 }
    );
  }
}
