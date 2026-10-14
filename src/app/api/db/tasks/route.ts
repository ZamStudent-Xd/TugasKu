import { NextRequest, NextResponse } from "next/server";
import { getServerDb, saveServerDb } from "@/lib/serverDb";
import { Task } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const email = searchParams.get("email");

    const db = getServerDb();
    let tasks = db.tasks;

    // Filter ketat: Pengguna HANYA melihat tugas miliknya sendiri atau tugas kelompok yang telah ia terima
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

      tasks = tasks.filter((t) => {
        // 1. Pembuat tugas
        if (effectiveUserId && t.createdBy === effectiveUserId) return true;
        if (effectiveEmail && t.createdBy?.toLowerCase().trim() === effectiveEmail) return true;

        // 2. Anggota kelompok yang telah menerima undangan kolaborasi
        if (t.members && t.members.some((m) => {
          if (effectiveUserId && m.userId === effectiveUserId) return true;
          if (effectiveEmail && m.userId?.toLowerCase().trim() === effectiveEmail) return true;
          return false;
        })) {
          return true;
        }

        return false;
      });
    }

    // Pastikan seluruh tugas memiliki courseName untuk pencocokan lintas pengguna
    tasks = tasks.map((t) => {
      if (t.courseName) return t;
      const c = db.courses.find((course) => course.id === t.courseId);
      return { ...t, courseName: c?.name || "" };
    });

    return NextResponse.json({ success: true, tasks });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memuat tugas";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const task = body.task as Task;

    if (!task || !task.title) {
      return NextResponse.json({ success: false, error: "Judul tugas wajib diisi" }, { status: 400 });
    }

    const db = getServerDb();
    if (!task.courseName) {
      const c = db.courses.find((course) => course.id === task.courseId);
      task.courseName = c?.name || "";
    }

    const index = db.tasks.findIndex((t) => t.id === task.id);
    if (index >= 0) {
      db.tasks[index] = task;
    } else {
      db.tasks.unshift(task);
    }
    saveServerDb(db);

    return NextResponse.json({ success: true, task, tasks: db.tasks });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal menyimpan tugas";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, updates, newMember } = body as {
      taskId: string;
      updates?: Partial<Task>;
      newMember?: any;
    };

    if (!taskId) {
      return NextResponse.json({ success: false, error: "ID tugas diperlukan" }, { status: 400 });
    }

    const db = getServerDb();
    const index = db.tasks.findIndex((t) => t.id === taskId);
    if (index < 0) {
      return NextResponse.json({ success: false, error: "Tugas tidak ditemukan" }, { status: 404 });
    }

    let updatedTask = { ...db.tasks[index] };

    if (newMember) {
      const currentMembers = updatedTask.members || [];
      const already = currentMembers.some(
        (m: any) =>
          m.userId === newMember.userId ||
          (newMember.fullName && m.fullName?.toLowerCase().trim() === newMember.fullName?.toLowerCase().trim())
      );
      if (!already) {
        updatedTask.members = [...currentMembers, newMember];
      }
    }

    if (updates) {
      updatedTask = {
        ...updatedTask,
        ...updates,
      };
    }

    if (!updatedTask.courseName) {
      const c = db.courses.find((course) => course.id === updatedTask.courseId);
      updatedTask.courseName = c?.name || "";
    }

    updatedTask.updatedAt = new Date().toISOString();
    db.tasks[index] = updatedTask;
    saveServerDb(db);

    return NextResponse.json({ success: true, task: db.tasks[index], tasks: db.tasks });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memperbarui tugas";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("id");

    if (!taskId) {
      return NextResponse.json({ success: false, error: "ID tugas diperlukan" }, { status: 400 });
    }

    const db = getServerDb();
    db.tasks = db.tasks.filter((t) => t.id !== taskId);
    saveServerDb(db);

    return NextResponse.json({ success: true, tasks: db.tasks });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal menghapus tugas";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
