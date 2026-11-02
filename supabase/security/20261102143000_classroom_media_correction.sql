/*
# Classroom media corrective SQL (not applied)

1. Purpose
- Allow the existing assignments table to store video and audio assignments.
- Keep all existing rows and migration history unchanged.
- Restrict classroom submission files to the class/student path already used by the app.

2. Database change
- Replace only the assignment type CHECK constraint with the forward-compatible list:
  text, file, video, audio, research_project.

3. Storage security
- Remove the original bucket-wide project-files policies before recreating scoped policies.
- Students may upload only inside class-submissions/<class_id>/<their_user_id>/.
- Students may read/delete/update their own submission files.
- The doctor who owns the class may read/delete/update files submitted in that class.

4. Important
- This file is intentionally outside supabase/migrations and has not been applied.
- Review and apply only on an approved staging or production change process.
- The frontend cannot make a student a doctor; database RLS remains authoritative.
*/

ALTER TABLE public.assignments
  DROP CONSTRAINT IF EXISTS assignments_assignment_type_check;

ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_assignment_type_check
  CHECK (assignment_type IN ('text', 'file', 'video', 'audio', 'research_project'));

DROP POLICY IF EXISTS "project_files_upload" ON storage.objects;
DROP POLICY IF EXISTS "project_files_read" ON storage.objects;
DROP POLICY IF EXISTS "project_files_delete" ON storage.objects;
DROP POLICY IF EXISTS "project_files_update" ON storage.objects;

DROP POLICY IF EXISTS "class_submission_files_upload" ON storage.objects;
CREATE POLICY "class_submission_files_upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'project-files'
  AND (storage.foldername(name))[1] = 'class-submissions'
  AND public.is_class_member((storage.foldername(name))[2]::uuid, auth.uid())
  AND (storage.foldername(name))[3]::uuid = auth.uid()
);

DROP POLICY IF EXISTS "class_submission_files_read" ON storage.objects;
CREATE POLICY "class_submission_files_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'project-files'
  AND (storage.foldername(name))[1] = 'class-submissions'
  AND (
    public.is_class_doctor((storage.foldername(name))[2]::uuid, auth.uid())
    OR (storage.foldername(name))[3]::uuid = auth.uid()
  )
);

DROP POLICY IF EXISTS "class_submission_files_delete" ON storage.objects;
CREATE POLICY "class_submission_files_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'project-files'
  AND (storage.foldername(name))[1] = 'class-submissions'
  AND (
    public.is_class_doctor((storage.foldername(name))[2]::uuid, auth.uid())
    OR (storage.foldername(name))[3]::uuid = auth.uid()
  )
);

DROP POLICY IF EXISTS "class_submission_files_update" ON storage.objects;
CREATE POLICY "class_submission_files_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'project-files'
  AND (storage.foldername(name))[1] = 'class-submissions'
  AND (
    public.is_class_doctor((storage.foldername(name))[2]::uuid, auth.uid())
    OR (storage.foldername(name))[3]::uuid = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'project-files'
  AND (storage.foldername(name))[1] = 'class-submissions'
  AND (
    public.is_class_doctor((storage.foldername(name))[2]::uuid, auth.uid())
    OR (storage.foldername(name))[3]::uuid = auth.uid()
  )
);
