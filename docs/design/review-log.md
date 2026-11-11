# 디자인 리뷰 로그

기준: `docs/design/tds-reference.md`(TDS), `.omc/plans/agent-brief.md`. 화면 근거는 E2E 캡처 `.screens/flow/*.png`(1440×900).

## Round 1 (기준 캡처 01~09를 보고)

### 위젯
- 질문 카드가 640px 패널보다 길어서, 테스트가 카드를 화면 안으로 끌어오면 장면(하이라이트)이 위로 밀려 사라짐 → 카드를 다시 짰다. 장면을 카드 위쪽 끝까지 붙인 16:9 창으로 두고(카드 안 여백 16px 절약), "확인하고 싶은 게 있어요" 머리말을 지웠다(질문과 같은 말을 두 번 함). 인용은 2줄까지 자르고 질문 바로 위에 4px 간격으로 붙였다. 보기 줄은 48px에서 44px로, 라디오는 22px에서 20px으로 줄였다.
- 새 질문 카드가 오면 목록이 맨 아래로 내려가 카드 아랫부분(보기, 버튼)만 보임 → 마지막 메시지가 아직 답하지 않은 질문 카드면, 카드 윗부분(장면과 질문)이 패널 위에서 12px 아래에 오도록 맞춘다(`MessageList`).
- 확대 하이라이트 테두리가 배율만큼 두꺼워짐(3배면 6px) → `--focus-scale`로 나눠서 어느 배율이든 2px로 보이게 했다. 이미지 비율과 창 비율이 달라도 영역 중심이 창 가운데에 오게 `getFocusTransform(highlight, aspect)`로 넓혔고, "전체 보기"는 장면 전체가 다 들어오도록 `getFitTransform`으로 줄여 보여 준다.
- 답한 뒤 칩이 "답변을 보냈어요 · 글씨가 너무 굵어요"인데, 바로 아래 고객 말풍선에 같은 답이 또 나옴 → 칩에는 "답변을 보냈어요"와 어떤 질문에 답했는지만 남겼다.
- 빈 화면: 위쪽 절반이 비어 있고, 헤더 제목과 본문 제목이 아래쪽에서 경쟁함 → 설명은 헤더 바로 아래, 녹화 버튼은 입력창 바로 위(TDS BottomCTA 배치)로 나눴다. 단계 번호의 회색 원과 위 구분선을 지우고 번호를 grey-400 숫자로만 남겼다. 힌트 문구를 한 문장씩으로: "최대 3분이에요. 글로 남기려면 아래에 적어 주세요".
- 런처가 파란 원 + 타원 말풍선, 전형적인 채팅 버튼 → 모서리가 둥근 사각 말풍선 안에 음성 파형 세 줄을 넣었다(이 위젯의 실제 쓰임인 "말로 설명"을 그림). 그림자를 `0 2px 10px / 14%`로 줄였다.
- 패널 그림자가 흰 고객사 화면 위에서 경계를 만들려고 진하게 깔림 → 1px 알파 hairline 테두리로 경계를 잡고 그림자를 `0 8px 28px / 10%`로 낮췄다. 반경은 TDS 팝오버 20px를 유지했다. 녹화 알약 모드에는 테두리를 두지 않는다(어두운 면 바깥에 흰 테두리가 비치지 않게).

