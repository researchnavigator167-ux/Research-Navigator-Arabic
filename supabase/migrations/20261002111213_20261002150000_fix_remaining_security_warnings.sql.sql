/*
# Fix remaining security advisor warnings

## Overview
The previous migration revoked EXECUTE from anon/authenticated but PostgreSQL still grants
to PUBLIC by default. This migration:
1. Revokes EXECUTE from PUBLIC on auto_add_project_owner (trigger-only, should never be called via API)
2. Changes auto_add_project_owner to SECURITY INVOKER (trigger still works — triggers run as table owner)
3. Revokes EXECUTE from PUBLIC on get_user_id_by_email, then grants only to authenticated

## Security
- auto_add_project_owner: SECURITY INVOKER, no direct execute grants — only callable via trigger
- get_user_id_by_email: SECURITY DEFINER, only authenticated can execute
*/

ALTER FUNCTION public.auto_add_project_owner() SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.auto_add_project_owner() FROM PUBLIC;

REVOKE ALL ON FUNCTION public.get_user_id_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO authenticated;
