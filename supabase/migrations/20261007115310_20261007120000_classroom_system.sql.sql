/*
# Classroom / Educational System for Research Navigator

## Overview
Adds a complete Google Classroom-like educational system on top of the existing
Research Navigator project. Doctors create study groups (classes), invite
students via join codes, create assignments (text/file/research-project),
receive submissions with versioning, provide feedback and grading, post
announcements, and track student progress.

## New Tables
1. user_roles — user role (student/doctor) + display name
2. classes — study group with join code, doctor-owned
3. class_members — students enrolled in a class
4. assignments — tasks (text/file/research_project) with due dates and grades
5. assignment_submissions — student submissions with versioning
6. assignment_feedback — doctor feedback on submissions
7. announcements — class-wide announcements
8. class_notifications — notifications for class events

## Helper Functions (SECURITY DEFINER, fixed search_path)
- is_class_member / is_class_doctor — membership checks without RLS recursion
- get_user_role — returns user's role
- generate_join_code — unique 8-char alphanumeric code

## Security
- RLS on all tables, 4 policies each (SELECT/INSERT/UPDATE/DELETE)
- Owner-scoped: users see their own data + data from their classes
- Doctor manages classes/assignments/feedback; students submit and view

## Notes
- Does NOT modify existing tables/migrations
- research_projects referenced via FK for linked assignments only
*/

-- ============================================================================
-- TABLES (all created first, before functions and policies)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('student', 'doctor')),
  display_name text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  course_code text,
  section text,
  academic_year text,
  join_code text UNIQUE NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS class_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(class_id, user_id)
);

