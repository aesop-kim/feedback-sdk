# 데모 영상 레퍼런스 노트 + 스토리보드

작성일 2026-11-11. 대상: Lattice x NEXT 피드백 SDK 90~120초 데모 (1920x1080).

> 조사 한계: Linear, Arc, Raycast, v0, Superhuman, Toss 영상 자체를 직접 시청하지는 못했다(텍스트 검색과 문서 위주).
> 아래 레퍼런스 중 "검증"이라고 적은 것만 페이지 내용을 확인했고, 나머지는 공개된 영상 스타일에 대한 일반적 관찰이라 제작 전에 직접 한 번씩 보길 권한다.
> 수치(완료율 23% 등)는 출처 없는 벤더 블로그라 참고용이다.

---

## 1. 레퍼런스 목록

| # | 대상 | URL | 배울 점 |
|---|------|-----|---------|
| 1 | Linear 기능 릴리스 영상 / changelog (검증: 요약 기사) | https://linear.app/changelog , https://vidpros.com/best-product-demo-videos/ | 기능당 약 60초, 컷 하나를 5~7초 길게 유지. UI가 예뻐야 가능한 방식이고 내레이션 하나로 설명을 끌고 간다. |
| 2 | Loom | https://www.loom.com | 영상 자체가 제품의 증거. 연출을 덜어낼수록 신뢰가 높아진다. 우리도 "진짜 앱이 실제로 돌아가는 것"을 보여주는 쪽이 맞다. |
| 3 | Superhuman | https://superhuman.com | 내레이터 없이 실제 단축키 워크플로를 보여주고 "인박스 제로"라는 결과로 끝낸다. 결과 장면으로 끝내는 구조의 참고. |
| 4 | Cursor | https://cursor.com , https://www.producthunt.com/p/cursor/decoding-cursor-s-recent-product-hunt-launches | 실제 작업 세션을 그대로 보여주고, 홍보 문구 없이 화면 2~4장으로 기능을 설명한다. |
| 5 | Screen Studio (검증: 공식 사이트) | https://screen.studio , https://www.screen.studio/help | 클릭 직전 자동 줌, 커서 경로 스무딩("흔들림이 매끄러운 이동으로"), 배경 위에 화면을 안쪽으로 띄우고 그림자를 주는 프레임. 우리 제작 방식의 기준점. |
| 6 | Raycast | https://www.raycast.com | 기능 하나에 영상 하나, 짧고 밝은 배경 프레임 안에 UI를 띄우는 스타일. 업데이트마다 "사용자 이득" 중심으로 설명한다(https://buildtogether.substack.com/p/raycast-changelog-review). |
| 7 | Arc / The Browser Company | https://arc.net | 짧은 라운드업 영상과 GIF 위주 릴리스 커뮤니케이션. 한 가지 동작을 루프 가능한 짧은 클립으로 쪼개는 방식. |
| 8 | Vercel v0 | https://v0.dev | "입력 하나, 결과 하나" 구조. 프롬프트를 치자마자 결과가 나오는 전/후 대비를 첫 화면에 둔다. |
| 9 | 토스 UX Writing (검증: 인터뷰) | https://toss.im/tossfeed/article/uxwriter-interview | "잡초 뽑기": 기능 없는 단어를 지운다. 과장 문구 지양, 일관된 보이스 톤. 자막 문체의 기준. |
| 10 | 8초 규칙 글 (검증) | https://dev.to/cvchelles/the-8-second-rule-why-most-saas-demos-lose-viewers-instantly-2elg | 로그인 화면이 아니라 결과/전후 대비로 시작, 첫 프레임에 움직임, 3초 안에 "이게 뭔지" 전달, 시연은 시각 포인트 3개 이내. |
| 11 | 데모 영상 가이드 모음 | https://supademo.com/blog/demo-video , https://www.videojeeves.com/blog/how-to-make-a-saas-product-demo-video/ | 피치 3단 구조(고통 → 핵심 순간 → 다음 행동 하나), 랜딩 페이지용은 60~90초~3분. |
| 12 | YC Demo Day / YC 제품 영상 | https://www.ycombinator.com/library | 미검증. 한 문장 문제 정의로 시작해서 시연으로 바로 들어가는 포맷이라는 일반적 인상만 있음. |