### 관리자
- 이슈 장면 썸네일이 페이지 전체를 작게 보여 줘서 무엇을 가리키는지 안 보임 → 위젯과 같은 `getFocusTransform`으로 가리킨 곳을 기본 확대. 바깥은 위젯처럼 어둡게(`--scrim-focus`). 오른쪽 아래 "전체 보기/크게 보기" 토글, 왼쪽 아래 재생 시각 칩. 장면을 누르면 그 시점부터 재생하는 동작은 그대로다.
- 영상 칸이 검은 바탕 + 크롬 기본 로딩 스피너 + 어두운 컨트롤 그라데이션 → 불러오는 동안은 grey-100 면이 옅게 숨 쉬는 스켈레톤만 둔다. 재생 전에는 기본 컨트롤을 숨기고 첫 장면 위에 흰 재생 버튼 하나만 두며, 재생하거나 이슈·말한 내용에서 시점을 누르면 컨트롤을 연다.
- "확인 필요" 주황이 대화 목록 칩, 요약 줄, 이슈 배지 세 군데에 퍼져 있음 → 이슈 줄의 배지 한 곳에만 남겼다. 요약 줄은 회색 글자에 6px 주황 점 하나, 대화 목록은 배지 두 개 대신 "녹화 1개 · 남은 문제 3건" 회색 캡션 한 줄로 바꿨다.
- 명확한 이슈마다 붙은 "명확" 회색 배지는 정보가 없음 → 지웠다. 배지는 손이 가야 하는 상태(확인 필요, 물어봤어요, 답변 받음, 반영 완료)에만 단다. 이슈 번호의 회색 네모도 지우고 grey-400 숫자로만 둔다.
- 요약 줄 "문제 3건"이 본문과 같은 크기라 구획 제목 역할을 못 함 → 17px 굵게(t5) 제목으로 올리고 위 여백을 24px로 늘렸다.
- 질문 초안 편집기가 회색 면 + 테두리 + 흰 입력칸 테두리로 3중 경계(카드 안 카드) → 바깥 테두리를 지우고 grey-50 면 하나로만 묶었다. 보기 입력칸 34px에서 40px, 지우기 버튼 28px에서 32px, 하단 승인 줄은 hairline 위 구분으로 정리했다.

## Round 2 (Round 1 반영 후 다시 찍은 01~10, 05b, 08b를 보고)

- 새 질문 카드에 맞춘 스크롤 여백이 12px라서, 카드 위로 앞 말풍선 아래 끝이 4px쯤 비침(잘린 회색 띠) → 여백을 목록 간격과 같은 4px로 줄였다. 이제 카드가 헤더 바로 아래에서 깔끔하게 시작한다.
- 보기를 고른 뒤에도 "답변 보내기"가 패널 아래에 숨어 있어, 고객이 버튼을 찾으려고 직접 스크롤해야 함 → 보기를 누르면 버튼이 보일 만큼만 위젯 스크롤 영역을 부드럽게 내린다(`prefers-reduced-motion`이면 바로). `scrollIntoView`는 고객사 페이지까지 움직일 수 있어서 쓰지 않고, `[data-widget-scroll]` 영역만 움직인다.
- 관리자 이슈의 "고객 답변" 상자가 초록 면이라 상태 색을 면적으로 씀 → grey-50 면으로 바꾸고 초록은 "고객 답변" 라벨 글자에만 남겼다.
- 그대로 둔 것: 런처의 사각 말풍선과 음성 파형은 원형 안에서도 채팅 버튼처럼 보이지 않아 유지했다. 관리자 장면 확대는 하이라이트가 화면 맨 위에 있어도 이미지 바깥이 보이지 않게 고정되는 것을 05·05b에서 확인했다. 위젯 빈 화면의 위아래 배치도 그대로 둔다.

## v2 audit (2026-11-12)

기준: `docs/design/ux-audit-v2.md`의 UX-01..29. 고친 PR은 `gh pr list -R aesop-kim/feedback-sdk --state merged -L 60`의 제목·본문에 적힌 ID로 맞췄다. "→"는 v2 검증에서 PARTIAL·NOT FIXED가 나와 뒤 PR에서 마저 고쳤다는 뜻이다. 괄호 안 PR은 같은 화면을 뒤에 더 다듬은 것이다.

