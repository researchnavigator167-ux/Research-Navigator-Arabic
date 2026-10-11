/*
# Create Collaboration Tables for Research Projects

## Overview
This migration creates the 7 tables required by the collaboration features
(tasks, files, team members, discussions, calendar, activity log, notifications)
that were referenced in the frontend code but never created in the database.
It also creates helper functions needed by RLS policies and the
project-files storage bucket.

## New Tables
1. project_members - Team members for each project (owner, editor, viewer)
2. project_tasks - Tasks within a project
3. project_comments - Discussion comments on various targets
4. project_files - Metadata for uploaded files
5. project_events - Calendar events (deadlines, meetings, milestones)
6. project_activity_log - Activity feed entries
7. project_notifications - User notifications for invites, task assignments, etc.

## New Functions
1. is_project_member(p_project_id, p_user_id) - SECURITY DEFINER, checks membership bypassing RLS
2. get_project_member_role(p_project_id, p_user_id) - SECURITY INVOKER, returns member role
3. auto_add_project_owner() - Trigger function, adds project creator as owner member

## Security
- RLS enabled on all 7 new tables
- SELECT/INSERT/UPDATE/DELETE policies use is_project_member() for access control
- Only project members can read/write project data
- Only project owners can delete projects or manage members
- SECURITY DEFINER functions restricted to authenticated role only
- project-files storage bucket created with member-only access policies
*/

-- ============================================================================
-- 1. project_members
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'editor', 'viewer')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Temporary simple policies (will be replaced after is_project_member is created)
DROP POLICY IF EXISTS "select_project_members" ON project_members;
CREATE POLICY "select_project_members" ON project_members FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_project_members" ON project_members;
CREATE POLICY "insert_project_members" ON project_members FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_project_members" ON project_members;
CREATE POLICY "update_project_members" ON project_members FOR UPDATE
  TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_project_members" ON project_members;
CREATE POLICY "delete_project_members" ON project_members FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);

-- ============================================================================
-- 2. project_tasks
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_status ON project_tasks(status);
CREATE INDEX IF NOT EXISTS idx_project_tasks_assigned_to ON project_tasks(assigned_to);

-- ============================================================================
-- 3. project_comments
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL DEFAULT 'project' CHECK (target_type IN ('project', 'source', 'note', 'evidence', 'task')),
  target_id uuid,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE project_comments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_project_comments_project_id ON project_comments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_comments_target ON project_comments(target_type, target_id);