---

## 2. 정리한 원칙 (12개)

1. **첫 3~5초는 우리 고객이 겪는 장면.** 로고, 인사, 로그인 화면으로 시작하지 않는다. 음소거로 처음 3초만 봐도 "이거 내 얘기다" 싶어야 한다.
2. **고통 → 해결 → 결과**의 3막. 약 20% / 60% / 20% 배분. 이번 영상은 15초 / 60~75초 / 15~20초가 목표.
3. **한 영상에 한 시나리오.** "녹화로 설명 → 이슈 카드 → 되묻기 → 해결 확인" 하나의 이야기만 한다. 부가 기능(설정, 권한)은 뺀다.
4. **장면당 길이 3~8초.** 처음 30초는 컷 3초 이하로 빠르게(몽타주), 본 시연은 5~7초씩 UI가 읽힐 시간을 준다(Linear 방식). 영상을 빨리 감지 말고 내용을 덜어낸다.
5. **클릭 직전 자동 줌.** 커서가 향하는 곳으로 1.0x에서 1.5~1.8x까지 0.6~0.8초에 부드럽게(ease in-out) 들어가고, 작업이 끝나면 천천히 빠진다. 줌이 연출의 대부분이다.
6. **커서를 보이게, 부드럽게.** 큰 커서(약 28px), 클릭 시 링 파동, 이동은 직선이 아니라 곡선 보간. 급한 움직임 금지, 핵심 지점에서 0.5초 멈춤.
7. **자막은 큼직한 한국어 카드, 장면당 한 줄.** 하단 번역 자막식이 아니라 화면 위쪽 또는 아래쪽에 28~44px 이상 굵은 한 줄. 토스 문체: 해요체 또는 명사구, 잡초 제거, 과장과 이모지 금지.
8. **보이스오버는 없이 간다(권장).** 자막 카드 + 앰비언트 음악. 이유: 한국어 TTS/녹음 품질 리스크가 크고, 로컬 도구만 쓰는 제약, 소리 끄고 보는 환경이 많다. 대신 자막 타이밍을 꼼꼼히 맞춘다. 원하면 나중에 녹음 트랙을 얹을 수 있게 자막 길이에 여유를 둔다.
9. **배경 프레임.** 화면을 옅은 그라디언트 배경 위에 약 7% 패딩, 모서리 라운드 16~20px, 부드러운 그림자로 띄운다(Screen Studio, Raycast 스타일). 브라우저 크롬은 최소화.
10. **전환은 하드 컷 + 짧은 크로스페이드(8~12프레임).** 와이프, 스핀 등 장식 금지. 몽타주만 빠른 하드 컷. 줌 상태 그대로 다음 장면으로 이어 붙이면 흐름이 자연스럽다.
11. **음악은 잔잔한 비트 하나, 낮게.** 음악은 분위기만 만들 뿐 가치를 전달하지 않는다. 시연 구간에서는 -22 LUFS 부근으로 낮추고, 결과 장면에서 살짝 올린다. 몽타주는 템포를 빠르게. 저작권 걱정 없는 음원(직접 생성/무료 라이선스)만.
12. **엔딩 CTA는 하나.** 결과 화면(해결됨 체크) → 한 줄 카피 + 한 개의 다음 행동. 이번에는 과제 발표용이므로 "데모 체험하기" 또는 팀 이름/레포 정도로 끝낸다.

---

## 3. 스토리보드 (1920x1080, 30fps, 총 약 108초)

