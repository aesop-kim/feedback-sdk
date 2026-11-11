-- 업로드가 끝나지 않은 녹화(새로고침·이탈)를 일정 시간 뒤 failed로 바꾼다.
-- 기준 시각은 업로드 주소를 마지막으로 발급한 때(다시 보내기를 하면 새로 잡힌다).
alter table public.recordings
  add column upload_requested_at timestamptz not null default now();

update public.recordings set upload_requested_at = created_at;

create or replace function public.expire_stale_uploads(p_stale_minutes integer default 30)
returns table (id uuid, conversation_id uuid, project_id uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update recordings target
     set status = 'failed',
         error = '업로드가 끝나지 않았어요. 고객이 업로드 중에 페이지를 떠났을 수 있어요. 다시 녹화해 달라고 요청해 주세요'
    from conversations conversation
   where conversation.id = target.conversation_id
     and target.status = 'uploading'
     and target.upload_requested_at < now() - make_interval(mins => p_stale_minutes)
  returning target.id, target.conversation_id, conversation.project_id;
end;
$$;

revoke all on function public.expire_stale_uploads(integer) from public, anon, authenticated;
