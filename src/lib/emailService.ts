/**
 * Email Service - Brevo (Sendinblue) Transactional API
 * Mengirimkan kode OTP 6 digit langsung ke email mahasiswa secara privat.
 * Jauh lebih cepat dari SMTP karena menggunakan HTTP API langsung.
 *
 * PENTING: File ini hanya boleh dijalankan di sisi SERVER (API Route).
 */

/**
 * Cek apakah Brevo sudah dikonfigurasi
 */
export function isEmailConfigured(): boolean {
  const key = process.env.BREVO_API_KEY || "";
  const sender = process.env.BREVO_SENDER_EMAIL || "";
  return !!(key && sender);
}

// Alias untuk kompatibilitas mundur
export const isGmailConfigured = isEmailConfigured;

/**
 * Kirim kode OTP 6-digit ke email mahasiswa via Brevo API
 */
export async function sendOtpEmail(
  toEmail: string,
  otpCode: string,
  studentName: string,
  purpose: "register" | "reset" = "register"
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY || "";
  const senderEmail = process.env.BREVO_SENDER_EMAIL || "";
  const senderName = process.env.BREVO_SENDER_NAME || "TugasKu Apps";

  if (!apiKey || !senderEmail) {
    return {
      success: false,
      error: "Brevo belum dikonfigurasi. Atur BREVO_API_KEY dan BREVO_SENDER_EMAIL di .env.local",
    };
  }

  const isReset = purpose === "reset";
  const actionText = isReset
    ? "Anda meminta pengaturan ulang kata sandi di TugasKu. Gunakan kode verifikasi di bawah ini untuk membuat kata sandi baru Anda:"
    : "Anda telah mendaftarkan akun baru di TugasKu. Gunakan kode verifikasi di bawah ini untuk menyelesaikan pendaftaran Anda:";

  const htmlContent = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #F4F5FB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 480px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: white; border-radius: 24px; padding: 40px 32px; box-shadow: 0 4px 24px rgba(99, 102, 241, 0.08); border: 1px solid #E2E8F5;">
      
      <!-- Logo Header -->
      <div style="text-align: center; margin-bottom: 28px;">
        <div style="width: 56px; height: 56px; border-radius: 16px; background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;">
          <span style="font-size: 28px; color: white;">&#127891;</span>
        </div>
        <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #1E1B4B; letter-spacing: -0.5px;">TugasKu</h1>
        <p style="margin: 4px 0 0; font-size: 11px; font-weight: 700; color: #6366F1; text-transform: uppercase; letter-spacing: 1.5px;">Portal Tugas Mahasiswa BSI</p>
      </div>

      <!-- Greeting -->
      <p style="margin: 0 0 8px; font-size: 15px; color: #374151; font-weight: 600;">
        Halo, <span style="color: #1E1B4B;">${studentName}</span> &#128075;
      </p>
      <p style="margin: 0 0 24px; font-size: 13px; color: #6B7280; line-height: 1.6;">
        ${actionText}
      </p>

      <!-- OTP Code Box -->
      <div style="background: linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%); border: 2px solid #C7D2FE; border-radius: 20px; padding: 28px; text-align: center; margin-bottom: 24px;">
        <p style="margin: 0 0 8px; font-size: 11px; font-weight: 700; color: #6366F1; text-transform: uppercase; letter-spacing: 1px;">Kode Verifikasi Anda</p>
        <div style="font-size: 36px; font-weight: 900; letter-spacing: 10px; color: #4F46E5; font-family: 'Courier New', Courier, monospace; padding: 8px 0;">
          ${otpCode}
        </div>
        <p style="margin: 8px 0 0; font-size: 11px; color: #9CA3AF;">Berlaku selama 10 menit</p>
      </div>

      <!-- Security Notice -->
      <div style="background: #FEF3C7; border: 1px solid #FDE68A; border-radius: 16px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 12px; color: #92400E; font-weight: 600; line-height: 1.5;">
          &#128274; <strong>Keamanan:</strong> Jangan bagikan kode ini kepada siapa pun. Tim TugasKu tidak pernah meminta kode verifikasi Anda melalui pesan atau telepon.
        </p>
      </div>

      <!-- Footer -->
      <div style="text-align: center; border-top: 1px solid #E5E7EB; padding-top: 20px;">
        <p style="margin: 0; font-size: 11px; color: #9CA3AF;">
          Email ini dikirim secara otomatis oleh sistem TugasKu.<br>
          Jika Anda tidak mendaftar, abaikan email ini.
        </p>
        <p style="margin: 12px 0 0; font-size: 11px; color: #C4B5FD; font-weight: 600;">
          &copy; 2026 TugasKu &mdash; Universitas BSI
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: {
          name: senderName,
          email: senderEmail,
        },
        to: [
          {
            email: toEmail,
            name: studentName,
          },
        ],
        subject: isReset
          ? `[TugasKu] Kode Pengaturan Ulang Password: ${otpCode}`
          : `Kode Verifikasi TugasKu Anda: ${otpCode}`,
        htmlContent,
        textContent: isReset
          ? `[TugasKu] Kode Pengaturan Ulang Password: ${otpCode}\n\nHalo ${studentName},\nGunakan kode 6 digit ini untuk mengatur ulang kata sandi akun TugasKu Anda.\n\nKode berlaku selama 10 menit. Jangan bagikan kode ini kepada siapa pun.\n\n© 2026 TugasKu — Universitas BSI`
          : `Kode Verifikasi TugasKu Anda: ${otpCode}\n\nHalo ${studentName},\nGunakan kode 6 digit ini untuk menyelesaikan pendaftaran akun TugasKu Anda.\n\nKode berlaku selama 10 menit. Jangan bagikan kode ini kepada siapa pun.\n\n© 2026 TugasKu — Universitas BSI`,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errMsg = (errData as Record<string, string>).message || `HTTP ${response.status}`;
      console.error("[BREVO ERROR]", errMsg);
      return { success: false, error: errMsg };
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal mengirim email OTP";
    console.error("[EMAIL SERVICE ERROR]", message);
    return { success: false, error: message };
  }
}
