-- 로컬 분석 워커가 녹화 한 건을 원자적으로 집어간다.
-- 대상: 업로드 완료(uploaded) 또는 분석 중인데 오래 멈춘(stale) 녹화. skip locked로 워커 여러 개가 겹치지 않는다.
create or replace function public.claim_next_recording(p_stale_minutes integer default 6)
returns table (id uuid, attempt integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidate as (
    select recording.id
      from recordings recording
     where recording.status = 'uploaded'
        or (
          recording.status = 'analyzing'
          and recording.analysis_started_at < now() - make_interval(mins => p_stale_minutes)
        )
     order by recording.created_at
     limit 1
     for update skip locked
  )
  update recordings target
     set status = 'analyzing',
         analysis_started_at = now(),
         analysis_attempt = target.analysis_attempt + 1,
         error = null
    from candidate
   where target.id = candidate.id
  returning target.id, target.analysis_attempt;
end;
$$;

revoke all on function public.claim_next_recording(integer) from public, anon, authenticated;
