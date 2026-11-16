alter table public.messages
  add column capture_path text,
  drop constraint messages_type_check,
  add constraint messages_type_check
    check (type in ('text', 'recording', 'clarification', 'system', 'capture')),
  add constraint messages_capture_path_check
    check ((type = 'capture') = (capture_path is not null));

-- 파일 업로드 재시도와 별도로, 메시지·미리보기·안읽음 수는 한 번만 함께 기록한다.
create function public.insert_capture_message(p_id uuid, p_conversation_id uuid, p_body text, p_path text)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  message_time timestamptz;
begin
  insert into public.messages (id, conversation_id, sender, type, body, capture_path)
  values (p_id, p_conversation_id, 'user', 'capture', p_body, p_path)
  on conflict (id) do nothing
  returning created_at into message_time;

  if found then
    update public.conversations
    set admin_unread_count = admin_unread_count + 1,
        last_message_preview = case when message_time >= last_message_at
          then left(coalesce(p_body, '화면 캡처'), 120)
          else last_message_preview
        end,
        last_message_at = greatest(last_message_at, message_time)
    where id = p_conversation_id;
    return true;
  end if;

  if exists (
    select 1 from public.messages
    where id = p_id and conversation_id = p_conversation_id and capture_path = p_path
      and body is not distinct from p_body
  ) then
    return false;
  end if;
  return null;
end;
$$;

revoke execute on function public.insert_capture_message(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.insert_capture_message(uuid, uuid, text, text) to service_role;
