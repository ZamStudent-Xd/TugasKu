-- TugasKu (StudyTrack) - Initial Schema & Super-Safe RLS Policies
-- PostgreSQL / Supabase Migration
-- Versi 2.0: Mendukung profil mahasiswa BSI, poin progres matakuliah, kolaborasi kelompok, dan RLS tingkat tinggi

-- 1. PROFILES TABLE (Profil Mahasiswa Terhubung ke Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  nim TEXT,
  major TEXT DEFAULT 'Teknologi Informasi',
  semester INTEGER DEFAULT 1 CHECK (semester >= 1 AND semester <= 14),
  campus TEXT DEFAULT 'Universitas BSI (Bina Sarana Informatika)',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger to create profile automatically on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, nim, major, semester, campus, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'nim',
    COALESCE(NEW.raw_user_meta_data->>'major', 'Teknologi Informasi'),
    COALESCE((NEW.raw_user_meta_data->>'semester')::integer, 1),
    COALESCE(NEW.raw_user_meta_data->>'campus', 'Universitas BSI (Bina Sarana Informatika)'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://api.dicebear.com/7.x/bottts/svg?seed=' || COALESCE(NEW.raw_user_meta_data->>'nim', NEW.id::text))
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    nim = COALESCE(EXCLUDED.nim, public.profiles.nim),
    major = COALESCE(EXCLUDED.major, public.profiles.major),
    semester = COALESCE(EXCLUDED.semester, public.profiles.semester),
    campus = COALESCE(EXCLUDED.campus, public.profiles.campus),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. COURSES TABLE (Mata Kuliah)
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 100),
  lecturer TEXT CHECK (char_length(lecturer) <= 100),
  code TEXT CHECK (char_length(code) <= 30),
  color TEXT NOT NULL DEFAULT 'indigo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courses_owner_id ON public.courses(owner_id);

-- 3. TASKS TABLE (Tugas Kuliah)
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) >= 1 AND char_length(title) <= 150),
  description TEXT,
  task_type TEXT NOT NULL CHECK (task_type IN ('individual', 'group')) DEFAULT 'individual',
  progress INTEGER NOT NULL CHECK (progress >= 0 AND progress <= 100) DEFAULT 0,
  points INTEGER NOT NULL CHECK (points >= 0 AND points <= 100) DEFAULT 25,
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_course_id ON public.tasks(course_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON public.tasks(deadline);

-- 4. TASK MEMBERS TABLE (Kolaborasi Tugas Kelompok)
CREATE TABLE IF NOT EXISTS public.task_members (
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')) DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_members_user_id ON public.task_members(user_id);

-- 5. TASK INVITATIONS TABLE (Undangan Anggota Tugas Kelompok)
CREATE TABLE IF NOT EXISTS public.task_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')) DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_invitations_task_id ON public.task_invitations(task_id);
CREATE INDEX IF NOT EXISTS idx_task_invitations_token_hash ON public.task_invitations(token_hash);

-- Auto updated_at timestamp trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_profiles ON public.profiles;
CREATE TRIGGER trigger_update_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_update_courses ON public.courses;
CREATE TRIGGER trigger_update_courses BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_update_tasks ON public.tasks;
CREATE TRIGGER trigger_update_tasks BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Keamanan super ketat: Setiap pengguna hanya dapat mengakses datanya sendiri
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_invitations ENABLE ROW LEVEL SECURITY;

-- PROFILES RLS
DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- COURSES RLS
DROP POLICY IF EXISTS "Users can view own courses" ON public.courses;
CREATE POLICY "Users can view own courses"
  ON public.courses FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own courses" ON public.courses;
CREATE POLICY "Users can insert own courses"
  ON public.courses FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own courses" ON public.courses;
CREATE POLICY "Users can update own courses"
  ON public.courses FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own courses" ON public.courses;
CREATE POLICY "Users can delete own courses"
  ON public.courses FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- TASKS RLS (Owner and assigned members have access)
DROP POLICY IF EXISTS "Users can view assigned or owned tasks" ON public.tasks;
CREATE POLICY "Users can view assigned or owned tasks"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.task_members
      WHERE task_members.task_id = tasks.id AND task_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Course owner can insert tasks" ON public.tasks;
CREATE POLICY "Course owner can insert tasks"
  ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = tasks.course_id AND courses.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Task owner or member can update task progress" ON public.tasks;
CREATE POLICY "Task owner or member can update task progress"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.task_members
      WHERE task_members.task_id = tasks.id AND task_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Only task owner can delete tasks" ON public.tasks;
CREATE POLICY "Only task owner can delete tasks"
  ON public.tasks FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- TASK MEMBERS RLS
DROP POLICY IF EXISTS "Members viewable by task participants" ON public.task_members;
CREATE POLICY "Members viewable by task participants"
  ON public.task_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_members.task_id AND (
        tasks.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.task_members tm
          WHERE tm.task_id = tasks.id AND tm.user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Task owner can manage members" ON public.task_members;
CREATE POLICY "Task owner can manage members"
  ON public.task_members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_members.task_id AND tasks.created_by = auth.uid()
    )
  );

-- TASK INVITATIONS RLS
DROP POLICY IF EXISTS "Task owner can manage invitations" ON public.task_invitations;
CREATE POLICY "Task owner can manage invitations"
  ON public.task_invitations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_invitations.task_id AND tasks.created_by = auth.uid()
    )
  );
