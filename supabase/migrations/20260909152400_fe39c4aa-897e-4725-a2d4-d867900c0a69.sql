ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'therapist';

CREATE TABLE public.therapists (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  name text NOT NULL,
  initials text NOT NULL DEFAULT '',
  spec text NOT NULL DEFAULT '',
  experience text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  price_label text NOT NULL DEFAULT '',
  languages text NOT NULL DEFAULT '',
  photo_url text,
  contact_email text,
  is_verified boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.therapists TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.therapists TO authenticated;
GRANT ALL ON public.therapists TO service_role;

ALTER TABLE public.therapists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in reads active therapists"
  ON public.therapists FOR SELECT TO authenticated
  USING (is_active OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert therapists"
  ON public.therapists FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update therapists"
  ON public.therapists FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete therapists"
  ON public.therapists FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER therapists_set_updated_at
  BEFORE UPDATE ON public.therapists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.therapist_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE RESTRICT,
  client_name text NOT NULL DEFAULT '',
  contact text NOT NULL DEFAULT '',
  preferred_time text NOT NULL DEFAULT '',
  topic text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'new',
  admin_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT therapist_requests_status_check
    CHECK (status IN ('new','in_progress','scheduled','done','cancelled'))
);

CREATE INDEX therapist_requests_user_idx ON public.therapist_requests (user_id, created_at DESC);
CREATE INDEX therapist_requests_status_idx ON public.therapist_requests (status, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.therapist_requests TO authenticated;
GRANT ALL ON public.therapist_requests TO service_role;

ALTER TABLE public.therapist_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own requests"
  ON public.therapist_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all requests"
  ON public.therapist_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users create own requests"
  ON public.therapist_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'new');

CREATE POLICY "Users cancel own requests"
  ON public.therapist_requests FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND status IN ('new','cancelled'));

CREATE POLICY "Admins update requests"
  ON public.therapist_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER therapist_requests_set_updated_at
  BEFORE UPDATE ON public.therapist_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();