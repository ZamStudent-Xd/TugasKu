import { NextRequest, NextResponse } from "next/server";
import { getServerDb, saveServerDb } from "@/lib/serverDb";
import { TaskInvitation, TaskMember } from "@/types";
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
    const email = searchParams.get("email");
    const taskId = searchParams.get("taskId");

    const invitationsMap = new Map<string, TaskInvitation>();

    // 1. Ambil dari Supabase Cloud Database (sumber data utama antar pengguna)
    const supabase = getSupabase();
    if (supabase) {
      try {
        let query = supabase.from("collaboration_invitations").select("*");
        if (email) {
          query = query.eq("invited_email", email.toLowerCase().trim());
        }
        if (taskId) {
          query = query.eq("task_id", taskId);
        }

        const { data, error } = await query.order("created_at", { ascending: false });
        if (!error && Array.isArray(data)) {
          for (const row of data) {
            const inv: TaskInvitation = {
              id: row.id,
              taskId: row.task_id,
              taskTitle: row.task_title,
              courseName: row.course_name,
              invitedEmail: row.invited_email,
              tokenHash: row.token_hash,
              status: row.status as any,
              expiresAt: row.expires_at,
              invitedBy: row.invited_by,
              inviterName: row.inviter_name,
              inviterAvatar: row.inviter_avatar,
              createdAt: row.created_at,
            };
            invitationsMap.set(inv.id, inv);
          }
        }
      } catch (err) {
        console.warn("[API INVITATIONS] Supabase query note:", err);
      }
    }

    // 2. Ambil dari Server Database lokal (cadangan / offline fallback)
    try {
      const db = getServerDb();
      let localList = db.invitations;
      if (email) {
        const clean = email.toLowerCase().trim();
        localList = localList.filter((i) => i.invitedEmail.toLowerCase().trim() === clean);
      }
      if (taskId) {
        localList = localList.filter((i) => i.taskId === taskId);
      }
      for (const inv of localList) {
        if (!invitationsMap.has(inv.id)) {
          invitationsMap.set(inv.id, inv);
        }
      }
    } catch {
      // ignore
    }

    return NextResponse.json({
      success: true,
      invitations: Array.from(invitationsMap.values()),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memuat undangan";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const invitation = body.invitation as TaskInvitation;
    const taskPayload = body.task || null;

    if (!invitation || !invitation.taskId || !invitation.invitedEmail) {
      return NextResponse.json({ success: false, error: "Data undangan tidak lengkap" }, { status: 400 });
    }

    const cleanEmail = invitation.invitedEmail.toLowerCase().trim();

    // 1. Simpan ke Supabase Cloud Database (Instan aktif untuk semua perangkat)
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from("collaboration_invitations").upsert({
          id: invitation.id,
          task_id: invitation.taskId,
          task_title: invitation.taskTitle,
          course_name: invitation.courseName || "",
          invited_email: cleanEmail,
          token_hash: invitation.tokenHash,
          status: invitation.status,
          expires_at: invitation.expiresAt,
          invited_by: invitation.invitedBy,
          inviter_name: invitation.inviterName || "",
          inviter_avatar: invitation.inviterAvatar || "",
          task_payload: taskPayload,
        });
      } catch (err) {
        console.warn("[API INVITATIONS] Supabase upsert note:", err);
      }
    }

    // 2. Simpan juga ke file lokal sebagai cadangan
    try {
      const db = getServerDb();
      const existing = db.invitations.find(
        (i) =>
          i.taskId === invitation.taskId &&
          i.invitedEmail.toLowerCase().trim() === cleanEmail &&
          i.status === "pending"
      );

      if (!existing) {
        db.invitations.unshift(invitation);
        saveServerDb(db);
      }
    } catch {
      // ignore
    }

    return NextResponse.json({ success: true, invitation });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal mengirim undangan";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { invitationId, status, user } = body as {
      invitationId: string;
      status: "accepted" | "declined";
      user?: any;
    };

    if (!invitationId || !status) {
      return NextResponse.json({ success: false, error: "Parameter tidak lengkap" }, { status: 400 });
    }

    const supabase = getSupabase();
    let supaInvRow: any = null;

    // 1. Sinkronkan pembaruan status ke Supabase jika aktif
    if (supabase) {
      try {
        const { data } = await supabase
          .from("collaboration_invitations")
          .update({ status })
          .eq("id", invitationId)
          .select()
          .maybeSingle();
        supaInvRow = data;
      } catch (err) {
        console.warn("[API INVITATIONS PUT] Supabase update note:", err);
      }
    }

    const db = getServerDb();
    const index = db.invitations.findIndex((i) => i.id === invitationId);

    // Ambil data undangan dari Supabase atau local DB
    const inv = index >= 0 ? db.invitations[index] : supaInvRow ? {
      id: supaInvRow.id,
      taskId: supaInvRow.task_id,
      taskTitle: supaInvRow.task_title,
      courseName: supaInvRow.course_name,
      invitedEmail: supaInvRow.invited_email,
      tokenHash: supaInvRow.token_hash,
      status: supaInvRow.status,
      expiresAt: supaInvRow.expires_at,
      invitedBy: supaInvRow.invited_by,
      inviterName: supaInvRow.inviter_name,
      inviterAvatar: supaInvRow.inviter_avatar,
      createdAt: supaInvRow.created_at,
    } : null;

    if (!inv) {
      return NextResponse.json({ success: false, error: "Undangan tidak ditemukan" }, { status: 404 });
    }

    if (index >= 0) {
      db.invitations[index].status = status;
    }

    let updatedTask: any = supaInvRow?.task_payload || null;
    let targetCourse: any;
    let createdNewCourse: any = null;

    // Jika diterima, otomatis masukkan mahasiswa ke task.members dan sediakan mata kuliah!
    if (status === "accepted") {
      const taskIndex = db.tasks.findIndex((t) => t.id === inv.taskId);
      const cleanEmail = inv.invitedEmail.toLowerCase().trim();
      const profile = user || db.profiles.find((p) => p.email.toLowerCase().trim() === cleanEmail);

      const memberUserId = profile?.id || user?.id || `user-${Date.now()}`;
      const memberFullName = profile?.fullName || user?.fullName || inv.invitedEmail.split("@")[0];
      const memberAvatar = profile?.avatarUrl || user?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanEmail}`;

      const newMember: TaskMember = {
        userId: memberUserId,
        taskId: inv.taskId,
        fullName: memberFullName,
        avatarUrl: memberAvatar,
        role: "member",
        joinedAt: new Date().toISOString(),
      };

      if (taskIndex >= 0) {
        const currentMembers = db.tasks[taskIndex].members || [];
        const alreadyIn = currentMembers.some(
          (m: any) =>
            m.userId === memberUserId ||
            (m.fullName && m.fullName.toLowerCase().trim() === memberFullName.toLowerCase().trim())
        );

        if (!alreadyIn) {
          db.tasks[taskIndex].members = [...currentMembers, newMember];
          db.tasks[taskIndex].updatedAt = new Date().toISOString();
        }
        updatedTask = db.tasks[taskIndex];
      } else if (updatedTask) {
        // Gunakan task_payload dari Supabase
        const currentMembers = updatedTask.members || [];
        if (!currentMembers.some((m: any) => m.userId === memberUserId)) {
          updatedTask.members = [...currentMembers, newMember];
          updatedTask.updatedAt = new Date().toISOString();
        }
      }

      const targetCourseName = (inv.courseName || "").trim();
      if (targetCourseName) {
        const cleanName = targetCourseName.toLowerCase();
        const cleanMemberEmail = (profile?.email || "").toLowerCase().trim();
        const cleanMemberNim = (profile?.nim || "").toLowerCase().trim();
        const existingInDb = db.courses.find((c) => {
          const cOwner = (c.ownerId || "").toLowerCase().trim();
          const isOwner =
            (memberUserId && cOwner === memberUserId.toLowerCase()) ||
            (cleanMemberEmail && cOwner === cleanMemberEmail) ||
            (cleanMemberNim && cOwner === cleanMemberNim);
          return isOwner && c.name.trim().toLowerCase() === cleanName;
        });

        if (existingInDb) {
          targetCourse = existingInDb;
          createdNewCourse = null;
        } else {
          createdNewCourse = {
            id: `course-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            ownerId: memberUserId,
            name: targetCourseName,
            lecturer: "Dosen Pengampu",
            code: "KOLAB",
            color: "indigo",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          targetCourse = createdNewCourse;
          db.courses.unshift(createdNewCourse);
        }
      }
    }

    try {
      saveServerDb(db);
    } catch {
      // ignore
    }

    return NextResponse.json({
      success: true,
      invitation: inv,
      task: updatedTask,
      course: targetCourse,
      newCourseAdded: createdNewCourse,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memperbarui status undangan";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
