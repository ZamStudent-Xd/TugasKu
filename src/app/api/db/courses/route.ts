import { NextRequest, NextResponse } from "next/server";
import { getServerDb, saveServerDb } from "@/lib/serverDb";
import { Course } from "@/types";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes("your-project") || key.includes("your-anon-key")) {
    return null;
  }
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const email = searchParams.get("email");

    const db = getServerDb();
    let courses = db.courses;

    // Filter ketat: Pengguna HANYA melihat mata kuliah miliknya sendiri atau mata kuliah dari tugas yang telah ia terima
    if (userId || email) {
      let effectiveUserId = userId || "";
      let effectiveEmail = email ? email.toLowerCase().trim() : "";

      // Lookup profil jika salah satu parameter belum terdefinisi
      if (effectiveEmail && !effectiveUserId) {
        const found = db.profiles.find((p) => p.email.toLowerCase().trim() === effectiveEmail);
        if (found) effectiveUserId = found.id;
      } else if (effectiveUserId && !effectiveEmail) {
        const found = db.profiles.find((p) => p.id === effectiveUserId);
        if (found) effectiveEmail = found.email.toLowerCase().trim();
      }

      // Pastikan setiap tugas kelompok yang diikuti user ini memiliki data mata kuliah permanen milik user tersebut (jika belum ada)
      // Hal ini menjamin bahwa jika kolaborasi dicabut di kemudian hari, mata kuliah milik user TIDAK AKAN terhapus!
      const userCollaborativeTasks = db.tasks.filter((t) =>
        t.members?.some((m) =>
          (effectiveUserId && m.userId === effectiveUserId) ||
          (effectiveEmail && m.userId?.toLowerCase().trim() === effectiveEmail)
        )
      );

      let dbChanged = false;
      for (const t of userCollaborativeTasks) {
        const origCourse = db.courses.find((c) => c.id === t.courseId);
        const cName = origCourse?.name || t.courseName;
        if (!cName) continue;
        const cleanName = cName.trim().toLowerCase();

        const student = db.profiles.find((s) =>
          (effectiveUserId && s.id === effectiveUserId) ||
          (effectiveEmail && s.email.toLowerCase().trim() === effectiveEmail)
        );
        const studentNim = (student?.nim || "").toLowerCase().trim();

        // Cek apakah user sudah punya mata kuliah dengan nama yang sama
        const hasOwnedCourse = db.courses.some((c) => {
          const cOwner = (c.ownerId || "").toLowerCase().trim();
          const isOwner =
            (effectiveUserId && cOwner === effectiveUserId.toLowerCase()) ||
            (effectiveEmail && cOwner === effectiveEmail) ||
            (studentNim && cOwner === studentNim);
          return isOwner && c.name.trim().toLowerCase() === cleanName;
        });

        if (!hasOwnedCourse) {
          // Buat mata kuliah permanen untuk user ini agar tidak terhapus jika kolaborasi dicabut
          const newCourse: Course = {
            id: `course-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            ownerId: effectiveUserId || effectiveEmail,
            name: origCourse?.name || cName,
            lecturer: origCourse?.lecturer || "Dosen Pengampu",
            code: origCourse?.code || "BSI",
            color: origCourse?.color || "indigo",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          db.courses.unshift(newCourse);
          dbChanged = true;
        }
      }

      if (dbChanged) {
        saveServerDb(db);
        courses = db.courses;
      }

      // Filter mata kuliah kandidat untuk user ini
      const candidateCourses = courses.filter((c) => {
        // 1. Pemilik mata kuliah
        if (effectiveUserId && c.ownerId === effectiveUserId) return true;
        if (effectiveEmail && c.ownerId?.toLowerCase().trim() === effectiveEmail) return true;

        // 2. Mata kuliah dari tugas kelompok yang diikuti user secara sah
        const hasValidTask = db.tasks.some((t) => {
          if (t.courseId !== c.id) return false;
          if (effectiveUserId && t.createdBy === effectiveUserId) return true;
          if (effectiveEmail && t.createdBy?.toLowerCase().trim() === effectiveEmail) return true;
          if (t.members && t.members.some((m) => {
            if (effectiveUserId && m.userId === effectiveUserId) return true;
            if (effectiveEmail && m.userId?.toLowerCase().trim() === effectiveEmail) return true;
            return false;
          })) {
            return true;
          }
          return false;
        });

        return hasValidTask;
      });

      // DEDUPLIKASI BERDASARKAN NAMA (case-insensitive & trimmed)
      // Pengguna tidak boleh melihat 2 mata kuliah dengan nama yang sama.
      // Prioritaskan mata kuliah yang langsung dimiliki user (ownerId === effectiveUserId).
      const deduplicated: Course[] = [];
      const seenNames = new Set<string>();

      // Pass 1: Tambahkan mata kuliah yang dimiliki langsung
      for (const c of candidateCourses) {
        const isOwner = (effectiveUserId && c.ownerId === effectiveUserId) ||
          (effectiveEmail && c.ownerId?.toLowerCase().trim() === effectiveEmail);
        if (isOwner) {
          const key = c.name.toLowerCase().trim();
          if (!seenNames.has(key)) {
            deduplicated.push(c);
            seenNames.add(key);
          }
        }
      }

      // Pass 2: Tambahkan mata kuliah lainnya jika belum pernah ada nama yang sama
      for (const c of candidateCourses) {
        const key = c.name.toLowerCase().trim();
        if (!seenNames.has(key)) {
          deduplicated.push(c);
          seenNames.add(key);
        }
      }

      courses = deduplicated;
    }

    return NextResponse.json({ success: true, courses });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memuat mata kuliah";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const course = body.course as Course;

    if (!course || !course.name || !course.name.trim()) {
      return NextResponse.json({ success: false, error: "Nama mata kuliah wajib diisi" }, { status: 400 });
    }

    const cleanName = course.name.trim().toLowerCase();
    const db = getServerDb();

    // Validasi larangan duplikasi nama mata kuliah untuk pemilik yang sama (case-insensitive & trimmed)
    const duplicate = db.courses.find((c) => {
      if (c.id === course.id) return false;
      const sameOwner =
        (course.ownerId && c.ownerId === course.ownerId) ||
        (course.ownerId && c.ownerId?.toLowerCase().trim() === course.ownerId.toLowerCase().trim());
      return sameOwner && c.name.trim().toLowerCase() === cleanName;
    });

    if (duplicate) {
      return NextResponse.json(
        {
          success: false,
          error: `Mata kuliah "${course.name.trim()}" sudah ada di daftar Anda. Harap gunakan nama lain.`,
        },
        { status: 400 }
      );
    }

    const index = db.courses.findIndex((c) => c.id === course.id);
    if (index >= 0) {
      db.courses[index] = course;
    } else {
      db.courses.unshift(course);
    }
    saveServerDb(db);

    return NextResponse.json({ success: true, course });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal menyimpan mata kuliah";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("id");
    const userId = searchParams.get("userId");
    const email = searchParams.get("email");

    if (!courseId) {
      return NextResponse.json({ success: false, error: "ID mata kuliah diperlukan" }, { status: 400 });
    }

    const courseNameParam = (searchParams.get("courseName") || searchParams.get("name") || "").toLowerCase().trim();

    const db = getServerDb();
    const targetCourse = db.courses.find((c) => c.id === courseId);
    const targetCourseName = courseNameParam || targetCourse?.name?.toLowerCase().trim();

    // Hapus mata kuliah yang ditargetkan dari daftar mata kuliah
    db.courses = db.courses.filter((c) => c.id !== courseId);

    let effectiveUserId = userId || "";
    let effectiveEmail = email ? email.toLowerCase().trim() : "";

    const userProfile = db.profiles.find((p) =>
      (effectiveUserId && p.id === effectiveUserId) ||
      (effectiveEmail && p.email.toLowerCase().trim() === effectiveEmail)
    );
    const effectiveNim = userProfile?.nim?.toLowerCase().trim() || "";
    const effectiveName = userProfile?.fullName?.toLowerCase().trim() || "";

    // Tangani tugas terkait mata kuliah ini:
    // 1. Tugas kolaborasi milik ketua lain di mana user ini adalah anggota:
    //    Tugas kolaborasi TETAP ADA di ketua kelompok, tetapi keanggotaan user ini otomatis dilepaskan (dihapus dari task.members).
    // 2. Tugas yang dibuat oleh user ini pada mata kuliah ini:
    //    Hapus tugas tersebut dari database (CASCADE).
    db.tasks = db.tasks.filter((t) => {
      const isLinked =
        t.courseId === courseId ||
        (t.courseId && courseId && (t.courseId.includes(courseId) || courseId.includes(t.courseId))) ||
        (targetCourseName && t.courseName?.toLowerCase().trim() === targetCourseName);

      if (!isLinked) return true; // Tugas di mata kuliah lain, tetap biarkan

      const isGroupTask =
        t.taskType === "group" ||
        (t.taskType as string)?.toLowerCase() === "kelompok" ||
        (t.members && t.members.length > 1);

      const cleanCreator = (t.createdBy || "").toLowerCase().trim();
      const isCreatedByDeletingUser =
        (effectiveUserId && cleanCreator === effectiveUserId.toLowerCase().trim()) ||
        (effectiveEmail && cleanCreator === effectiveEmail);
      const isCreatedByOther = !isCreatedByDeletingUser;

      if (isGroupTask && isCreatedByOther) {
        // Otomatis terlepas kolaborasi tersebut: hapus user dari task.members
        if (t.members) {
          t.members = t.members.filter((m) => {
            const mUser = (m.userId || "").toLowerCase().trim();
            const mName = (m.fullName || "").toLowerCase().trim();
            if (effectiveUserId && mUser === effectiveUserId.toLowerCase().trim()) return false;
            if (effectiveEmail && (mUser === effectiveEmail || (m as any).email === effectiveEmail)) return false;
            if (effectiveNim && (mName === effectiveNim || mUser.includes(effectiveNim))) return false;
            if (effectiveName && mName === effectiveName) return false;
            return true;
          });
          t.updatedAt = new Date().toISOString();
        }
        // Tugas kolaborasi TETAP ADA di ketua kolaborasi!
        return true;
      }

      // Jika tugas dibuat oleh user ini, hapus tugas bersama mata kuliahnya
      return false;
    });

    // Perbarui status undangan jika ada
    if (effectiveEmail || effectiveUserId) {
      db.invitations = db.invitations.map((inv) => {
        const isMatchUser =
          (effectiveEmail && inv.invitedEmail.toLowerCase().trim() === effectiveEmail) ||
          (effectiveUserId && inv.invitedBy !== effectiveUserId);
        if (isMatchUser && targetCourseName && inv.courseName?.toLowerCase().trim() === targetCourseName) {
          return { ...inv, status: "revoked" };
        }
        return inv;
      });
    }

    // Sinkronkan ke Supabase Cloud jika terkonfigurasi
    const supabase = getSupabase();
    if (supabase) {
      try {
        let courseDelQuery = supabase.from("courses").delete().eq("id", courseId);
        if (effectiveUserId) {
          courseDelQuery = courseDelQuery.eq("owner_id", effectiveUserId);
        }
        await courseDelQuery;

        if (effectiveEmail || effectiveUserId) {
          const { data: collabRows } = await supabase
            .from("collaboration_invitations")
            .select("*");

          if (Array.isArray(collabRows)) {
            for (const row of collabRows) {
              const rowCourse = (row.course_name || row.task_payload?.courseName || "").toLowerCase().trim();
              const rowCourseId = (row.task_payload?.courseId || "").toLowerCase().trim();
              const isMatchCourse =
                (targetCourseName && rowCourse === targetCourseName) ||
                rowCourseId === courseId.toLowerCase() ||
                (rowCourseId && (rowCourseId.includes(courseId.toLowerCase()) || courseId.toLowerCase().includes(rowCourseId)));

              if (isMatchCourse) {
                const rowEmail = (row.invited_email || "").toLowerCase().trim();
                const isTargetRow =
                  !row.id.startsWith("task-base-") &&
                  Boolean(
                    (effectiveEmail && rowEmail === effectiveEmail) ||
                    (effectiveNim && (rowEmail === `${effectiveNim}@bsi.ac.id` || rowEmail.startsWith(`${effectiveNim}@`)))
                  );

                if (isTargetRow) {
                  await supabase.from("collaboration_invitations").delete().eq("id", row.id);
                } else if (row.task_payload) {
                  const payload = row.task_payload as any;
                  const currentMembers = payload.members || [];
                  const filtered = currentMembers.filter((m: any) => {
                    const mUser = (m.userId || "").toLowerCase().trim();
                    const mName = (m.fullName || "").toLowerCase().trim();
                    if (effectiveUserId && mUser === effectiveUserId.toLowerCase().trim()) return false;
                    if (effectiveEmail && (mUser === effectiveEmail || m.email === effectiveEmail)) return false;
                    if (effectiveNim && (mName === effectiveNim || mUser.includes(effectiveNim))) return false;
                    if (effectiveName && mName === effectiveName) return false;
                    return true;
                  });
                  payload.members = filtered;
                  payload.updatedAt = new Date().toISOString();
                  await supabase.from("collaboration_invitations").update({ task_payload: payload }).eq("id", row.id);
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn("[API COURSES DELETE] Supabase sync note:", err);
      }
    }

    saveServerDb(db);

    return NextResponse.json({ success: true, courses: db.courses, tasks: db.tasks });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal menghapus mata kuliah";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
