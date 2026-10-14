const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Baca dari .env.local jika ada
function getEnvConfig() {
  const envPath = path.join(process.cwd(), '.env.local');
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  let anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
        url = trimmed.split('=')[1].trim();
      } else if (trimmed.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
        anonKey = trimmed.split('=')[1].trim();
      }
    }
  }
  return { url, anonKey };
}

const { url, anonKey } = getEnvConfig();

if (!url || !anonKey) {
  console.error("Konfigurasi Supabase tidak ditemukan di .env.local atau environment variable.");
  process.exit(1);
}

const supabase = createClient(url, anonKey);

async function syncAll() {
  const dbPath = path.join(process.cwd(), 'data', 'tugasku-db.json');
  if (!fs.existsSync(dbPath)) {
    console.log('Database tugasku-db.json tidak ditemukan.');
    return;
  }

  const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  console.log(`Menemukan ${db.accounts.length} akun terdaftar di data lokal/server.`);

  for (const acc of db.accounts) {
    const { user, passwordHash } = acc;
    console.log(`\nMenyinkronkan akun: ${user.fullName} (${user.email})...`);

    const { data: authRes, error: authErr } = await supabase.auth.signUp({
      email: user.email,
      password: passwordHash,
      options: {
        data: {
          full_name: user.fullName,
          nim: user.nim,
          major: user.major,
          semester: user.semester,
          campus: user.campus,
          avatar_url: user.avatarUrl,
        }
      }
    });

    if (authErr) {
      console.warn(`  Auth note: ${authErr.message}`);
    } else {
      console.log(`  Auth success: User ID ${authRes.user?.id || 'registered'}`);
    }

    const userId = authRes?.user?.id;
    if (userId) {
      const { error: profErr } = await supabase.from('profiles').upsert({
        id: userId,
        full_name: user.fullName,
        email: user.email,
        nim: user.nim,
        major: user.major,
        semester: user.semester,
        campus: user.campus,
        avatar_url: user.avatarUrl,
      });

      if (profErr) {
        console.warn(`  Profiles table note: ${profErr.message} (code: ${profErr.code})`);
      } else {
        console.log(`  Profiles table: Berhasil disimpan ke tabel public.profiles!`);
      }
    }
  }
}

syncAll();
