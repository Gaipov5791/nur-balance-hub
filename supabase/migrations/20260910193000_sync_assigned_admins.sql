-- Two personal accounts stay distinct:
-- desktop bakyt.gaipov.kk@gmail.com = admin
-- phone   gaipovbakyt097@gmail.com = ordinary user
-- Replace both emails when the customer account is assigned.

DROP FUNCTION IF EXISTS public.claim_first_admin();

CREATE OR REPLACE FUNCTION public.sync_assigned_admins()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id uuid;
  member_id uuid;
BEGIN
  SELECT id INTO admin_id
  FROM auth.users
  WHERE lower(email) = 'bakyt.gaipov.kk@gmail.com'
  LIMIT 1;

  SELECT id INTO member_id
  FROM auth.users
  WHERE lower(email) = 'gaipovbakyt097@gmail.com'
  LIMIT 1;

  IF admin_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (admin_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  IF member_id IS NOT NULL THEN
    DELETE FROM public.user_roles
    WHERE user_id = member_id
      AND role IN ('admin', 'moderator');
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_assigned_admins() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_assigned_admins() TO authenticated, service_role;
