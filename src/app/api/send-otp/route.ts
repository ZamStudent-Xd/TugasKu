/**
 * API Route: POST /api/send-otp
 * 
 * Menerima email dan kode OTP dari server-side logic,
 * lalu mengirimkannya melalui Brevo (Sendinblue) Transactional API ke inbox mahasiswa.
 * 
 * Body JSON:
 * {
 *   "email": "nim@bsi.ac.id",
 *   "otpCode": "123456",
 *   "studentName": "Nama Lengkap"
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { sendOtpEmail, isEmailConfigured } from "@/lib/emailService";
import { validateStudentEmail, validateOtpCode, sanitizeText } from "@/lib/securityValidation";

export async function POST(request: NextRequest) {
  try {
    // 1. Cek apakah layanan email (Brevo) sudah dikonfigurasi
    if (!isEmailConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: "Email service belum dikonfigurasi. Atur BREVO_API_KEY dan BREVO_SENDER_EMAIL di .env.local",
        },
        { status: 503 }
      );
    }

    // 2. Parse request body
    const body = await request.json();
    const { email, otpCode, studentName } = body;

    // 3. Zero-Trust Validation
    const emailCheck = validateStudentEmail(email);
    if (!emailCheck.isValid) {
      return NextResponse.json(
        { success: false, error: emailCheck.error || "Email tidak valid" },
        { status: 400 }
      );
    }

    const codeCheck = validateOtpCode(otpCode);
    if (!codeCheck.isValid) {
      return NextResponse.json(
        { success: false, error: codeCheck.error || "Kode OTP tidak valid" },
        { status: 400 }
      );
    }

    const cleanName = sanitizeText(studentName) || "Mahasiswa BSI";

    // 4. Kirim email OTP melalui Gmail SMTP
    const result = await sendOtpEmail(emailCheck.cleanEmail, codeCheck.cleanCode, cleanName);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Gagal mengirim email" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[API /send-otp ERROR]", message);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan internal saat mengirim kode OTP" },
      { status: 500 }
    );
  }
}
