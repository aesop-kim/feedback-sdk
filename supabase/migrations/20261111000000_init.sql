-- 피드백 SDK 초기 스키마
-- 모든 테이블은 RLS ON + anon 정책 0개. 접근은 서버(service role)와 로컬 분석 워커만 한다.

create extension if not exists pgcrypto;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  project_key text not null unique,
  name text not null,
  allowed_origins text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.end_users (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  external_id text not null,
  name text not null,
  email text,
  created_at timestamptz not null default now(),
  unique (project_id, external_id)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  end_user_id uuid not null references public.end_users (id) on delete cascade,
  last_message_at timestamptz not null default now(),
  last_message_preview text,
  admin_unread_count integer not null default 0,
  user_unread_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index conversations_project_recent_idx on public.conversations (project_id, last_message_at desc);

create table public.recordings (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  status text not null default 'uploading'
    check (status in ('uploading', 'uploaded', 'analyzing', 'analyzed', 'failed')),
  analysis_started_at timestamptz,
  analysis_attempt integer not null default 0,
  page_url text,
  page_title text,
  viewport jsonb,
  t0_epoch_ms bigint,
  duration_ms integer,
  audio_offset_ms integer not null default 0,
  frames jsonb not null default '[]',
  transcript jsonb,
  alignment_warning text,
  error text,
  reverify_issue_id uuid,
  created_at timestamptz not null default now()
);
create index recordings_status_idx on public.recordings (status);

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.recordings (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  t_ms integer not null,
  quote text not null,
  element jsonb,
  frame_path text,
  title text not null,
  summary text not null,
  suggestion text not null,
  confidence text not null check (confidence in ('clear', 'ambiguous')),
  status text not null default 'open' check (status in ('open', 'asked', 'answered', 'resolved', 'reverify')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index issues_recording_idx on public.issues (recording_id, sort_order);

alter table public.recordings
  add constraint recordings_reverify_issue_fk
  foreign key (reverify_issue_id) references public.issues (id) on delete set null;

create table public.clarification_cards (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null unique references public.issues (id) on delete cascade,
  question text not null,
  options jsonb not null,
  highlight jsonb,
  approved_at timestamptz,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender text not null check (sender in ('user', 'admin', 'system')),
  type text not null check (type in ('text', 'recording', 'clarification', 'system')),
  body text,
  recording_id uuid references public.recordings (id) on delete set null,
  clarification_card_id uuid references public.clarification_cards (id) on delete set null,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);
create unique index messages_one_per_recording_idx
  on public.messages (recording_id) where type = 'recording';

create table public.clarification_answers (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.clarification_cards (id) on delete cascade,
  option_id text,
  text text,
  recording_id uuid references public.recordings (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;
alter table public.end_users enable row level security;
alter table public.conversations enable row level security;
alter table public.recordings enable row level security;
alter table public.issues enable row level security;
alter table public.clarification_cards enable row level security;
alter table public.messages enable row level security;
alter table public.clarification_answers enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recordings',
  'recordings',
  false,
  52428800,
  array['video/webm', 'audio/webm', 'application/json', 'image/jpeg']
)
on conflict (id) do nothing;

-- 분석 결과를 한 트랜잭션으로 교체한다.
-- p_attempt가 현재 attempt와 다르면(오래된 작업자) 거부, 승인된 질문 카드가 있으면 거부.
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
