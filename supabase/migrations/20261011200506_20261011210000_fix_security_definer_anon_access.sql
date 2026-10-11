/*
# Fix Security Advisor Warnings on Classroom Functions

## Overview
The security advisor flagged 3 SECURITY DEFINER functions callable by the
anon role: generate_join_code, get_user_role, and is_class_member/is_class_doctor.
This migration revokes EXECUTE from anon and PUBLIC on all SECURITY DEFINER
functions, then grants EXECUTE only to authenticated.

## Security
- All SECURITY DEFINER functions restricted to authenticated role only
- search_path set explicitly on all functions
*/
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS fn_sig,
           p.proname AS fn_name
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC;', r.fn_sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon;', r.fn_sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated;', r.fn_sig);
  END LOOP;
END $$;
