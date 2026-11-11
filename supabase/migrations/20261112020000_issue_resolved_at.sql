-- 반영 완료 시각. 위젯이 "가장 최근에 재확인을 부탁한 이슈"를 고를 때 쓴다.
alter table public.issues add column resolved_at timestamptz;

update public.issues set resolved_at = created_at where status in ('resolved', 'reverify');

create index issues_conversation_status_idx on public.issues (conversation_id, status);