공통: 캡션은 Pretendard Bold, 흰 카드 + 짙은 글자(#191F28) 또는 어두운 카드 + 흰 글자. 위치는 화면 하단 중앙에서 위로 80px. 별도 표기가 없으면 "배경 프레임" 적용.
줌 표기: `Z1.6@(x,y)` = 1.6배, 화면 비율 좌표 (0~1) 중심. `in 0.7s` = 줌인 시간.

| # | 길이 | 화면 (앱 화면 / 동작) | 캡션 (한국어) | 줌 / 커서 처리 |
|---|------|----------------------|--------------|----------------|
| 1 | 0:00-0:05 (5s) | **고통 몽타주 1.** 컷 5개 x 1초: (a) PPT 한 장에 빨간 박스와 "계약의 '보'자가 좀 이상합니다" 메모, (b) 엑셀 QA 시트 행 수십 개, (c) 카톡/메신저 "그 화면 아시죠?" 말풍선, (d) 전화 수신 아이콘, (e) 개발자의 "어느 화면이요?" 답장 | 첫 컷부터 "QA 요청이 이렇게 와요" (3초 후 교체: "어느 화면이요? 어느 버튼이요?") | 프레임 없이 풀블리드. 각 컷에 1.0→1.08 느린 푸시인. 하드 컷. 배경음 시작. |
| 2 | 0:05-0:12 (7s) | **몽타주 2.** 개발자가 PPT를 보며 Jira 같은 티켓 창에 손으로 다시 입력하는 화면, 스크린샷 캡처-붙여넣기 반복, 재현 안 됨 스티커 | "다시 물어보고, 다시 옮겨 적고, 재현이 안 돼요" | 티켓 입력란에 Z1.5로 타이핑 장면 줌. 컷은 2초 이하. |
| 3 | 0:12-0:17 (5s) | **전환.** 몽타주가 블러 처리되며 깨끗한 배경 위에 고객 사이트가 떠오름. 로고/제품명 한 줄 | "고객이 화면에서 바로 말하면 어떨까요?" → 제품명 "Feedback SDK" | 첫 프레임 적용(여기부터 배경 프레임 시작). 정지 컷 + 페이드. |
| 4 | 0:17-0:24 (7s) | **위젯 열기.** 고객 사이트(계약 화면 데모 페이지). 우하단 채팅 위젯 버튼 클릭 → 채팅창 열림, 인사 메시지 | "고객 사이트에서 위젯만 열면 돼요" | 커서가 우하단으로 곡선 이동 → 클릭 링 → Z1.7@(0.9,0.85) in 0.7s, 열린 뒤 천천히 Z1.0. |
| 5 | 0:24-0:30 (6s) | 위젯에서 **"화면 녹화로 설명하기"** 버튼 클릭 → 녹화 시작 표시(빨간 점, 타이머) | "'화면 녹화로 설명하기'를 눌러요" | 버튼 위에서 0.5초 멈춤 후 클릭, Z1.8@버튼. 버튼 텍스트가 읽혀야 함. |
| 6 | 0:30-0:44 (14s) | **말하며 가리키기.** 커서가 계약 화면의 "보" 글자, 이어서 버튼, 표를 차례로 가리킴. 하단에 실시간 음성 자막(받아쓰기) 점멸: "이 글씨가 좀 이상해요" | "말하면서 문제를 가리키기만 하면 돼요" | 가리킬 때마다 커서 주변 원형 하이라이트(링). 줌 2회(글자 Z1.8, 버튼 Z1.5). 포인트마다 0.8초 멈춤. |
| 7 | 0:44-0:50 (6s) | **녹화 종료.** "녹화 종료" 클릭 → "분석 중" 진행 상태 4단계(받아쓰기 / 프레임 캡처 / 요소 매칭 / 카드 생성)가 체크되며 채워짐 | "받아쓰기, 화면 캡처, 요소 매칭까지 자동이에요" | Z1.5@진행 목록. 체크 한 개당 0.5초. 컷 전환 크로스페이드. |
| 8 | 0:50-1:00 (10s) | **관리자 화면 - 이슈 카드.** 관리자 대시보드에 새 이슈 카드 3장이 생김. 카드 하나에 캡처된 프레임 + 해당 요소 박스 + 말한 문장 + 셀렉터. 카드를 열어 프레임과 하이라이트 확인 | "어느 화면, 어느 요소인지 카드에 담겨 있어요" | 카드 목록 → 카드 하나로 Z1.6 in 0.8s, 하이라이트 박스에 0.8초 멈춤. 카드 3장이 0.2초 간격으로 순차 등장. |
| 9 | 1:00-1:10 (10s) | **애매한 카드.** "이 글씨가 좀 이상해요" 카드에 "확인 필요" 뱃지. 관리자가 "AI 질문 초안" 확인 후 "승인" 클릭 | "애매한 요청은 AI가 되묻는 질문을 만들어요" / "관리자가 승인하면 고객에게 가요" (5s씩) | 질문 초안 영역 Z1.5. 승인 버튼 클릭 링. |
| 10 | 1:10-1:22 (12s) | **고객 화면 - 되묻기 카드.** 고객 위젯에 캡처한 프레임이 나타나고 해당 요소가 하이라이트됨. 객관식 3개 ("글자 크기가 달라요 / 글자가 잘려요 / 글꼴이 어색해요"). 고객이 하나를 한 번 클릭 | "고객은 한 번 클릭으로 답해요" | 하이라이트된 글자에 Z1.8 in 0.7s → 선택지 영역으로 팬(이동) → 클릭 링. 클릭 직후 "답변 완료" 체크. 이 구간이 하이라이트라 가장 길게. |
| 11 | 1:22-1:30 (8s) | **관리자 - 답변 반영.** 이슈 카드가 "글꼴이 어색해요"로 구체화됨, 상태 "진행 중". 관리자가 "해결됨"으로 변경 | "답변은 카드에 바로 쌓여요" → "고치면 '해결됨'으로 바꿔요" | 카드 제목 변경 부분 Z1.6, 상태 드롭다운 클릭 링. |
| 12 | 1:30-1:38 (8s) | **고객 - 재확인.** 위젯에 "수정했어요. 확인해 주세요" 알림, 고객이 "잘 고쳐졌어요" 클릭 → 완료 체크 | "고객은 고쳐진 화면을 바로 확인해요" | 알림 말풍선 Z1.7, 버튼 클릭 링 후 체크 애니메이션 0.6초 유지. |
| 13 | 1:38-1:46 (8s) | **Before/After 요약.** 좌: 첫 몽타주의 PPT/엑셀/채팅 썸네일(흐리게) / 우: 이슈 카드 1장. 한 줄 비교 3개: 어느 화면 → 자동 / 재현 → 프레임 / 티켓 → 카드 | "화면, 맥락, 티켓까지 한 번에 모여요" | 줌 없음, 정적 레이아웃. 좌우 슬라이드 인 0.4초. |
| 14 | 1:46-1:52 (6s) | **엔딩 CTA.** 깔끔한 배경, 제품명 + 한 줄 + 팀명(Lattice x NEXT) | "말로 설명하면, 이슈가 돼요" / "Feedback SDK" / (작게) "Lattice x NEXT" | 정지 카드. 1초 페이드 아웃. 음악 마지막 박에 맞춰 종료. |

총 약 112초(1:52). 100초 이하가 필요하면 장면 2를 4초로 줄이고 장면 13을 삭제한다(약 100초).

캡션 문체 점검: 모두 해요체 또는 명사구, 느낌표/이모지 없음, 한 장면 한 메시지. "혁신", "획기적" 같은 수식어 금지.

---

## 4. 제작 계획 (로컬 도구만)

### 4.0 폴더 구조
```
feedback-sdk/demo/
  reference-notes.md
  record/   (Playwright 스크립트: record.mjs, cursor-inject.js, cues.json)
  raw/      (녹화 원본 webm)
  cards/    (캡션 PNG, 몽타주용 가짜 PPT/엑셀/채팅 HTML 캡처)
  build/    (장면별 mp4, 최종 final.mp4)
```

### 4.1 Playwright로 실제 앱 녹화
- 실제 데모 앱(`feedback-sdk` dev 서버)을 대상으로 장면 4~12를 연속 시나리오로 녹화한다. 고객 탭과 관리자 탭은 각각 별도 context로 녹화해 두고 나중에 이어 붙인다.
- 헤드리스에는 커서가 없고 녹화에도 찍히지 않으므로 `addInitScript`로 가짜 커서를 주입한다.
- 해상도: `viewport: {width:1920,height:1080}` + `recordVideo: {dir:'raw/', size:{width:1920,height:1080}}`. 비디오는 CSS 뷰포트 크기로 찍히므로(`deviceScaleFactor`는 영상 해상도에 영향 없음) 확대 컷이 뭉개질 수 있다. 줌을 1.8x까지 쓰므로 선택지를 둔다.
  - A안(기본): 1920x1080 녹화, 줌은 ffmpeg로 처리. 1.6x 이내면 충분히 보인다.
  - B안(선명도 우선): 앱 레이아웃을 960x540 CSS로 두고 `deviceScaleFactor:2`로 `page.screenshot` 연속 캡처(또는 CDP `Page.startScreencast`)해서 1920x1080 프레임열을 만들고 ffmpeg로 합친다. 구현이 더 무겁다.
  - C안: 페이지 안에서 카메라 줌을 직접 건다(`document.body.style.transform`/`transition`). 벡터가 유지되어 선명하지만 좌표/히트테스트가 바뀌므로 클릭 후에만 쓴다.
- Playwright 영상은 저비트레이트 VP8이다. 최종 mp4로 재인코딩할 때 한 번 더 품질이 떨어지니 중간 파일은 `-crf 14`로 만들고 마지막에만 `-crf 18`.
- 영상은 `context.close()` 후에만 저장된다. 반드시 `await context.close()`.

커서 주입 (`cursor-inject.js`):
```js
// context.addInitScript({ path: 'cursor-inject.js' })
(() => {
  const c = document.createElement('div');
  c.id = '__cur';
  c.style.cssText = 'position:fixed;left:0;top:0;width:28px;height:28px;z-index:2147483647;pointer-events:none;' +
    'transform:translate(-4px,-2px);transition:none;' +
    'background:url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2228%22 height=%2228%22 viewBox=%220 0 24 24%22><path d=%22M3 2l7 19 3-8 8-3z%22 fill=%22black%22 stroke=%22white%22 stroke-width=%221.6%22/></svg>") no-repeat';
  const ring = document.createElement('div');
  ring.style.cssText = 'position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;' +
    'border:3px solid #3182F6;opacity:0;z-index:2147483646;pointer-events:none';
  const add = () => { document.documentElement.append(ring, c); };
  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', add) : add();
  addEventListener('mousemove', e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px';
    ring.style.left = e.clientX + 'px'; ring.style.top = e.clientY + 'px'; }, true);
  addEventListener('mousedown', e => {
    ring.animate([{opacity:.9, transform:'scale(.5)'},{opacity:0, transform:'scale(1.6)'}], {duration:500});
    (window.__clicks ||= []).push({t: performance.now(), x: e.clientX, y: e.clientY});
  }, true);
})();
```
- 이동은 `page.mouse.move(x, y, {steps: 40})`로 보간하고, 포인트에서 `waitForTimeout(600)`로 멈춘다. 곡선이 필요하면 베지어 점열을 직접 `mouse.move`로 보낸다.
- 시나리오 스크립트는 각 단계 시작 시각을 `cues.json`에 기록한다: `{scene, t0, t1, zoom, cx, cy}`. `t`는 녹화 시작 기준 초(`Date.now() - startMs`). 자동 줌 큐는 `mousedown` 직전 위치에서 뽑는다(Screen Studio와 같은 원리).
- 음성 받아쓰기 자막(장면 6)은 실제 STT에 맡기지 말고 데모 앱 쪽 mock으로 정해진 문장을 타이밍에 맞춰 흘려 보낸다. 촬영 재현성이 중요하다.
- 몽타주(장면 1~2)는 PPT/엑셀/채팅 화면을 HTML로 만들고 Playwright `page.screenshot`으로 PNG를 뽑는다(실제 개인 문서 사용 금지, 가짜 데이터).

### 4.2 부드러운 줌 (ffmpeg)
기본: 30fps로 맞춘 뒤 3840x2160으로 업스케일하고 `zoompan`을 건다. 업스케일을 하지 않으면 정수 반올림 때문에 화면이 떨린다. 아래는 1초(30프레임)부터 0.75초 동안 1.0→1.7배, ease in-out (smoothstep 3p²-2p³). 확인: 4초 테스트 소스에서 1920x1080, 120프레임 출력됨.
```bash
ffmpeg -i raw/s10.webm -vf "fps=30,scale=3840:2160:flags=lanczos,\
zoompan=z='1+0.7*(3*pow(clip((on-30)/22,0,1),2)-2*pow(clip((on-30)/22,0,1),3))':\
x='(iw-iw/zoom)*0.62':y='(ih-ih/zoom)*0.45':d=1:s=1920x1080:fps=30" \
  -c:v libx264 -crf 14 -pix_fmt yuv420p build/s10_zoom.mp4
```
- `x`, `y`는 0~1 비율 좌표를 `(iw-iw/zoom)*cx` 식으로 넣는다. `cx`, `cy`는 `cues.json`에서 채운다. 줌 아웃도 같은 식에 내려가는 구간을 더해 `if(lt(on,N), ..., ...)`로 확장한다.
- 여러 줌이 있는 장면은 `cues.json`을 읽어 Node 스크립트가 `z` 식을 구간별로 이어 만든다. 또는 장면을 줌 구간마다 쪼개 따로 렌더링해 concat 한다(더 단순하고 디버깅 쉬움).
- 팬(이동)은 `x`, `y`에 시간 함수를 넣는다: `x='(iw-iw/zoom)*(0.3+0.4*clip((on-60)/30,0,1))'`.
- 속도: 4K 업스케일 + zoompan은 느리다. 장면 단위로 처리하고, 줌이 없는 구간은 `-c copy` 대신 단순 `scale`만 쓴다.
- 대안(간단): 고정 줌 컷은 `crop=1920/1.5:1080/1.5:x:y,scale=1920:1080:flags=lanczos`. 단 `crop`의 w/h는 초기 1회만 계산되므로 시간에 따른 줌에는 못 쓴다.

### 4.3 배경 프레임 (패딩 + 라운드 + 그림자)
1) 모서리 마스크는 Playwright로 한 번만 만든다: 1632x918 흰 둥근 사각형(radius 20) PNG `mask.png`, 같은 크기의 그림자 PNG `shadow.png`(blur 40, 투명). 배경 `bg.png`는 CSS 그라디언트(#EEF2FF → #E6F0FF)를 1920x1080으로 캡처.
2) 합성 (화면을 1632x918, 즉 좌우 144px / 상하 81px 패딩으로 축소):
```bash
ffmpeg -loop 1 -i cards/bg.png -loop 1 -i cards/shadow.png -i build/s10_zoom.mp4 -loop 1 -i cards/mask.png \
 -filter_complex "[2:v]scale=1632:918,format=rgba[v];[3:v]format=gray[m];[v][m]alphamerge[vr];\
 [0:v][1:v]overlay=144:96[bs];[bs][vr]overlay=144:81:shortest=1,format=yuv420p" \
 -c:v libx264 -crf 16 build/s10_framed.mp4
```
- 단순 버전(라운드/그림자 생략): 위 4.0에서 확인한 `scale=1632:918,pad=1920:1080:144:81:color=0xEEF1F6`로 충분히 동작한다.
- 줌과 프레임의 순서: 줌 → 프레임 순으로 한다(프레임 안에서 확대되는 것처럼 보인다). 프레임까지 같이 확대하는 방식은 쓰지 않는다.
- 몽타주(1~2)는 프레임 없이 풀블리드, 장면 3부터 프레임.