| ID | 분류 | 문제 | 고친 PR | 결과 |
|---|---|---|---|---|
| UX-01 | error recovery | 전송 실패 시 글이 사라짐 | #50 | fixed — verified in [verification-v2.md §2 UX](../qa/verification-v2.md#2-per-item-status) |
| UX-02 | copy | 업로드 실패가 "정리하지 못했어요"로 보임 | #58 | fixed — verified in [verification-v2.md §2 UX](../qa/verification-v2.md#2-per-item-status) |
| UX-03 | copy | 분석 실패가 고객에게 빨간 오류로 보임 | #58 (#80에서 업로드 미완료 문구 분리) | fixed — verified in [verification-v2.md §2 UX](../qa/verification-v2.md#2-per-item-status) |
| UX-04 | affordance | 재확인 요청에 누를 버튼이 없음 | #60 (#82·#84에서 관리자 쪽 마무리) | fixed — verified in [verification-v2.md §2 UX](../qa/verification-v2.md#2-per-item-status) · 제안과 다르게 고침(아래) |
| UX-05 | focus·aria | 위젯 열기/닫기 포커스·Escape | #45 | fixed — verified in [verification-v2.md §2 UX](../qa/verification-v2.md#2-per-item-status) |
| UX-06 | contrast | 4.5:1 미만 토큰 조합 | #45, #40, #42, #47, #76 (#86 보내는 중 말풍선) | fixed — verified in [verification-v2.md §2 UX](../qa/verification-v2.md#2-per-item-status), [verification-v3.md §3](../qa/verification-v3.md) |
| UX-07 | feedback | 정리 중·실패 녹화의 영상을 볼 수 없음 | #40 | fixed — verified in [verification-v2.md §2 UX](../qa/verification-v2.md#2-per-item-status) |
| UX-08 | hierarchy | 고정 플레이어가 질문 초안 제목을 가림 | #40 | fixed — verified in [verification-v2.md §2 UX](../qa/verification-v2.md#2-per-item-status) |
| UX-09 | feedback | "반영 완료"를 되돌릴 수 없고 고객 알림 안내가 없음 | #42 (#82에서 다시 열기) | fixed — verified in [verification-v2.md §2 UX](../qa/verification-v2.md#2-per-item-status) · 제안과 다르게 고침(아래) |
| UX-10 | error recovery | 초기화 오류 화면에 다시 시도가 없음 | #50 | fixed — verified in [verification-v2.md §2 UX](../qa/verification-v2.md#2-per-item-status) |
| UX-11 | affordance | 터치 영역 44px 미만 | #45 | fixed — verified in [verification-v2.md §2 UX](../qa/verification-v2.md#2-per-item-status) |
| UX-12 | focus·aria | 입력창 포커스 표시 | #45, #47 | fixed — verified in [verification-v2.md §2 UX](../qa/verification-v2.md#2-per-item-status) |
| UX-13 | focus·aria | 질문 카드 보기가 방향키로 안 움직임 | #45 | fixed — verified in [verification-v2.md §2 UX](../qa/verification-v2.md#2-per-item-status) |
| UX-14 | feedback | "답변 보내기" 로딩 표시 없음 | #50 | fixed — verified in [verification-v2.md §2 UX](../qa/verification-v2.md#2-per-item-status) |
| UX-15 | focus·aria | 새 답장 live region 없음 | #45 → #72, #74 | fixed — verified in [verification-v3.md §2](../qa/verification-v3.md#2-re-verified-items-all-non-verified-items-from-v2) |
| UX-16 | feedback | 질문 초안 미리보기·승인 피드백 | #42 | fixed — verified in [verification-v2.md §2 UX](../qa/verification-v2.md#2-per-item-status), [verification-v3.md §3](../qa/verification-v3.md) |
| UX-17 | feedback | 반영 완료 뒤 고객 답변이 사라짐 | #42 | fixed — verified in [verification-v2.md §2 UX](../qa/verification-v2.md#2-per-item-status) |
| UX-18 | copy | 빈 목록 안내·설치 안내 | #47 (#74에서 프로젝트 키) | fixed — verified in [verification-v2.md §2 UX](../qa/verification-v2.md#2-per-item-status), [verification-v3.md §3](../qa/verification-v3.md) |
| UX-19 | hierarchy | 같은 이름 고객 구분 | #47 | fixed — verified in [verification-v2.md §2 UX](../qa/verification-v2.md#2-per-item-status) |
| UX-20 | error recovery | 마이크·화면 공유 거부 토스트에 해결 방법이 없음 | #58, #65 | fixed — verified in [verification-v2.md §2 UX](../qa/verification-v2.md#2-per-item-status) |
| UX-21 | affordance | 녹화 알약에 취소·마이크 상태가 없음 | #58 | fixed — verified in [verification-v2.md §2 UX](../qa/verification-v2.md#2-per-item-status) |
| UX-22 | focus·aria | reduced-motion 규칙이 스켈레톤을 깜빡이게 함 | #45 | fixed — verified in [verification-v2.md §2 UX](../qa/verification-v2.md#2-per-item-status) (코드 확인) |
| UX-23 | hierarchy | 대화 중에도 큰 인사말 헤더 | #62 | fixed — verified in [verification-v2.md §2 UX](../qa/verification-v2.md#2-per-item-status), [verification-v3.md §3](../qa/verification-v3.md) |
| UX-24 | copy | 문구 겹침·띄어쓰기 | #62 | fixed — verified in [verification-v2.md §2 UX](../qa/verification-v2.md#2-per-item-status) |
| UX-25 | copy | 배지 말투·"의견/대화" 이름 섞임 | #42, #47 → #74 | fixed — verified in [verification-v3.md §2](../qa/verification-v3.md#2-re-verified-items-all-non-verified-items-from-v2) |
| UX-26 | hierarchy | 토큰 밖 값(11px 글자, 토스트 반경) | #45 → #74 | fixed — verified in [verification-v3.md §2](../qa/verification-v3.md#2-re-verified-items-all-non-verified-items-from-v2) |
| UX-27 | copy | 답한 뒤 칩의 말하는 사람 | #62 | fixed — verified in [verification-v2.md §2 UX](../qa/verification-v2.md#2-per-item-status) |
| UX-28 | focus·aria | 장면 확대 토글의 aria-pressed와 바뀌는 라벨 | #62(v2에서 NOT FIXED) → #74 | fixed — verified in [verification-v3.md §2](../qa/verification-v3.md#2-re-verified-items-all-non-verified-items-from-v2) |
| UX-29 | feedback | 목록·이슈 줄 눌림 반응, 페이저 눌림 시간 | #40, #42, #47 → #74 | fixed — verified in [verification-v3.md §2](../qa/verification-v3.md#2-re-verified-items-all-non-verified-items-from-v2) |

