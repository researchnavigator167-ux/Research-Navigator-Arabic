/*
# Add helper function to look up user ID by email

## Overview
The collaboration invite feature needs to find a user's UUID by their email address.
The auth.users table is not accessible via the anon key due to RLS, so a SECURITY DEFINER
function is required to perform this lookup server-side.

## New Functions
- get_user_id_by_email: Returns the user UUID for a given email, or NULL if not found.
  SECURITY DEFINER so it can read auth.users. Only returns the id — no other user data.

## Security
- Function is SECURITY DEFINER, runs with elevated privileges
- Only returns the user's UUID, nothing else
- Accessible to authenticated users only
*/

CREATE OR REPLACE FUNCTION get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = auth
AS $$
  SELECT id FROM auth.users WHERE email = lower(p_email);
$$;

GRANT EXECUTE ON FUNCTION get_user_id_by_email(text) TO authenticated;