### 4.4 캡션 카드
- 방법 A(권장): HTML 한 장짜리 카드를 Playwright로 투명 배경 PNG(`omitBackground:true`)로 캡처. Pretendard가 시스템에 설치되어 있으므로(`~/Library/Fonts/PretendardVariable.ttf`) CSS에서 `font-family:'Pretendard Variable'`. 카드 스타일: 흰 배경 90% 불투명, radius 16, 패딩 18x32, 글자 40px Bold, 자간 -0.02em.
  - `captions.json`(`[{id, text, start, end}]` )에서 PNG를 일괄 생성.
  - 오버레이: 
```bash
ffmpeg -i build/body.mp4 -i cards/c01.png -i cards/c02.png \
 -filter_complex "[0:v][1:v]overlay=(W-w)/2:H-h-80:enable='between(t,5,9)':format=auto[a];\
 [a][2:v]overlay=(W-w)/2:H-h-80:enable='between(t,9,14)'" -c:v libx264 -crf 16 build/captioned.mp4
```
  - 페이드: 각 PNG 입력에 `-loop 1 -t N` 후 `format=rgba,fade=t=in:st=0:d=0.25:alpha=1,fade=t=out:st=N-0.25:d=0.25:alpha=1`을 걸고 `setpts=PTS+START/TB`로 시작 시각에 맞춘다.