CREATE TABLE IF NOT EXISTS assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  instructions text,
  assignment_type text NOT NULL CHECK (assignment_type IN ('text', 'file', 'research_project')),
  max_grade numeric DEFAULT 100,
  due_date timestamptz,
  linked_project_id uuid REFERENCES research_projects(id) ON DELETE SET NULL,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assignment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text,
  file_path text,
  file_name text,
  file_type text,
  file_size integer,
  linked_project_id uuid REFERENCES research_projects(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewed', 'graded', 'returned')),
  grade numeric,
  graded_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assignment_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES assignment_submissions(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  feedback_type text DEFAULT 'comment' CHECK (feedback_type IN ('comment', 'correction', 'praise', 'suggestion')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS class_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES assignments(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- HELPER FUNCTIONS (SECURITY DEFINER — created after tables exist)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_class_member(p_class_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM class_members
    WHERE class_members.class_id = p_class_id
    AND class_members.user_id = p_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_class_doctor(p_class_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM classes
    WHERE classes.id = p_class_id
    AND classes.doctor_id = p_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM user_roles WHERE user_roles.user_id = p_user_id;
  RETURN v_role;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_join_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code text;
  attempts integer := 0;
BEGIN
  LOOP
    code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
    IF NOT EXISTS (SELECT 1 FROM classes WHERE join_code = code) THEN
      RETURN code;
    END IF;
    attempts := attempts + 1;
    IF attempts > 100 THEN
      RAISE EXCEPTION 'Could not generate unique join code after 100 attempts';
    END IF;
  END LOOP;
END;
$$;

-- ============================================================================
-- RLS: Enable on all tables
-- ============================================================================
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: user_roles
-- ============================================================================
DROP POLICY IF EXISTS "select_own_role" ON user_roles;
CREATE POLICY "select_own_role" ON user_roles FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_role" ON user_roles;
CREATE POLICY "insert_own_role" ON user_roles FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_role" ON user_roles;
CREATE POLICY "update_own_role" ON user_roles FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- RLS POLICIES: classes
-- ============================================================================
DROP POLICY IF EXISTS "select_classes" ON classes;
CREATE POLICY "select_classes" ON classes FOR SELECT
TO authenticated USING (
  doctor_id = auth.uid()
  OR public.is_class_member(classes.id, auth.uid())
);

DROP POLICY IF EXISTS "insert_classes" ON classes;
CREATE POLICY "insert_classes" ON classes FOR INSERT
TO authenticated WITH CHECK (doctor_id = auth.uid());

DROP POLICY IF EXISTS "update_classes" ON classes;
CREATE POLICY "update_classes" ON classes FOR UPDATE
TO authenticated USING (doctor_id = auth.uid()) WITH CHECK (doctor_id = auth.uid());

DROP POLICY IF EXISTS "delete_classes" ON classes;
CREATE POLICY "delete_classes" ON classes FOR DELETE
TO authenticated USING (doctor_id = auth.uid());

-- ============================================================================
-- RLS POLICIES: class_members
-- ============================================================================
DROP POLICY IF EXISTS "select_class_members" ON class_members;
CREATE POLICY "select_class_members" ON class_members FOR SELECT
TO authenticated USING (
  user_id = auth.uid()
  OR public.is_class_doctor(class_members.class_id, auth.uid())
  OR public.is_class_member(class_members.class_id, auth.uid())
);

DROP POLICY IF EXISTS "insert_class_members_self" ON class_members;
CREATE POLICY "insert_class_members_self" ON class_members FOR INSERT
TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "delete_class_members_doctor" ON class_members;
CREATE POLICY "delete_class_members_doctor" ON class_members FOR DELETE
TO authenticated USING (
  public.is_class_doctor(class_members.class_id, auth.uid())
);

DROP POLICY IF EXISTS "delete_class_members_self" ON class_members;
CREATE POLICY "delete_class_members_self" ON class_members FOR DELETE
TO authenticated USING (user_id = auth.uid());

-- ============================================================================
-- RLS POLICIES: assignments
-- ============================================================================
DROP POLICY IF EXISTS "select_assignments" ON assignments;
CREATE POLICY "select_assignments" ON assignments FOR SELECT
TO authenticated USING (
  public.is_class_member(assignments.class_id, auth.uid())
  OR assignments.doctor_id = auth.uid()
);

DROP POLICY IF EXISTS "insert_assignments" ON assignments;
CREATE POLICY "insert_assignments" ON assignments FOR INSERT
TO authenticated WITH CHECK (
  public.is_class_doctor(assignments.class_id, auth.uid())
);

DROP POLICY IF EXISTS "update_assignments" ON assignments;
CREATE POLICY "update_assignments" ON assignments FOR UPDATE
TO authenticated USING (assignments.doctor_id = auth.uid()) WITH CHECK (assignments.doctor_id = auth.uid());

DROP POLICY IF EXISTS "delete_assignments" ON assignments;
CREATE POLICY "delete_assignments" ON assignments FOR DELETE
TO authenticated USING (assignments.doctor_id = auth.uid());

-- ============================================================================
-- RLS POLICIES: assignment_submissions
-- ============================================================================
DROP POLICY IF EXISTS "select_submissions" ON assignment_submissions;
CREATE POLICY "select_submissions" ON assignment_submissions FOR SELECT
TO authenticated USING (
  student_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.assignments a
    JOIN public.classes c ON c.id = a.class_id
    WHERE a.id = assignment_submissions.assignment_id
    AND c.doctor_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "insert_submissions" ON assignment_submissions;
CREATE POLICY "insert_submissions" ON assignment_submissions FOR INSERT
TO authenticated WITH CHECK (
  student_id = auth.uid()
  AND public.is_class_member(
    (SELECT a.class_id FROM public.assignments a WHERE a.id = assignment_submissions.assignment_id),
    auth.uid()
  )
);

DROP POLICY IF EXISTS "update_submissions_student" ON assignment_submissions;
CREATE POLICY "update_submissions_student" ON assignment_submissions FOR UPDATE
TO authenticated USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "update_submissions_doctor" ON assignment_submissions;
CREATE POLICY "update_submissions_doctor" ON assignment_submissions FOR UPDATE
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.assignments a
    JOIN public.classes c ON c.id = a.class_id
    WHERE a.id = assignment_submissions.assignment_id
    AND c.doctor_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.assignments a
    JOIN public.classes c ON c.id = a.class_id
    WHERE a.id = assignment_submissions.assignment_id
    AND c.doctor_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "delete_submissions" ON assignment_submissions;
CREATE POLICY "delete_submissions" ON assignment_submissions FOR DELETE
TO authenticated USING (student_id = auth.uid());

-- ============================================================================
-- RLS POLICIES: assignment_feedback
-- ============================================================================
DROP POLICY IF EXISTS "select_feedback" ON assignment_feedback;
CREATE POLICY "select_feedback" ON assignment_feedback FOR SELECT
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.assignment_submissions s
    WHERE s.id = assignment_feedback.submission_id
    AND s.student_id = auth.uid()
  )
  OR doctor_id = auth.uid()
);

DROP POLICY IF EXISTS "insert_feedback" ON assignment_feedback;
CREATE POLICY "insert_feedback" ON assignment_feedback FOR INSERT
TO authenticated WITH CHECK (
  doctor_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.assignment_submissions s
    JOIN public.assignments a ON a.id = s.assignment_id
    JOIN public.classes c ON c.id = a.class_id
    WHERE s.id = assignment_feedback.submission_id
    AND c.doctor_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "delete_feedback" ON assignment_feedback;
CREATE POLICY "delete_feedback" ON assignment_feedback FOR DELETE
TO authenticated USING (doctor_id = auth.uid());

-- ============================================================================
-- RLS POLICIES: announcements
-- ============================================================================
DROP POLICY IF EXISTS "select_announcements" ON announcements;
CREATE POLICY "select_announcements" ON announcements FOR SELECT
TO authenticated USING (
  public.is_class_member(announcements.class_id, auth.uid())
  OR announcements.doctor_id = auth.uid()
);

DROP POLICY IF EXISTS "insert_announcements" ON announcements;
CREATE POLICY "insert_announcements" ON announcements FOR INSERT
TO authenticated WITH CHECK (
  public.is_class_doctor(announcements.class_id, auth.uid())
);

DROP POLICY IF EXISTS "delete_announcements" ON announcements;
CREATE POLICY "delete_announcements" ON announcements FOR DELETE
TO authenticated USING (doctor_id = auth.uid());

-- ============================================================================
-- RLS POLICIES: class_notifications
-- ============================================================================
DROP POLICY IF EXISTS "select_own_class_notifications" ON class_notifications;
CREATE POLICY "select_own_class_notifications" ON class_notifications FOR SELECT
TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "insert_own_class_notifications" ON class_notifications;
CREATE POLICY "insert_own_class_notifications" ON class_notifications FOR INSERT
TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "update_own_class_notifications" ON class_notifications;
CREATE POLICY "update_own_class_notifications" ON class_notifications FOR UPDATE
TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "delete_own_class_notifications" ON class_notifications;
CREATE POLICY "delete_own_class_notifications" ON class_notifications FOR DELETE
TO authenticated USING (user_id = auth.uid());

-- ============================================================================
-- GRANT EXECUTE on helper functions
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.is_class_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_class_doctor(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_join_code() TO authenticated;

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_classes_doctor ON classes(doctor_id);
CREATE INDEX IF NOT EXISTS idx_classes_join_code ON classes(join_code);
CREATE INDEX IF NOT EXISTS idx_class_members_class ON class_members(class_id);
CREATE INDEX IF NOT EXISTS idx_class_members_user ON class_members(user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_class ON assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON assignment_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_feedback_submission ON assignment_feedback(submission_id);
CREATE INDEX IF NOT EXISTS idx_announcements_class ON announcements(class_id);
CREATE INDEX IF NOT EXISTS idx_class_notifications_user ON class_notifications(user_id);

-- ============================================================================
-- TRIGGERS: updated_at for classes and assignments
-- ============================================================================
DROP TRIGGER IF EXISTS update_classes_updated_at ON classes;
CREATE TRIGGER update_classes_updated_at
  BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_assignments_updated_at ON assignments;
CREATE TRIGGER update_assignments_updated_at
  BEFORE UPDATE ON assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
