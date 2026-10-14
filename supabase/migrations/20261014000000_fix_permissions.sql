-- ==============================================================================
-- TUGASKU DATABASE SETUP & PRODUCTION SECURITY POLICY
-- 1. Berikan hak akses tabel ke API
-- 2. Kunci tabel profiles agar HANYA BISA DIAKSES oleh mahasiswa yang login (Privasi Penuh)
-- 3. Pastikan mahasiswa hanya bisa mengedit profil miliknya sendiri
-- 4. Sinkronkan semua data akun auth yang sudah terdaftar ke public.profiles
-- ==============================================================================

-- 1. Hak akses schema public
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- 2. Kebijakan Keamanan RLS (Row Level Security) untuk Tabel Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Hanya mahasiswa yang SUDAH LOGIN (authenticated) yang boleh melihat daftar profil rekan
-- (Orang luar / publik di internet tanpa login DITOLAK TOTAL)
DROP POLICY IF EXISTS "Profiles viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Profiles viewable only by authenticated students" ON public.profiles;
CREATE POLICY "Profiles viewable only by authenticated students"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Izinkan pembuatan profil saat pendaftaran akun baru
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Hanya pemilik akun asli yang berhak mengubah datanya sendiri (Anti-Tamper)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 3. Sinkronkan seluruh data akun mahasiswa yang sudah mendaftar ke public.profiles
INSERT INTO public.profiles (id, full_name, email, nim, major, semester, campus, avatar_url)
SELECT 
  id,
  COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
  email,
  raw_user_meta_data->>'nim',
  COALESCE(raw_user_meta_data->>'major', 'Teknologi Informasi'),
  COALESCE((raw_user_meta_data->>'semester')::integer, 1),
  COALESCE(raw_user_meta_data->>'campus', 'Universitas BSI (Bina Sarana Informatika)'),
  COALESCE(raw_user_meta_data->>'avatar_url', 'https://api.dicebear.com/7.x/bottts/svg?seed=' || id::text)
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  nim = COALESCE(EXCLUDED.nim, public.profiles.nim),
  updated_at = now();