- 방법 B(간단): `drawtext=fontfile=/Users/donghwakim/Library/Fonts/PretendardVariable.ttf:text='...':fontsize=44:fontcolor=white:box=1:boxcolor=0x191F28@0.85:boxborderw=24:x=(w-text_w)/2:y=h-140:enable='between(t,5,9)'`. 가변 폰트라 굵기 선택이 안 될 수 있으니 굵은 글자가 필요하면 방법 A. 한글 줄바꿈이 필요하면 A.

### 4.5 장면 이음, 음악, 최종 출력
- 장면별로 `build/sNN.mp4`(30fps, 1920x1080, yuv420p, 동일 코덱 설정)를 만든다.
- 하드 컷은 concat demuxer: `printf "file 's01.mp4'\nfile 's02.mp4'\n" > list.txt; ffmpeg -f concat -safe 0 -i list.txt -c copy build/body.mp4`.
- 크로스페이드가 필요한 곳(3, 7, 14)은 `xfade=transition=fade:duration=0.35:offset=<앞 장면 길이-0.35>`를 쓰고, 이 구간은 재인코딩한다.
- 음악: 무료 라이선스 음원 하나를 `-i bgm.mp3`로 넣고 `afade=t=in:d=1,afade=t=out:st=110:d=2,volume=0.35` 후 `loudnorm=I=-20`. 클릭음이 필요하면 ffmpeg `sine` 소스로 짧은 틱을 만들어 `adelay`로 클릭 시각에 맞춘다(선택).
- 최종: 
```bash
ffmpeg -i build/captioned.mp4 -i bgm.mp3 -map 0:v -map 1:a -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p \
  -c:a aac -b:a 192k -shortest -movflags +faststart build/final.mp4
```
- 검수: `ffmpeg -i final.mp4 -vf fps=1,scale=480:-1 thumbs/%03d.png`로 초당 한 장 뽑아 캡션 가독성과 줌 중심 위치를 확인.

