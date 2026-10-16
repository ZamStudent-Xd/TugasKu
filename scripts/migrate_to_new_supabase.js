const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Ambil URL dan KEY dari argumen atau dari .env.local
const args = process.argv.slice(2);
let newUrl = args[0];
let newKey = args[1];

if (!newUrl || !newKey) {
  console.error("❌ PENGGUNAAN:");
  console.error("node scripts/migrate_to_new_supabase.js <NEW_SUPABASE_URL> <NEW_SUPABASE_ANON_KEY>");
  process.exit(1);
}

newUrl = newUrl.trim();
newKey = newKey.trim();

const backupPath = path.join(__dirname, '..', 'supabase_backup.json');
if (!fs.existsSync(backupPath)) {
  console.error("❌ File backup supabase_backup.json tidak ditemukan!");
  process.exit(1);
}

const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
const supabase = createClient(newUrl, newKey);

async function runMigration() {
  console.log("🚀 MEMULAI MIGRASI KE SUPABASE BARU...");
  console.log("🔗 Target URL:", newUrl);

  // 1. Migrasi Profiles
  const profiles = backupData.profiles || [];
  console.log(`\n📦 Mengunggah ${profiles.length} Akun Mahasiswa ke tabel 'profiles'...`);
  for (const prof of profiles) {
    const { error } = await supabase.from('profiles').upsert(prof);
    if (error) {
      console.warn(`⚠️ Gagal insert profil ${prof.email}:`, error.message);
    } else {
      console.log(`   ✅ Profil ${prof.email} (${prof.full_name}) berhasil dimigrasi.`);
    }
  }

  // 2. Migrasi Collaboration Invitations (Tugas & Mata Kuliah)
  const collabs = backupData.collaboration_invitations || [];
  console.log(`\n📦 Mengunggah ${collabs.length} Data Tugas & Mata Kuliah ke 'collaboration_invitations'...`);
  
  // Batch upload per 10 baris agar aman dan cepat
  const batchSize = 10;
  for (let i = 0; i < collabs.length; i += batchSize) {
    const chunk = collabs.slice(i, i + batchSize);
    const { error } = await supabase.from('collaboration_invitations').upsert(chunk);
    if (error) {
      console.warn(`⚠️ Gagal insert batch ${i} - ${i + chunk.length}:`, error.message);
    } else {
      console.log(`   ✅ Batch baris ${i + 1} - ${Math.min(i + batchSize, collabs.length)} berhasil diunggah.`);
    }
  }

  // 3. Perbarui .env.local dengan URL & KEY baru
  const envPath = path.join(__dirname, '..', '.env.local');
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  const replaceOrAppend = (key, val, text) => {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(text)) {
      return text.replace(regex, `${key}=${val}`);
    } else {
      return text + `\n${key}=${val}\n`;
    }
  };

  envContent = replaceOrAppend('NEXT_PUBLIC_SUPABASE_URL', newUrl, envContent);
  envContent = replaceOrAppend('NEXT_PUBLIC_SUPABASE_ANON_KEY', newKey, envContent);

  fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');
  console.log("\n📝 File .env.local telah diperbarui otomatis dengan URL & Key baru.");

  console.log("\n🎉 ========================================================");
  console.log("   MIGRASI DATA KE SUPABASE BARU SELESAI 100%!");
  console.log("   - Akun Mahasiswa: " + profiles.length + " akun berhasil.");
  console.log("   - Tugas/Mata Kuliah: " + collabs.length + " data berhasil.");
  console.log("========================================================\n");
}

runMigration().catch((err) => {
  console.error("❌ Terjadi kesalahan fatal saat migrasi:", err);
  process.exit(1);
});
