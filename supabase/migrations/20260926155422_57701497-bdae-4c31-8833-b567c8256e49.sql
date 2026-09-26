create policy "Users upload own therapist-media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'therapist-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users read own therapist-media" on storage.objects
  for select to authenticated
  using (bucket_id = 'therapist-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Admins read therapist-media" on storage.objects
  for select to authenticated
  using (bucket_id = 'therapist-media' and public.has_role(auth.uid(), 'admin'));