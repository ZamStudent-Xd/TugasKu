import { NextRequest, NextResponse } from "next/server";
import { getServerDb, saveRegisteredStudentToDb, searchRegisteredStudentsFromDb } from "@/lib/serverDb";
import { UserProfile } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || searchParams.get("search") || "";

    if (!query.trim()) {
      return NextResponse.json({ success: true, students: [] });
    }

    const students = searchRegisteredStudentsFromDb(query);
    return NextResponse.json({ success: true, students });
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

    saveRegisteredStudentToDb(user, password || "");
    return NextResponse.json({ success: true, user });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal menyimpan data mahasiswa";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
