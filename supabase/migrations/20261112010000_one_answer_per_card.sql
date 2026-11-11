-- 질문 카드 하나에 답변은 하나만. 동시에 답해도 DB가 두 번째 행을 막는다.
-- 이미 중복으로 쌓인 답변은 가장 먼저 저장된 것만 남긴다.
delete from public.clarification_answers duplicate
 using public.clarification_answers original
 where duplicate.card_id = original.card_id
   and (duplicate.created_at, duplicate.id) > (original.created_at, original.id);

alter table public.clarification_answers
  add constraint clarification_answers_card_id_key unique (card_id);
