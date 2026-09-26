create policy "Chat participants read shared therapist-media" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'therapist-media'
    and exists (
      select 1 from public.therapist_messages m
      where m.media_path = storage.objects.name
        and public.is_chat_participant(m.chat_id, auth.uid())
    )
  );