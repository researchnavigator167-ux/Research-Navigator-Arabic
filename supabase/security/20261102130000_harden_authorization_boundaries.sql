/*
# Proposed authorization hardening patch (not applied)

This forward-only SQL is intentionally outside supabase/migrations because this
review forbids remote database changes. It preserves all existing tables and
rows while enforcing owner/editor/viewer, student/doctor, grading, and storage
boundaries. Copy into a reviewed migration only when a safe staging database is
available.

Product decisions recorded:
- Project membership administration is owner-only; the editor delegation rule
  is not defined by the existing product.
- Self-service role selection permits student only. Existing doctors remain;
  there is no operator-controlled doctor-promotion workflow in this repository.
*/

CREATE OR REPLACE FUNCTION public.current_project_role(p_project_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.project_members
  WHERE project_id = p_project_id AND user_id = (SELECT auth.uid()) LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.current_project_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_project_role(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_project_membership_escalation()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.role = 'owner' OR NEW.project_id <> OLD.project_id
    OR NEW.user_id <> OLD.user_id OR NEW.role NOT IN ('editor', 'viewer')) THEN
    RAISE EXCEPTION 'project membership change is not allowed';
  END IF;
  IF TG_OP = 'DELETE' AND OLD.role = 'owner' THEN
    RAISE EXCEPTION 'project owner membership cannot be removed';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.prevent_project_membership_escalation() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_prevent_project_membership_escalation ON public.project_members;
CREATE TRIGGER trg_prevent_project_membership_escalation BEFORE UPDATE OR DELETE
  ON public.project_members FOR EACH ROW EXECUTE FUNCTION public.prevent_project_membership_escalation();

DROP POLICY IF EXISTS "select_project_members" ON public.project_members;
CREATE POLICY "select_project_members" ON public.project_members FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, (SELECT auth.uid())));
DROP POLICY IF EXISTS "insert_project_members" ON public.project_members;
CREATE POLICY "insert_project_members" ON public.project_members FOR INSERT TO authenticated
  WITH CHECK (public.current_project_role(project_id) = 'owner' AND role IN ('editor', 'viewer')
    AND invited_by = (SELECT auth.uid()) AND user_id <> (SELECT auth.uid()));
DROP POLICY IF EXISTS "update_project_members" ON public.project_members;
CREATE POLICY "update_project_members" ON public.project_members FOR UPDATE TO authenticated
  USING (public.current_project_role(project_id) = 'owner' AND role <> 'owner')
  WITH CHECK (public.current_project_role(project_id) = 'owner' AND role IN ('editor', 'viewer'));
DROP POLICY IF EXISTS "delete_project_members" ON public.project_members;
CREATE POLICY "delete_project_members" ON public.project_members FOR DELETE TO authenticated
  USING ((user_id = (SELECT auth.uid()) AND role <> 'owner')
    OR (public.current_project_role(project_id) = 'owner' AND role <> 'owner'));

-- Owners and editors write shared content; viewers read only.
DROP POLICY IF EXISTS "insert_project_tasks" ON public.project_tasks;
CREATE POLICY "insert_project_tasks" ON public.project_tasks FOR INSERT TO authenticated
  WITH CHECK (public.current_project_role(project_id) IN ('owner', 'editor'));
DROP POLICY IF EXISTS "update_project_tasks" ON public.project_tasks;
CREATE POLICY "update_project_tasks" ON public.project_tasks FOR UPDATE TO authenticated
  USING (public.current_project_role(project_id) IN ('owner', 'editor'))
  WITH CHECK (public.current_project_role(project_id) IN ('owner', 'editor'));
DROP POLICY IF EXISTS "delete_project_tasks" ON public.project_tasks;
CREATE POLICY "delete_project_tasks" ON public.project_tasks FOR DELETE TO authenticated
  USING (public.current_project_role(project_id) IN ('owner', 'editor'));
DROP POLICY IF EXISTS "insert_project_comments" ON public.project_comments;
CREATE POLICY "insert_project_comments" ON public.project_comments FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND public.current_project_role(project_id) IN ('owner', 'editor'));
DROP POLICY IF EXISTS "update_project_comments" ON public.project_comments;
CREATE POLICY "update_project_comments" ON public.project_comments FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()) AND public.current_project_role(project_id) IN ('owner', 'editor'));
DROP POLICY IF EXISTS "delete_project_comments" ON public.project_comments;
CREATE POLICY "delete_project_comments" ON public.project_comments FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.current_project_role(project_id) = 'owner');
DROP POLICY IF EXISTS "insert_project_files" ON public.project_files;
CREATE POLICY "insert_project_files" ON public.project_files FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = (SELECT auth.uid()) AND public.current_project_role(project_id) IN ('owner', 'editor'));
DROP POLICY IF EXISTS "update_project_files" ON public.project_files;
CREATE POLICY "update_project_files" ON public.project_files FOR UPDATE TO authenticated
  USING (public.current_project_role(project_id) IN ('owner', 'editor'))
  WITH CHECK (public.current_project_role(project_id) IN ('owner', 'editor'));
DROP POLICY IF EXISTS "delete_project_files" ON public.project_files;
CREATE POLICY "delete_project_files" ON public.project_files FOR DELETE TO authenticated
  USING (public.current_project_role(project_id) IN ('owner', 'editor'));
DROP POLICY IF EXISTS "insert_project_events" ON public.project_events;
CREATE POLICY "insert_project_events" ON public.project_events FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()) AND public.current_project_role(project_id) IN ('owner', 'editor'));
DROP POLICY IF EXISTS "update_project_events" ON public.project_events;
CREATE POLICY "update_project_events" ON public.project_events FOR UPDATE TO authenticated
  USING (public.current_project_role(project_id) IN ('owner', 'editor'))
  WITH CHECK (public.current_project_role(project_id) IN ('owner', 'editor'));
