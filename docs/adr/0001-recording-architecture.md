# ADR 0001. 화면·음성 녹화를 어디서 할 것인가

- 상태: 채택 (2026-11-11, 밤샘 빌드)
- 관련 파일: `src/lib/recording/capture-session.ts`, `src/hooks/use-widget-recording.ts`, `src/sdk/dom-recorder.ts`

## 배경

고객이 위젯의 "화면 녹화로 설명하기"를 누르면 화면 영상, 마이크 음성, 고객사 페이지의 DOM 이벤트(rrweb)를 함께 남겨야 한다. 위젯은 고객사 페이지(예: `localhost:3001`)에 `sdk.js`가 띄운 우리 origin(`localhost:3000`)의 iframe이다. 그래서 녹화 코드를 어디에 둘지 정해야 했다.

| 안 | 녹화 위치 | 장점 | 단점 |
|---|---|---|---|
| A | 고객사 페이지(sdk.js 안) | 권한 문제 없음 | 녹화·인코딩·업로드 코드가 SDK 번들에 들어가 60KB 예산을 넘기 쉽다. 업로드 토큰이 고객사 페이지 JS 환경에 노출된다 |
| B | 위젯 iframe 안 | 토큰·업로드가 우리 origin에만 있다. SDK는 rrweb만 실으면 된다 | iframe에 `allow="display-capture; microphone"` 위임이 필요하다. 브라우저별 동작 확인이 필요하다 |
| C | 우리 origin 새 창/탭 또는 확장 | 권한 위임이 필요 없다 | 사용 흐름이 끊긴다. 탭 선택 UX가 나빠진다 |

## 결정

**B(위젯 iframe 안에서 녹화)** 를 채택한다.

- iframe은 `allow="display-capture; microphone; clipboard-write"`로 권한을 위임받고, 클릭 핸들러 안에서 `getDisplayMedia({ preferCurrentTab: true, ... })` → `getUserMedia({ audio: true })` 순서로 부른다.
- 고객사 페이지 쪽 `sdk.js`는 rrweb 기록과 클릭·머무름 요소 정보만 맡고, 결과를 postMessage(`dom:events`, `dom:click`, `dom:context`, `dom:stopped`)로 위젯에 넘긴다. 업로드는 위젯이 대화 토큰으로 한다.
- 장면 캡처(JPEG)는 위젯 안 1px 비디오에서 캔버스로 그린다. 고객사 클릭이 오면 `requestFrame('click')`으로 바로 한 장 더 찍는다.

## Day1 cross-site 스파이크를 미룬 이유

원래 계획에는 "고객사와 위젯이 서로 다른 사이트(eTLD+1)일 때 iframe 권한 위임과 탭 캡처가 실제로 되는지"를 Day1에 따로 검증하는 스파이크가 있었다. 밤샘 빌드에서는 이 스파이크를 미뤘다.

- 데모 환경은 `localhost:3001`(고객사)과 `localhost:3000`(위젯)이라 같은 사이트·다른 origin이다. 진짜 cross-site 조건(서드파티 저장소 분할, 권한 정책)을 재현하려면 별도 도메인과 HTTPS 배포가 필요한데, 하룻밤 일정에서는 데모 흐름 전체를 먼저 완성하는 쪽이 더 중요했다.
- Chromium 계열은 `allow` 속성 위임으로 cross-origin iframe의 `getDisplayMedia`를 허용한다고 문서화돼 있어, 위험은 Safari·Firefox와 일부 기업 정책 환경에 몰려 있다. 이 위험은 배포 도메인이 생긴 뒤에 확인해도 되돌리는 비용이 작다(아래 참고).

## 되돌릴 수 있게 만든 장치

`capture-session.ts`는 React와 위치에 묶이지 않는다. `MediaStream` 두 개(화면, 마이크)만 받아 영상·음성·장면·t0를 돌려준다. 그래서 스파이크 결과가 나쁘면:

- **C로 옮길 때**: 우리 origin의 새 창에서 같은 `startCaptureSession`을 부르고, 고객사 페이지와의 postMessage만 창 사이로 바꾼다.
- **A로 옮길 때**: `sdk.js`에서 스트림을 얻어 같은 모듈을 쓰고, 업로드만 위젯에 Blob을 넘겨 맡긴다(토큰은 계속 위젯에 둔다). 번들 크기 예산은 따로 다시 잰다.

순수 규칙(장면 캡처 간격, 120장 상한과 클릭용 몫, 크기 조정, 이름 충돌 처리)은 `frame-capturer.ts`에 있고 단위 테스트로 지킨다.
