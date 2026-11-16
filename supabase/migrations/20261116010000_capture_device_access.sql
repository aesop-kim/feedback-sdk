alter table public.messages add column capture_device_hash text
  check (capture_device_hash is null or (type = 'capture' and capture_device_hash ~ '^[0-9a-f]{64}$'));

-- 네 인자 호출도 허용해 기존 위젯의 전송과 재시도를 유지한다.
drop function public.insert_capture_message(uuid, uuid, text, text);

create function public.insert_capture_message(p_id uuid, p_conversation_id uuid, p_body text, p_path text, p_device_hash text default null)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  message_time timestamptz;
begin
  insert into public.messages (id, conversation_id, sender, type, body, capture_path, capture_device_hash)
  values (p_id, p_conversation_id, 'user', 'capture', p_body, p_path, p_device_hash)
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
      and capture_device_hash is not distinct from p_device_hash
  ) then
    return false;
  end if;
  return null;
end;
$$;

revoke execute on function public.insert_capture_message(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.insert_capture_message(uuid, uuid, text, text, text) to service_role;
