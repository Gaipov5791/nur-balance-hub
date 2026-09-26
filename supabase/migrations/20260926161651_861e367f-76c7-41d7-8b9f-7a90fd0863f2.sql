CREATE TABLE public.therapist_contacts (
  therapist_id uuid PRIMARY KEY REFERENCES public.therapists(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  instagram text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.therapist_contacts TO authenticated;
GRANT ALL ON public.therapist_contacts TO service_role;
ALTER TABLE public.therapist_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read therapist contacts" ON public.therapist_contacts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins add therapist contacts" ON public.therapist_contacts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins edit therapist contacts" ON public.therapist_contacts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins remove therapist contacts" ON public.therapist_contacts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER therapist_contacts_set_updated_at BEFORE UPDATE ON public.therapist_contacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.therapist_contacts (therapist_id, email, phone, instagram)
SELECT id,
       coalesce(nullif(contact_email, ''), substring(bio from '[[:alnum:]._%+-]+@[[:alnum:].-]+[.][[:alpha:]]{2,}'), ''),
       coalesce(substring(bio from '\+7[[:space:]()0-9-]{10,}'), ''),
       coalesce(substring(bio from '(?i)instagram:[[:space:]]*(@[[:alnum:]_.]+)'), '')
FROM public.therapists
WHERE coalesce(contact_email, '') <> '' OR bio ~* '(instagram[[:space:]]*:|номер[[:space:]]*:|для записи[[:space:]]*:|почта[[:space:]]*:|[[:alnum:]._%+-]+@[[:alnum:].-]+[.][[:alpha:]]{2,}|\+7[[:space:]()0-9-]{10,})';

UPDATE public.therapists AS t
SET bio = coalesce((
  SELECT trim(both E'\n ' from string_agg(line, E'\n' ORDER BY ord))
  FROM unnest(string_to_array(t.bio, E'\n')) WITH ORDINALITY AS lines(line, ord)
  WHERE line !~* '(instagram[[:space:]]*:|номер[[:space:]]*:|для записи[[:space:]]*:|почта[[:space:]]*:|[[:alnum:]._%+-]+@[[:alnum:].-]+[.][[:alpha:]]{2,}|\+7[[:space:]()0-9-]{10,})'
), ''), contact_email = NULL
WHERE coalesce(t.contact_email, '') <> '' OR t.bio ~* '(instagram[[:space:]]*:|номер[[:space:]]*:|для записи[[:space:]]*:|почта[[:space:]]*:|[[:alnum:]._%+-]+@[[:alnum:].-]+[.][[:alpha:]]{2,}|\+7[[:space:]()0-9-]{10,})';

CREATE FUNCTION public.prevent_public_therapist_contacts() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF new.contact_email IS NOT NULL AND btrim(new.contact_email) <> '' THEN
    RAISE EXCEPTION 'Store therapist contact email in therapist_contacts';
  END IF;
  IF new.bio ~* '(instagram[[:space:]]*:|номер[[:space:]]*:|для записи[[:space:]]*:|почта[[:space:]]*:|[[:alnum:]._%+-]+@[[:alnum:].-]+[.][[:alpha:]]{2,}|\+7[[:space:]()0-9-]{10,})' THEN
    RAISE EXCEPTION 'Store therapist contact details in therapist_contacts';
  END IF;
  RETURN new;
END;
$$;
CREATE TRIGGER prevent_public_therapist_contacts BEFORE INSERT OR UPDATE OF bio, contact_email ON public.therapists FOR EACH ROW EXECUTE FUNCTION public.prevent_public_therapist_contacts();