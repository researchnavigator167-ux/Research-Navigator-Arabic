/*
# Update research_projects SELECT policy to allow shared project members

## Overview
The existing RLS policy on research_projects only allows the owner (user_id = auth.uid()) to
select their projects. Now that collaboration is enabled, team members (editors/viewers) need
to be able to SELECT projects they've been invited to, even if they don't own them.

## Changes
- The SELECT policy on research_projects is updated to also allow users who are members
  of the project via project_members table.
- INSERT/UPDATE/DELETE policies remain owner-only (unchanged).

## Security
- Only the SELECT policy changes; ownership of the project row remains with the creator.
- Team members get read access to the project; write access to child tables (tasks, etc.)
  is governed by their role in project_members (checked in those tables' own policies).
*/

DROP POLICY IF EXISTS "select_own_projects" ON research_projects;
CREATE POLICY "select_own_projects" ON research_projects FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = research_projects.id AND pm.user_id = auth.uid()
    )
  );
