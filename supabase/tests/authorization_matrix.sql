/*
# Local authorization matrix (not a migration)

Run only against a disposable local Supabase/Postgres database after applying
the existing migrations and the proposed hardening patch. Supply psql variables:
owner_id, editor_id, viewer_id, student_id, doctor_id, other_user_id,
project_id, class_id, assignment_id, submission_id.
No production connection or credentials are required.
*/

SET LOCAL ROLE authenticated;

-- Owner: member list visible; membership administration is the only write path.
SELECT set_config('request.jwt.claim.sub', :'owner_id', true);
SELECT id, role FROM project_members WHERE project_id = :'project_id';

-- Editor: shared project reads and writes are allowed; membership administration is denied.
SELECT set_config('request.jwt.claim.sub', :'editor_id', true);
SELECT id FROM project_tasks WHERE project_id = :'project_id';
SELECT id FROM project_comments WHERE project_id = :'project_id';

-- Viewer: reads are allowed; task/comment/file/event INSERT, UPDATE, DELETE must affect zero rows or error.
SELECT set_config('request.jwt.claim.sub', :'viewer_id', true);
SELECT id FROM project_tasks WHERE project_id = :'project_id';

-- Student: own submission is visible and writable only for content/file fields;
-- attempts to set grade/status/graded_at are neutralized by the trigger.
SELECT set_config('request.jwt.claim.sub', :'student_id', true);
SELECT id, status, grade, graded_at FROM assignment_submissions WHERE id = :'submission_id';

-- Doctor: class submissions are readable and grading updates are allowed.
SELECT set_config('request.jwt.claim.sub', :'doctor_id', true);
SELECT id, status, grade, graded_at FROM assignment_submissions WHERE id = :'submission_id';

-- Unrelated user: project rows, member rows, and submissions must be invisible.
SELECT set_config('request.jwt.claim.sub', :'other_user_id', true);
SELECT id FROM project_tasks WHERE project_id = :'project_id';
SELECT id FROM project_members WHERE project_id = :'project_id';
SELECT id FROM assignment_submissions WHERE id = :'submission_id';

-- Negative write cases to execute in the local harness:
-- 1. Non-owner INSERT into project_members: must be denied.
-- 2. Non-owner UPDATE of a member role: must be denied.
-- 3. Any UPDATE/DELETE of the owner membership: must be denied.
-- 4. Student INSERT/UPDATE with role = 'doctor': must be denied.
-- 5. Student UPDATE setting grade/status/graded_at: must not change those fields.
-- 6. Viewer INSERT/UPDATE/DELETE on shared project tables: must be denied.
-- 7. Unrelated user storage SELECT/INSERT/UPDATE/DELETE: must be denied.

RESET ROLE;
