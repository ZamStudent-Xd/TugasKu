-- ==============================================================================
-- SCHEMA INISIALISASI UNTUK PROJECT SUPABASE BARU (TUGASKU APP)
-- Jalankan skrip ini sekali di SQL Editor Supabase Project Baru Anda
-- ==============================================================================

-- 1. Buat Tabel profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  nim TEXT,
  major TEXT DEFAULT 'Teknologi Informasi',
  semester INT DEFAULT 1,
  campus TEXT DEFAULT 'Universitas BSI (Bina Sarana Informatika)',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Berikan izin akses anon/public (RLS) untuk tabel profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles access" ON public.profiles;
CREATE POLICY "Public profiles access" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

-- 2. Buat Tabel collaboration_invitations
CREATE TABLE IF NOT EXISTS public.collaboration_invitations (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  task_title TEXT NOT NULL,
  course_name TEXT,
  invited_email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  invited_by TEXT NOT NULL,
  inviter_name TEXT,
  inviter_avatar TEXT,
  task_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Berikan izin akses anon/public (RLS) untuk tabel collaboration_invitations
ALTER TABLE public.collaboration_invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public collaboration_invitations access" ON public.collaboration_invitations;
CREATE POLICY "Public collaboration_invitations access" ON public.collaboration_invitations FOR ALL USING (true) WITH CHECK (true);

-- 3. Buat Tabel tasks (opsional/pendukung)
CREATE TABLE IF NOT EXISTS public.tasks (
  id TEXT PRIMARY KEY,
  course_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT DEFAULT 'individual',
  progress INT DEFAULT 0,
  points INT,
  deadline TIMESTAMPTZ,
  created_by TEXT,
  members JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public tasks access" ON public.tasks;
CREATE POLICY "Public tasks access" ON public.tasks FOR ALL USING (true) WITH CHECK (true);

-- 4. Buat Tabel courses (opsional/pendukung)
CREATE TABLE IF NOT EXISTS public.courses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  lecturer TEXT,
  color TEXT,
  owner_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public courses access" ON public.courses;
CREATE POLICY "Public courses access" ON public.courses FOR ALL USING (true) WITH CHECK (true);

-- 5. Aktifkan Realtime Publication untuk sinkronisasi seketika
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.collaboration_invitations;

-- 6. BERIKAN HAK AKSES TABEL (GRANT PERMISSIONS) KE ANON & AUTHENTICATED
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