### 감사 제안과 다르게 고친 항목

- **UX-04**: 감사는 재확인 카드에 주 버튼 "화면 녹화로 확인하기"와 보조 텍스트 버튼 "잘 고쳐졌어요"를 제안했다. #60은 주 버튼("다시 녹화해서 확인하기", 48px)만 넣고 "잘 고쳐졌어요"는 뺐다. 고객이 이슈를 닫는 API가 없었고, 닫는 판단은 재확인 녹화를 본 관리자가 하는 편이 맞다고 봤다. 그 마무리는 #82(관리자가 "해결됨"으로 닫거나 다시 열기)와 #84(재확인 녹화 ↔ 원래 이슈 링크)로 관리자 쪽에 넣었다.
- **UX-09**: 감사는 반영 완료 뒤 5초 동안 "되돌리기"를 두고, 못 만들면 확인 대화상자를 두라고 했다. #42는 되돌리기 대신 대체안을 골랐다. 버튼 아래 캡션 "누르면 고객에게 다시 확인해 달라고 알려요", 모달 대신 인라인 확인 "고객에게 확인을 부탁할까요? 부탁하기/닫기", 누른 뒤 안내 문구다. 이미 고객에게 간 메시지를 지우는 되돌리기는 만들지 않았다. 대신 #82가 재확인 중인 이슈를 "다시 열기"로 `open`에 돌릴 수 있게 했다.
