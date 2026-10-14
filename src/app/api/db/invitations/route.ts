import { NextRequest, NextResponse } from "next/server";
import { getServerDb, saveServerDb } from "@/lib/serverDb";
import { TaskInvitation, TaskMember } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    const taskId = searchParams.get("taskId");

    const db = getServerDb();
    let invitations = db.invitations;

    if (email) {
      const clean = email.toLowerCase().trim();
      invitations = invitations.filter((i) => i.invitedEmail.toLowerCase().trim() === clean);
    }

    if (taskId) {
      invitations = invitations.filter((i) => i.taskId === taskId);
    }

    return NextResponse.json({ success: true, invitations });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memuat undangan";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const invitation = body.invitation as TaskInvitation;

    if (!invitation || !invitation.taskId || !invitation.invitedEmail) {
      return NextResponse.json({ success: false, error: "Data undangan tidak lengkap" }, { status: 400 });
    }

    const db = getServerDb();
    const cleanEmail = invitation.invitedEmail.toLowerCase().trim();

    // Hindari duplikasi jika sudah ada undangan pending untuk tugas yang sama
    const existing = db.invitations.find(
      (i) =>
        i.taskId === invitation.taskId &&
        i.invitedEmail.toLowerCase().trim() === cleanEmail &&
        i.status === "pending"
    );

    if (existing) {
      return NextResponse.json(
        { success: false, error: "Undangan sudah dikirimkan sebelumnya ke mahasiswa ini." },
        { status: 400 }
      );
    }

    db.invitations.unshift(invitation);
    saveServerDb(db);

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

    const db = getServerDb();
    const index = db.invitations.findIndex((i) => i.id === invitationId);
    if (index < 0) {
      return NextResponse.json({ success: false, error: "Undangan tidak ditemukan" }, { status: 404 });
    }

    db.invitations[index].status = status;
    const inv = db.invitations[index];

    let updatedTask: any;
    let targetCourse: any;
    let createdNewCourse: any = null;

    // Jika diterima, otomatis masukkan mahasiswa ke task.members dan sediakan mata kuliah di database server!
    if (status === "accepted") {
      const taskIndex = db.tasks.findIndex((t) => t.id === inv.taskId);
      const cleanEmail = inv.invitedEmail.toLowerCase().trim();
      const profile = user || db.profiles.find((p) => p.email.toLowerCase().trim() === cleanEmail);

      const memberUserId = profile?.id || user?.id || `user-${Date.now()}`;
      const memberFullName = profile?.fullName || user?.fullName || inv.invitedEmail.split("@")[0];
      const memberAvatar = profile?.avatarUrl || user?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanEmail}`;

      if (taskIndex >= 0) {
        const currentMembers = db.tasks[taskIndex].members || [];
        const alreadyIn = currentMembers.some(
          (m: any) =>
            m.userId === memberUserId ||
            (m.fullName && m.fullName.toLowerCase().trim() === memberFullName.toLowerCase().trim())
        );

        if (!alreadyIn) {
          const newMember: TaskMember = {
            userId: memberUserId,
            taskId: inv.taskId,
            fullName: memberFullName,
            avatarUrl: memberAvatar,
            role: "member",
            joinedAt: new Date().toISOString(),
          };
          db.tasks[taskIndex].members = [...currentMembers, newMember];
          db.tasks[taskIndex].updatedAt = new Date().toISOString();
        }
        updatedTask = db.tasks[taskIndex];

        // Cari mata kuliah asal dari tugas kolaborasi
        const originatingCourse = db.courses.find((c) => c.id === db.tasks[taskIndex].courseId);
        const targetCourseName = (originatingCourse?.name || inv.courseName || "").trim();

        if (targetCourseName) {
          // Pastikan task memiliki courseName agar sinkron lintas akun
          db.tasks[taskIndex].courseName = targetCourseName;

          // Cek apakah mahasiswa penerima kolaborasi sudah memiliki mata kuliah dengan nama yang sama
          const cleanTargetName = targetCourseName.toLowerCase();
          const userExistingCourse = db.courses.find((c) => {
            const isOwner =
              (memberUserId && c.ownerId === memberUserId) ||
              (cleanEmail && c.ownerId?.toLowerCase().trim() === cleanEmail);
            return isOwner && c.name.trim().toLowerCase() === cleanTargetName;
          });

          if (userExistingCourse) {
            // Sudah ada mata kuliah yang sama: masukkan tugas ke mata kuliah tersebut, JANGAN buat baru!
            targetCourse = userExistingCourse;
          } else {
            // Belum ada mata kuliah: otomatis buatkan mata kuliah baru untuk penerima
            // ownerId adalah memberUserId agar mata kuliah permanen dan TIDAK terhapus jika kolaborasi dicabut!
            createdNewCourse = {
              id: `course-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              ownerId: memberUserId,
              name: targetCourseName,
              lecturer: originatingCourse?.lecturer || "Dosen Pengampu",
              code: originatingCourse?.code || "KOLAB",
              color: originatingCourse?.color || "indigo",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            db.courses.unshift(createdNewCourse);
            targetCourse = createdNewCourse;
          }
        }
      }
    }

    saveServerDb(db);

    return NextResponse.json({
      success: true,
      invitation: db.invitations[index],
      task: updatedTask,
      course: targetCourse,
      newCourseAdded: createdNewCourse,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memperbarui status undangan";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
