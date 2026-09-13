-- Two admins: developer + customer.
-- Phone gaipovbakyt097@gmail.com stays an ordinary user.

CREATE OR REPLACE FUNCTION public.sync_assigned_admins()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_email text;
  admin_id uuid;
  member_id uuid;
BEGIN
  FOREACH admin_email IN ARRAY ARRAY[
    'bakyt.gaipov.kk@gmail.com',
    'eskarinovaayaulym00@mail.ru'
  ]
  LOOP
    SELECT id INTO admin_id
    FROM auth.users
    WHERE lower(email) = admin_email
    LIMIT 1;

    IF admin_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (admin_id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END LOOP;

  SELECT id INTO member_id
  FROM auth.users
  WHERE lower(email) = 'gaipovbakyt097@gmail.com'
  LIMIT 1;

  IF member_id IS NOT NULL THEN
    DELETE FROM public.user_roles
    WHERE user_id = member_id
      AND role IN ('admin', 'moderator');
  END IF;

  RETURN true;
END;
$$;