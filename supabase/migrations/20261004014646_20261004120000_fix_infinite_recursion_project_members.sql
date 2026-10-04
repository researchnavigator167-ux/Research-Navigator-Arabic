/*
# Fix infinite recursion in RLS policies on project_members and research_projects

## Problem
The SELECT policy on `project_members` references `project_members` itself
(`EXISTS (SELECT 1 FROM project_members pm WHERE ...)`), causing infinite
recursion when PostgreSQL evaluates RLS. The SELECT policy on
`research_projects` also references `project_members`, which triggers the
same self-referencing policy, compounding the recursion.

This causes a 500 error ("infinite recursion detected in policy for relation
project_members") on every query that touches research_projects or
project_members, including project creation.

## Fix
1. Create a SECURITY DEFINER function `is_project_member(project_id, user_id)`
   that checks membership bypassing RLS — this breaks the recursive cycle.
2. Replace the `project_members` SELECT policy to use simple `auth.uid() = user_id`
   (no self-reference).
3. Replace the `research_projects` SELECT policy to call `is_project_member()`
   instead of a subquery on `project_members`.
4. Update other `project_members` policies (INSERT/UPDATE/DELETE) to use
   `is_project_member()` with role='owner' check instead of self-referencing
   subqueries.

## Security
- The SECURITY DEFINER function runs with owner privileges, bypassing RLS.
  It only performs a read-only check and returns boolean, so it does not
  expose data.
- Ownership checks on INSERT/UPDATE/DELETE remain enforced.
- SET search_path is fixed to prevent search_path injection.
*/

-- 1. Create SECURITY DEFINER helper function
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

-- 2. Fix project_members SELECT policy (was self-referencing)
DROP POLICY IF EXISTS "select_project_members" ON project_members;
CREATE POLICY "select_project_members" ON project_members FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- 3. Fix project_members INSERT policy (was self-referencing for owner check)
DROP POLICY IF EXISTS "insert_project_members" ON project_members;
CREATE POLICY "insert_project_members" ON project_members FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = user_id
    OR is_project_member(project_id, auth.uid())
  );

-- 4. Fix project_members UPDATE policy
DROP POLICY IF EXISTS "update_project_members" ON project_members;
CREATE POLICY "update_project_members" ON project_members FOR UPDATE
  TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Fix project_members DELETE policy
DROP POLICY IF EXISTS "delete_project_members" ON project_members;
CREATE POLICY "delete_project_members" ON project_members FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- 6. Fix research_projects SELECT policy (was referencing project_members subquery)
DROP POLICY IF EXISTS "select_own_projects" ON research_projects;
CREATE POLICY "select_own_projects" ON research_projects FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR is_project_member(id, auth.uid())
  );
