revoke execute on function public.is_chat_participant(uuid, uuid) from anon, public;
revoke execute on function public.on_request_scheduled_create_chat() from anon, authenticated, public;
revoke execute on function public.on_therapist_message_notify() from anon, authenticated, public;