DROP POLICY IF EXISTS "delete_project_events" ON public.project_events;
CREATE POLICY "delete_project_events" ON public.project_events FOR DELETE TO authenticated
  USING (public.current_project_role(project_id) IN ('owner', 'editor'));

CREATE OR REPLACE FUNCTION public.prevent_client_role_change()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.role <> 'student' THEN
    RAISE EXCEPTION 'only student self-registration is allowed';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.role <> OLD.role THEN
    RAISE EXCEPTION 'user role cannot be changed through the client';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.prevent_client_role_change() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_prevent_client_role_change ON public.user_roles;
CREATE TRIGGER trg_prevent_client_role_change BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_client_role_change();
DROP POLICY IF EXISTS "insert_own_role" ON public.user_roles;
CREATE POLICY "insert_own_role" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND role = 'student');

CREATE OR REPLACE FUNCTION public.is_assignment_doctor(p_assignment_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.assignments a JOIN public.classes c ON c.id = a.class_id
    WHERE a.id = p_assignment_id AND c.doctor_id = p_user_id);
$$;
REVOKE ALL ON FUNCTION public.is_assignment_doctor(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_assignment_doctor(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_student_submission_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NOT public.is_assignment_doctor(NEW.assignment_id, (SELECT auth.uid())) THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.assignment_id := OLD.assignment_id; NEW.student_id := OLD.student_id; NEW.version := OLD.version;
    END IF;
    NEW.status := 'submitted'; NEW.grade := NULL; NEW.graded_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_student_submission_fields() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_protect_student_submission_fields ON public.assignment_submissions;
CREATE TRIGGER trg_protect_student_submission_fields BEFORE INSERT OR UPDATE
  ON public.assignment_submissions FOR EACH ROW EXECUTE FUNCTION public.protect_student_submission_fields();
DROP POLICY IF EXISTS "update_submissions_student" ON public.assignment_submissions;
CREATE POLICY "update_submissions_student" ON public.assignment_submissions FOR UPDATE TO authenticated
  USING (student_id = (SELECT auth.uid())) WITH CHECK (student_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "update_submissions_doctor" ON public.assignment_submissions;
CREATE POLICY "update_submissions_doctor" ON public.assignment_submissions FOR UPDATE TO authenticated
  USING (public.is_assignment_doctor(assignment_id, (SELECT auth.uid())))
  WITH CHECK (public.is_assignment_doctor(assignment_id, (SELECT auth.uid())));

CREATE OR REPLACE FUNCTION public.project_id_from_storage_path(p_name text)
RETURNS uuid LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF (storage.foldername(p_name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RETURN (storage.foldername(p_name))[1]::uuid;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.project_id_from_storage_path(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_id_from_storage_path(text) TO authenticated;

-- Project paths are <project_uuid>/<filename>.
DROP POLICY IF EXISTS "project_files_upload" ON storage.objects;
CREATE POLICY "project_files_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-files' AND
    public.current_project_role(public.project_id_from_storage_path(name)) IN ('owner', 'editor'));
DROP POLICY IF EXISTS "project_files_read" ON storage.objects;
CREATE POLICY "project_files_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'project-files' AND
    public.current_project_role(public.project_id_from_storage_path(name)) IS NOT NULL);
DROP POLICY IF EXISTS "project_files_delete" ON storage.objects;
CREATE POLICY "project_files_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'project-files' AND
    public.current_project_role(public.project_id_from_storage_path(name)) IN ('owner', 'editor'));
DROP POLICY IF EXISTS "project_files_update" ON storage.objects;
CREATE POLICY "project_files_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'project-files' AND
    public.current_project_role(public.project_id_from_storage_path(name)) IN ('owner', 'editor'))
  WITH CHECK (bucket_id = 'project-files' AND
    public.current_project_role(public.project_id_from_storage_path(name)) IN ('owner', 'editor'));

-- Classroom paths are class-submissions/<class_uuid>/<student_uuid>/<filename>.
CREATE POLICY "class_submission_files_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-files' AND (storage.foldername(name))[1] = 'class-submissions'
    AND public.is_class_member((storage.foldername(name))[2]::uuid, (SELECT auth.uid()))
    AND (storage.foldername(name))[3]::uuid = (SELECT auth.uid()));
CREATE POLICY "class_submission_files_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'project-files' AND (storage.foldername(name))[1] = 'class-submissions'
    AND (public.is_class_doctor((storage.foldername(name))[2]::uuid, (SELECT auth.uid()))
      OR (storage.foldername(name))[3]::uuid = (SELECT auth.uid())));
CREATE POLICY "class_submission_files_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'project-files' AND (storage.foldername(name))[1] = 'class-submissions'
    AND (public.is_class_doctor((storage.foldername(name))[2]::uuid, (SELECT auth.uid()))
      OR (storage.foldername(name))[3]::uuid = (SELECT auth.uid())));
CREATE POLICY "class_submission_files_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'project-files' AND (storage.foldername(name))[1] = 'class-submissions'
    AND (public.is_class_doctor((storage.foldername(name))[2]::uuid, (SELECT auth.uid()))
      OR (storage.foldername(name))[3]::uuid = (SELECT auth.uid())))
  WITH CHECK (bucket_id = 'project-files' AND (storage.foldername(name))[1] = 'class-submissions'
    AND (public.is_class_doctor((storage.foldername(name))[2]::uuid, (SELECT auth.uid()))
      OR (storage.foldername(name))[3]::uuid = (SELECT auth.uid())));