### 4.6 작업 순서
1. 데모 데이터 고정(계약서 화면, "보" 글자 이상 시드), 시나리오 스크립트 + `cues.json` 기록 → 장면 4~12 녹화.
2. 몽타주용 HTML 목업(PPT/엑셀/채팅/티켓) 제작 → PNG 캡처 → 장면 1~2, 13 조립.
3. 줌 적용 → 프레임 합성 → 캡션 오버레이 → concat → 음악 → 렌더.
4. 별도 검수: 캡션 문체(해요체, 잡초 제거), 줌 위치, 총 길이 확인 후 수정.

---

## 요약
- 조사 결과, 좋은 SaaS 데모는 "고객의 고통 장면으로 시작해 결과 장면으로 끝나는" 짧은 3막, 장면당 3~8초, 클릭 직전 자동 줌, 배경 프레임 위에 화면 띄우기, 큼직한 한 줄 캡션, 하나의 CTA라는 공통점이 있었다. 일부 레퍼런스는 직접 시청하지 못해 일반 관찰로 표시했다.
- 스토리보드는 14장면 약 112초: PPT "보자" 몽타주 → 위젯 → 녹화 → 분석 → 이슈 카드 → AI 되묻기 승인 → 고객 원클릭 → 해결됨 → 재확인 → 비교 요약 → CTA. 보이스오버 없이 자막 카드와 음악으로 간다.
- 제작은 Playwright 녹화(커서 주입, cues.json) + ffmpeg `zoompan`(smoothstep, 4K 업스케일) + 패딩/마스크 합성 + 캡션 PNG 오버레이 + concat/xfade로 모두 로컬에서 가능하다. zoompan과 패딩 명령은 테스트 소스로 실행 확인했고, 마스크 합성과 캡션 fade 체인은 아직 미실행이다.
