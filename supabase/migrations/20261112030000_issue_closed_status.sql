-- 재확인까지 끝난 이슈를 닫는 최종 상태 'closed'.
-- 'resolved'는 "고쳤으니 고객에게 다시 확인을 부탁한 중"이라는 뜻으로 위젯 재확인 요청·재확인 녹화 연결이
-- 이 값에 기대고 있어서, 닫힘을 resolved에 표시로 얹지 않고 상태 하나를 더한다.
alter table public.issues drop constraint issues_status_check;
alter table public.issues
  add constraint issues_status_check
  check (status in ('open', 'asked', 'answered', 'resolved', 'reverify', 'closed'));
