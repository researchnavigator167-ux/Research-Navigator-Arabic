/*
# Fix security advisor warnings on SECURITY DEFINER functions

## Overview
The security advisor flagged that SECURITY DEFINER functions are callable by the anon role.
This migration:
1. Revokes EXECUTE from anon on all SECURITY DEFINER functions
2. Sets search_path on functions with mutable search_path
3. Changes get_project_member_role to SECURITY INVOKER (it reads project_members which
   already has RLS allowing members to read — SECURITY DEFINER is not needed)

## Security
- auto_add_project_owner: trigger-only function, REVOKE from all roles except owner
- get_project_member_role: changed to SECURITY INVOKER, only authenticated can call
- get_user_id_by_email: remains SECURITY DEFINER (reads auth.users), only authenticated can call
- All functions get explicit search_path = public
*/

-- Fix search_path and permissions on update_updated_at
ALTER FUNCTION public.update_updated_at() SET search_path = public;

-- Fix get_project_member_role: change to SECURITY INVOKER, set search_path, restrict to authenticated
ALTER FUNCTION public.get_project_member_role(p_project_id uuid, p_user_id uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_project_member_role(p_project_id uuid, p_user_id uuid) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.get_project_member_role(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_project_member_role(uuid, uuid) TO authenticated;

-- Fix auto_add_project_owner: set search_path, revoke from anon and authenticated (trigger-only)
ALTER FUNCTION public.auto_add_project_owner() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.auto_add_project_owner() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_add_project_owner() FROM authenticated;

-- Fix get_user_id_by_email: already has search_path = auth, restrict to authenticated only
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO authenticated;
