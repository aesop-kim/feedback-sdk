-- 다시 정리하기가 관리자가 이미 처리한 이슈를 지우지 않게 한다.
-- 반영 완료(resolved)·재확인(reverify)·해결됨(closed) 이슈가 있으면 기존 결과를 그대로 둔다.
-- 지우면 처리 기록이 사라지고, 재확인 녹화의 reverify_issue_id가 on delete set null로 끊긴다.
-- 재분석 라우트도 같은 조건으로 409를 돌려주지만, 그사이 상태가 바뀐 경우를 여기서 한 번 더 막는다.
create or replace function public.replace_recording_issues(
  p_recording_id uuid,
  p_attempt integer,
  p_transcript jsonb,
  p_issues jsonb
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_attempt integer;
  target_conversation_id uuid;
  issue_item jsonb;
  new_issue_id uuid;
  inserted_count integer := 0;
begin
  select analysis_attempt, conversation_id
    into current_attempt, target_conversation_id
    from recordings
   where id = p_recording_id
   for update;

  if current_attempt is null then
    raise exception 'recording % not found', p_recording_id;
  end if;
  if current_attempt <> p_attempt then
    raise exception 'stale analysis attempt % (current %)', p_attempt, current_attempt;
  end if;
  if exists (
    select 1
      from clarification_cards card
      join issues issue on issue.id = card.issue_id
     where issue.recording_id = p_recording_id
       and card.approved_at is not null
  ) then
    raise exception 'recording % has approved clarification cards', p_recording_id;
  end if;
  if exists (
    select 1
      from issues issue
     where issue.recording_id = p_recording_id
       and issue.status in ('resolved', 'reverify', 'closed')
  ) then
    raise exception 'recording % has progressed issues', p_recording_id;
  end if;

  delete from issues where recording_id = p_recording_id;

  for issue_item in select * from jsonb_array_elements(p_issues)
  loop
    insert into issues (
      recording_id, conversation_id, t_ms, quote, element, frame_path,
      title, summary, suggestion, confidence, sort_order
    ) values (
      p_recording_id,
      target_conversation_id,
      (issue_item ->> 't_ms')::integer,
      issue_item ->> 'quote',
      issue_item -> 'element',
      issue_item ->> 'frame_path',
      issue_item ->> 'title',
      issue_item ->> 'summary',
      issue_item ->> 'suggestion',
      issue_item ->> 'confidence',
      inserted_count
    )
    returning id into new_issue_id;

    if issue_item ? 'clarification' and jsonb_typeof(issue_item -> 'clarification') = 'object' then
      insert into clarification_cards (issue_id, question, options, highlight)
      values (
        new_issue_id,
        issue_item -> 'clarification' ->> 'question',
        issue_item -> 'clarification' -> 'options',
        issue_item -> 'clarification' -> 'highlight'
      );
    end if;

    inserted_count := inserted_count + 1;
  end loop;

  update recordings
     set status = 'analyzed',
         transcript = p_transcript,
         error = null
   where id = p_recording_id;

  return inserted_count;
end;
$$;

revoke all on function public.replace_recording_issues(uuid, integer, jsonb, jsonb) from public, anon, authenticated;
