/*
# Harden exposed database functions

1. Purpose
- Remove the mutable search_path warning from `public.update_updated_at`.
- Stop exposing SECURITY DEFINER functions directly through the public RPC surface.
- Preserve existing RLS behavior and application flows that use the helper functions.

2. Security design
- Create a `private` schema for privileged implementation functions.
- Revoke direct schema access from PUBLIC, anon, and authenticated, then grant only the minimum schema and function access needed by authenticated calls through the public wrappers.
- Keep the privileged implementations fixed to explicit search paths.
- Replace public SECURITY DEFINER entry points with SECURITY INVOKER wrappers. The wrappers delegate only the existing, narrowly scoped operations to private implementations.

3. Existing objects modified
- `public.update_updated_at()` receives `SET search_path = public`.
- `public.generate_join_code()` becomes SECURITY INVOKER.
- `public.get_user_id_by_email(text)` becomes SECURITY INVOKER.
- `public.get_user_role(uuid)` becomes SECURITY INVOKER.
- `public.is_class_doctor(uuid, uuid)` becomes SECURITY INVOKER.
- `public.is_class_member(uuid, uuid)` becomes SECURITY INVOKER.
- `public.is_project_member(uuid, uuid)` becomes SECURITY INVOKER.

4. Data safety
- No tables, columns, rows, policies, or existing records are deleted or recreated.
- Existing RLS policies continue calling the same public function names.
*/

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.generate_join_code()
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
    IF NOT EXISTS (SELECT 1 FROM public.classes WHERE join_code = code) THEN
      RETURN code;
    END IF;
    attempts := attempts + 1;
    IF attempts > 100 THEN
      RAISE EXCEPTION 'Could not generate unique join code after 100 attempts';
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION private.get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = auth
AS $$
  SELECT id FROM auth.users WHERE email = lower(p_email);
$$;

CREATE OR REPLACE FUNCTION private.get_user_role(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.user_roles WHERE user_id = p_user_id;
  RETURN v_role;
END;
$$;

CREATE OR REPLACE FUNCTION private.is_class_doctor(p_class_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.classes
    WHERE id = p_class_id AND doctor_id = p_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.is_class_member(p_class_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.class_members
    WHERE class_id = p_class_id AND user_id = p_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.is_project_member(p_project_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = p_user_id
  );
$$;

REVOKE ALL ON FUNCTION private.generate_join_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.get_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.get_user_role(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.is_class_doctor(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.is_class_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.is_project_member(uuid, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION private.generate_join_code() TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_user_id_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_class_doctor(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_class_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_project_member(uuid, uuid) TO authenticated;

ALTER FUNCTION public.update_updated_at() SET search_path = public;

CREATE OR REPLACE FUNCTION public.generate_join_code()
RETURNS text
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$ SELECT private.generate_join_code(); $$;

CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$ SELECT private.get_user_id_by_email(p_email); $$;

CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$ SELECT private.get_user_role(p_user_id); $$;

CREATE OR REPLACE FUNCTION public.is_class_doctor(p_class_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$ SELECT private.is_class_doctor(p_class_id, p_user_id); $$;

CREATE OR REPLACE FUNCTION public.is_class_member(p_class_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$ SELECT private.is_class_member(p_class_id, p_user_id); $$;

CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$ SELECT private.is_project_member(p_project_id, p_user_id); $$;

REVOKE EXECUTE ON FUNCTION public.generate_join_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_class_doctor(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_class_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.generate_join_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_class_doctor(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_class_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) TO authenticated;