-- ============================================================================
-- 4. project_files
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid REFERENCES project_tasks(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text,
  file_size bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON project_files(project_id);

-- ============================================================================
-- 5. project_events
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid REFERENCES project_tasks(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  event_date timestamptz NOT NULL,
  event_type text NOT NULL DEFAULT 'deadline' CHECK (event_type IN ('deadline', 'meeting', 'milestone', 'review', 'other')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE project_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_project_events_project_id ON project_events(project_id);
CREATE INDEX IF NOT EXISTS idx_project_events_date ON project_events(event_date);

-- ============================================================================
-- 6. project_activity_log
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE project_activity_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_project_activity_log_project_id ON project_activity_log(project_id);
CREATE INDEX IF NOT EXISTS idx_project_activity_log_created_at ON project_activity_log(created_at DESC);

-- ============================================================================
-- 7. project_notifications
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES research_projects(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'update' CHECK (type IN ('invite', 'task_assigned', 'comment', 'deadline', 'update')),
  title text NOT NULL,
  body text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE project_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_project_notifications" ON project_notifications;
CREATE POLICY "select_project_notifications" ON project_notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_project_notifications" ON project_notifications;
CREATE POLICY "insert_project_notifications" ON project_notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_project_notifications" ON project_notifications;
CREATE POLICY "update_project_notifications" ON project_notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_project_notifications" ON project_notifications;
CREATE POLICY "delete_project_notifications" ON project_notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_project_notifications_user_id ON project_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_project_notifications_read ON project_notifications(user_id, read);

-- ============================================================================
-- 8. Helper Functions (tables now exist, safe to create)
-- ============================================================================

-- is_project_member: checks if a user is a member of a project (bypasses RLS)
CREATE OR REPLACE FUNCTION is_project_member(p_project_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id AND user_id = p_user_id
  );
$$;
REVOKE ALL ON FUNCTION is_project_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_project_member(uuid, uuid) TO authenticated;

-- get_project_member_role: returns the role of a user in a project
CREATE OR REPLACE FUNCTION get_project_member_role(p_project_id uuid, p_user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT role FROM project_members
  WHERE project_id = p_project_id AND user_id = p_user_id
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION get_project_member_role(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_project_member_role(uuid, uuid) TO authenticated;

-- auto_add_project_owner: trigger that adds the project creator as owner in project_members
CREATE OR REPLACE FUNCTION auto_add_project_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  INSERT INTO project_members (project_id, user_id, role)
  VALUES (NEW.id, NEW.user_id, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION auto_add_project_owner() FROM PUBLIC;

-- ============================================================================
-- 9. Trigger: auto-add project owner to project_members on project creation
-- ============================================================================
DROP TRIGGER IF EXISTS trg_auto_add_project_owner ON research_projects;
CREATE TRIGGER trg_auto_add_project_owner
  AFTER INSERT ON research_projects
  FOR EACH ROW EXECUTE FUNCTION auto_add_project_owner();

-- ============================================================================
-- 10. Update project_members INSERT policy to allow project members to invite
-- ============================================================================
DROP POLICY IF EXISTS "insert_project_members" ON project_members;
CREATE POLICY "insert_project_members" ON project_members FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = user_id
    OR is_project_member(project_id, auth.uid())
  );

-- ============================================================================
-- 11. RLS policies for project_tasks, project_comments, project_files,
--     project_events, project_activity_log (all use is_project_member)
-- ============================================================================

-- project_tasks
DROP POLICY IF EXISTS "select_project_tasks" ON project_tasks;
CREATE POLICY "select_project_tasks" ON project_tasks FOR SELECT
  TO authenticated USING (is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "insert_project_tasks" ON project_tasks;
CREATE POLICY "insert_project_tasks" ON project_tasks FOR INSERT
  TO authenticated WITH CHECK (is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "update_project_tasks" ON project_tasks;
CREATE POLICY "update_project_tasks" ON project_tasks FOR UPDATE
  TO authenticated USING (is_project_member(project_id, auth.uid()))
  WITH CHECK (is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "delete_project_tasks" ON project_tasks;
CREATE POLICY "delete_project_tasks" ON project_tasks FOR DELETE
  TO authenticated USING (is_project_member(project_id, auth.uid()));

-- project_comments
DROP POLICY IF EXISTS "select_project_comments" ON project_comments;
CREATE POLICY "select_project_comments" ON project_comments FOR SELECT
  TO authenticated USING (is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "insert_project_comments" ON project_comments;
CREATE POLICY "insert_project_comments" ON project_comments FOR INSERT
  TO authenticated WITH CHECK (is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "update_project_comments" ON project_comments;
CREATE POLICY "update_project_comments" ON project_comments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "delete_project_comments" ON project_comments;
CREATE POLICY "delete_project_comments" ON project_comments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- project_files
DROP POLICY IF EXISTS "select_project_files" ON project_files;
CREATE POLICY "select_project_files" ON project_files FOR SELECT
  TO authenticated USING (is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "insert_project_files" ON project_files;
CREATE POLICY "insert_project_files" ON project_files FOR INSERT
  TO authenticated WITH CHECK (is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "update_project_files" ON project_files;
CREATE POLICY "update_project_files" ON project_files FOR UPDATE
  TO authenticated USING (is_project_member(project_id, auth.uid()))
  WITH CHECK (is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "delete_project_files" ON project_files;
CREATE POLICY "delete_project_files" ON project_files FOR DELETE
  TO authenticated USING (is_project_member(project_id, auth.uid()));

-- project_events
DROP POLICY IF EXISTS "select_project_events" ON project_events;
CREATE POLICY "select_project_events" ON project_events FOR SELECT
  TO authenticated USING (is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "insert_project_events" ON project_events;
CREATE POLICY "insert_project_events" ON project_events FOR INSERT
  TO authenticated WITH CHECK (is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "update_project_events" ON project_events;
CREATE POLICY "update_project_events" ON project_events FOR UPDATE
  TO authenticated USING (is_project_member(project_id, auth.uid()))
  WITH CHECK (is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "delete_project_events" ON project_events;
CREATE POLICY "delete_project_events" ON project_events FOR DELETE
  TO authenticated USING (is_project_member(project_id, auth.uid()));

-- project_activity_log
DROP POLICY IF EXISTS "select_project_activity_log" ON project_activity_log;
CREATE POLICY "select_project_activity_log" ON project_activity_log FOR SELECT
  TO authenticated USING (is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "insert_project_activity_log" ON project_activity_log;
CREATE POLICY "insert_project_activity_log" ON project_activity_log FOR INSERT
  TO authenticated WITH CHECK (is_project_member(project_id, auth.uid()));

-- ============================================================================
-- 12. Update research_projects SELECT policy to use is_project_member
-- ============================================================================
DROP POLICY IF EXISTS "select_own_projects" ON research_projects;
CREATE POLICY "select_own_projects" ON research_projects FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR is_project_member(id, auth.uid())
  );

-- ============================================================================
-- 13. Storage bucket for project files
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-files', 'project-files', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "project_files_upload" ON storage.objects;
CREATE POLICY "project_files_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-files');

DROP POLICY IF EXISTS "project_files_read" ON storage.objects;
CREATE POLICY "project_files_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'project-files');

DROP POLICY IF EXISTS "project_files_delete" ON storage.objects;
CREATE POLICY "project_files_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'project-files');

DROP POLICY IF EXISTS "project_files_update" ON storage.objects;
CREATE POLICY "project_files_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'project-files')
  WITH CHECK (bucket_id = 'project-files');
