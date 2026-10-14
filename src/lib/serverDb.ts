import fs from "fs";
import path from "path";
import { UserProfile, Course, Task, TaskInvitation } from "@/types";

interface DbSchema {
  profiles: UserProfile[];
  accounts: { user: UserProfile; passwordHash: string }[];
  courses: Course[];
  tasks: Task[];
  invitations: TaskInvitation[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "tugasku-db.json");

function ensureDbFile(): DbSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const emptyDb: DbSchema = {
      profiles: [],
      accounts: [],
      courses: [],
      tasks: [],
      invitations: [],
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(emptyDb, null, 2), "utf-8");
    return emptyDb;
  }

  try {
    const content = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    const fallbackDb: DbSchema = {
      profiles: [],
      accounts: [],
      courses: [],
      tasks: [],
      invitations: [],
    };
    return fallbackDb;
  }
}

function saveDb(data: DbSchema): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export function getServerDb(): DbSchema {
  return ensureDbFile();
}

export function saveServerDb(data: DbSchema): void {
  saveDb(data);
}

/**
 * Simpan atau perbarui akun mahasiswa yang terdaftar
 */
export function saveRegisteredStudentToDb(user: UserProfile, passwordHash: string): void {
  const db = ensureDbFile();
  const cleanEmail = user.email.toLowerCase().trim();

  // Update profiles
  const profileIndex = db.profiles.findIndex((p) => p.email.toLowerCase().trim() === cleanEmail);
  if (profileIndex >= 0) {
    db.profiles[profileIndex] = user;
  } else {
    db.profiles.push(user);
  }

  // Update accounts
  const accountIndex = db.accounts.findIndex((a) => a.user.email.toLowerCase().trim() === cleanEmail);
  if (accountIndex >= 0) {
    db.accounts[accountIndex] = { user, passwordHash };
  } else {
    db.accounts.push({ user, passwordHash });
  }

  saveDb(db);
}

/**
 * Cari mahasiswa terdaftar berdasarkan nama atau NIM
 */
export function searchRegisteredStudentsFromDb(query: string): UserProfile[] {
  const db = ensureDbFile();
  const clean = query.toLowerCase().trim();
  // Wajib melakukan pencarian mulai dari 1 huruf baru pengguna muncul
  if (!clean || clean.length < 1) return [];

  return db.profiles.filter(
    (p) =>
      p.fullName.toLowerCase().includes(clean) ||
      (p.nim && p.nim.toLowerCase().includes(clean)) ||
      p.email.toLowerCase().includes(clean)
  );
}

export function getAllStudentsFromDb(): UserProfile[] {
  const db = ensureDbFile();
  return db.profiles;
}
