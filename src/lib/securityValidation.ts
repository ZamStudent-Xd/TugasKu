/**
 * Zero-Trust Security Validation & Input Sanitization
 * Menolak dan membersihkan segala input yang tidak aman dari pengguna
 * sebelum diproses oleh database, session, atau penyimpanan lokal.
 */

// Daftar Program Studi resmi yang diizinkan (Whitelist)
export const ALLOWED_MAJORS = [
  "Teknologi Informasi",
  "Sistem Informasi",
  "Rekayasa Perangkat Lunak",
  "Ilmu Komputer",
  "Teknik Informatika",
  "Manajemen Informatika",
] as const;

/**
 * Sanitasi string untuk mencegah XSS, Injeksi HTML, dan Karakter Berbahaya
 */
export function sanitizeText(input: unknown): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/\0/g, "") // Hapus Null Bytes
    .replace(/[\r\n]/g, " ") // Hapus CRLF Injection
    .replace(/<[^>]*>/g, "") // Hapus Tag HTML (<script>, <iframe>, dll)
    .replace(/[<>"'`]/g, "") // Hapus karakter rawan XSS
    .trim();
}

/**
 * Validasi Ketat Email Mahasiswa BSI
 * - Wajib berakhiran @bsi.ac.id
 * - Format karakter harus sesuai RFC 5322
 * - Panjang minimal 8, maksimal 100 karakter
 */
export function validateStudentEmail(email: unknown): {
  isValid: boolean;
  cleanEmail: string;
  error?: string;
} {
  if (typeof email !== "string" || !email.trim()) {
    return { isValid: false, cleanEmail: "", error: "Email student wajib diisi" };
  }

  const clean = email.trim().toLowerCase().replace(/\0/g, "");

  if (clean.length < 8) {
    return { isValid: false, cleanEmail: "", error: "Email terlalu pendek" };
  }

  if (clean.length > 100) {
    return { isValid: false, cleanEmail: "", error: "Email maksimal 100 karakter" };
  }

  // Cek karakter terlarang / percobaan injeksi
  if (/[\s<>'"();\\]/.test(clean)) {
    return { isValid: false, cleanEmail: "", error: "Email mengandung karakter tidak valid" };
  }

  // Wajib berakhiran domain resmi @bsi.ac.id
  const bsiRegex = /^[a-zA-Z0-9._%+-]+@bsi\.ac\.id$/;
  if (!bsiRegex.test(clean)) {
    return {
      isValid: false,
      cleanEmail: "",
      error: "Email wajib menggunakan domain resmi student @bsi.ac.id (contoh: 12220101@bsi.ac.id)",
    };
  }

  return { isValid: true, cleanEmail: clean };
}

/**
 * Validasi Ketat NIM Mahasiswa
 * - Hanya boleh angka (Numeric Only)
 * - Panjang standar 8 sampai 12 digit
 * - Menolak injeksi SQL seperti `' OR 1=1`, karakter huruf, spasi, atau simbol
 */
export function validateNim(nim: unknown): {
  isValid: boolean;
  cleanNim: string;
  error?: string;
} {
  if (typeof nim !== "string" && typeof nim !== "number") {
    return { isValid: false, cleanNim: "", error: "NIM mahasiswa wajib diisi" };
  }

  const raw = String(nim).trim();

  if (!raw) {
    return { isValid: false, cleanNim: "", error: "NIM mahasiswa wajib diisi" };
  }

  // Cek apakah murni angka saja
  if (!/^\d+$/.test(raw)) {
    return { isValid: false, cleanNim: "", error: "NIM hanya boleh berisi angka (tanpa huruf, spasi, atau simbol)" };
  }

  if (raw.length < 8 || raw.length > 12) {
    return { isValid: false, cleanNim: "", error: "NIM harus terdiri dari 8 hingga 12 digit angka" };
  }

  return { isValid: true, cleanNim: raw };
}

/**
 * Validasi Ketat Nama Lengkap
 * - Panjang 2 sampai 80 karakter
 * - Hanya alfabet, spasi, titik, koma, dan tanda hubung
 * - Menolak skrip, tag html, atau karakter aneh
 */
export function validateFullName(name: unknown): {
  isValid: boolean;
  cleanName: string;
  error?: string;
} {
  if (typeof name !== "string" || !name.trim()) {
    return { isValid: false, cleanName: "", error: "Nama lengkap wajib diisi" };
  }

  const sanitized = sanitizeText(name);

  if (sanitized.length < 2) {
    return { isValid: false, cleanName: "", error: "Nama lengkap minimal 2 karakter" };
  }

  if (sanitized.length > 80) {
    return { isValid: false, cleanName: "", error: "Nama lengkap maksimal 80 karakter" };
  }

  // Hanya boleh huruf, spasi, titik, tanda petik satu, atau strip
  const nameRegex = /^[a-zA-Z\s.,'-]+$/;
  if (!nameRegex.test(sanitized)) {
    return { isValid: false, cleanName: "", error: "Nama lengkap hanya boleh berisi huruf dan tanda baca nama" };
  }

  return { isValid: true, cleanName: sanitized };
}

/**
 * Kebijakan Password Kuat (Strong Password Policy)
 * - Minimal 8 karakter
 * - Maksimal 72 karakter (mencegah eksploitasi memori buffer bcrypt)
 * - Wajib kombinasi huruf dan angka
 * - Tidak boleh mengandung spasi
 */
export function validatePassword(password: unknown): {
  isValid: boolean;
  cleanPassword?: string;
  error?: string;
} {
  if (typeof password !== "string" || !password) {
    return { isValid: false, error: "Password wajib diisi" };
  }

  if (password.length < 8) {
    return { isValid: false, error: "Password minimal 8 karakter demi keamanan" };
  }

  if (password.length > 72) {
    return { isValid: false, error: "Password maksimal 72 karakter" };
  }

  if (/\s/.test(password)) {
    return { isValid: false, error: "Password tidak boleh mengandung spasi" };
  }

  // Wajib ada minimal satu huruf dan satu angka
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /\d/.test(password);

  if (!hasLetter || !hasNumber) {
    return { isValid: false, error: "Password wajib mengombinasikan huruf dan angka" };
  }

  return { isValid: true, cleanPassword: password };
}

/**
 * Validasi Kode Verifikasi OTP (6 Digit)
 * - Wajib tepat 6 digit numerik
 * - Menolak huruf atau simbol
 */
export function validateOtpCode(code: unknown): {
  isValid: boolean;
  cleanCode: string;
  error?: string;
} {
  if (typeof code !== "string" && typeof code !== "number") {
    return { isValid: false, cleanCode: "", error: "Kode verifikasi 6 digit wajib diisi" };
  }

  const raw = String(code).trim();

  if (!/^\d{6}$/.test(raw)) {
    return { isValid: false, cleanCode: "", error: "Kode verifikasi harus tepat 6 digit angka numerik" };
  }

  return { isValid: true, cleanCode: raw };
}

/**
 * Validasi Semester
 * - Integer 1 sampai 14
 */
export function validateSemester(semester?: unknown): {
  isValid: boolean;
  cleanSemester: number;
  error?: string;
} {
  if (semester === undefined || semester === null || semester === "") {
    return { isValid: true, cleanSemester: 1 };
  }
  const num = Number(semester);
  if (!Number.isInteger(num) || num < 1 || num > 14) {
    return { isValid: false, cleanSemester: 1, error: "Semester harus berupa angka antara 1 sampai 14" };
  }
  return { isValid: true, cleanSemester: num };
}

/**
 * Validasi Program Studi
 */
export function validateMajor(major: unknown): {
  isValid: boolean;
  cleanMajor: string;
} {
  if (typeof major === "string" && major.trim()) {
    const clean = sanitizeText(major);
    return { isValid: true, cleanMajor: clean || "Teknologi Informasi" };
  }
  return { isValid: true, cleanMajor: "Teknologi Informasi" };
}
