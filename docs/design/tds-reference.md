# Toss Design System (TDS) 구현 레퍼런스

대상: 한국어 B2B 피드백 위젯 + 어드민 대시보드 (React + CSS 변수). 작성일 2026-11-11.

## 0. 출처 표기 규칙 (먼저 읽기)

| 표기 | 의미 |
|---|---|
| **[V-colors]** | 공개 npm `@toss/tds-colors@0.1.0`의 `colors.light.css` / `colors.dark.css`에서 직접 확인 (https://www.npmjs.com/package/@toss/tds-colors) |
| **[V-typo]** | `@toss/tds-typography@0.0.3` dist에서 직접 확인 (https://www.npmjs.com/package/@toss/tds-typography) |
| **[V-mobile]** | `@toss/tds-mobile@2.5.1` dist 번들(`dist/esm/index.js`)의 소스 코드에서 직접 확인 (https://www.npmjs.com/package/@toss/tds-mobile) |
| **[V-web]** | 공개 웹 문서에서 확인: https://tossmini-docs.toss.im/tds-mobile/ (컴포넌트 목록), https://toss.im/tossfeed/article/uxwriter-interview (UX 라이팅) |
| **[추정]** | 직접 확인하지 못했고 관찰/관행/유추로 채운 값. CSS에서는 `/* approx */` |

한계: tds.toss.im, tossmini-docs의 색/타이포 페이지는 본문에 값이 없어서(JS 렌더링) 문서 페이지에서는 값을 못 얻었다. 대신 npm 패키지 소스가 가장 신뢰도 높은 근거다. Toss Product Sans는 비공개 폰트라 파일을 구할 수 없다. Simplicity 강연 등 영상 자료는 텍스트로 접근하지 못해 이 문서의 근거로 쓰지 않았다.

주의: `@toss/tds-mobile`은 모바일(앱인토스) 전용이다. 데스크톱 어드민에는 값(색, 타이포, 반경, 모션)만 가져오고 터치 전용 크기(48/56px 버튼 등)는 그대로 쓰지 않는다. 컴포넌트 크기는 위젯(모바일 폭)에는 그대로, 어드민에는 한 단계 작게(large->medium) 쓰는 것을 권장 [추정].

---

## 1. 컬러

### 1.1 Grey (light) [V-colors]
| 토큰 | Hex | 용도 [추정] |
|---|---|---|
| grey50 | #f9fafb | 가장 옅은 면(테이블 헤더, 호버) |
| grey100 | #f2f4f6 | greyBackground, 입력창/카드 면, weak 버튼 |
| grey200 | #e5e8eb | hairline border, 스위치 off |
| grey300 | #d1d6db | 비활성 보더 |
| grey400 | #b0b8c1 | 비활성 아이콘, 플레이스홀더(옅음) |
| grey500 | #8b95a1 | 플레이스홀더, 3차 텍스트, 토스트 배경(light) |
| grey600 | #6b7684 | 3차 텍스트(캡션) |
| grey700 | #4e5968 | 2차 텍스트, 헤더 라벨, dark 버튼 배경 |
| grey800 | #333d4b | 강조 2차 텍스트 |
| grey900 | #191f28 | 1차 텍스트 |

### 1.2 Blue [V-colors]
50 #e8f3ff / 100 #c9e2ff / 200 #90c2ff / 300 #64a8ff / 400 #4593fc / **500 #3182f6 (primary)** / 600 #2272eb / 700 #1b64da / 800 #1957c2 / 900 #194aa6

[V-mobile] 확인: primary 버튼 fill = blue500, 스위치 on = blue500 (pressed blue700), disabledBlue500 = #c9e2ff.
참고: 로고 파랑은 #0064FF로 알려져 있으나 UI 요소는 #3182F6이다 (제3자 갤러리 정보, [추정]).

### 1.3 상태 색 key step [V-colors]
| | 50 | 100 | 400 | 500 | 600 | 700 |
|---|---|---|---|---|---|---|
| red | #ffeeee | #ffd4d6 | #f66570 | **#f04452** | #e42939 | #d22030 |
| orange | #fff3e0 | #ffe0b0 | #ffa927 | **#fe9800** | #fb8800 | #f57800 |
| yellow | #fff9e7 | #ffefbf | #ffd158 | **#ffc342** | #ffb331 | #faa131 |
| green | #f0faf6 | #aeefd5 | #15c47e | **#03b26c** | #02a262 | #029359 |
| teal | #edf8f8 | #bce9e9 | #30b6b6 | **#18a5a5** | #109595 | #0c8585 |
| purple | #f9f0fc | #edccf8 | #b44bd7 | **#a234c7** | #9128b4 | #8222a2 |

나머지 단계(200/300/800/900)는 7절 tokens.css에 전부 수록.

### 1.4 배경/구분선 [V-colors]
- `background` = #ffffff, `greyBackground` = #f2f4f6, `layeredBackground`/`floatBackground` = #ffffff
- `backgroundLevelB01` = #f2f4f6, `pcScreenBg` = #f6f7f9 (PC 화면 바깥 배경: 어드민 body에 적합)
- `hairlineBorder` = #e5e8eb, `dimmedBackground` = rgba(0,0,0,0.2) (다크 0.56)
- `greyOpacity100..900` (알파 그레이): 100 rgba(2,32,71,0.05), 200 rgba(0,27,55,0.1), 300 rgba(0,29,58,0.18), 400 rgba(0,25,54,0.31), 500 rgba(3,24,50,0.46) 등.

### 1.5 시맨틱 텍스트 매핑
TDS 패키지에는 "text-primary" 같은 이름이 없고 grey 스케일을 직접 쓴다. 아래 매핑은 [V-mobile]의 사용처(헤더 grey700, 서브 grey600/500, 토스트 글자 floatBackground)와 관행을 합친 [추정]이다.
- text-primary = grey900 / text-secondary = grey700 / text-tertiary = grey600 / text-placeholder = grey500 / text-disabled = grey400
- link, 액션 = blue500 (텍스트로 쓸 때 대비가 약하면 blue600/700) / 에러 = red500 / 성공 = green600 (텍스트는 500보다 600 이상) 

### 1.6 다크 모드 [V-colors]
background #17171c, layered #202027, float #2c2c35, greyBackground #101013, hairline #3c3c47. grey100..900 = #2c2c35 #3c3c47 #4d4d59 #62626d #7e7e87 #9e9ea4 #c3c3c6 #e4e4e5 #ffffff. blue500 #3485fa. (이 프로젝트가 라이트 전용이면 생략해도 된다.)

---

## 2. 타이포그래피

### 2.1 폰트
[V-mobile] `ThemeProvider`의 전역 CSS에서 직접 확인한 font stack:
```
'Toss Product Sans', 'Tossface', 'SF Pro KR', 'SF Pro Display', 'SF Pro Icons', -apple-system, BlinkMacSystemFont, 'Basier Square', 'Apple SD Gothic Neo', Roboto, 'Noto Sans KR', 'Noto Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif
```
같은 곳에서 확인: `html{font-size:16px}`, body `font-weight:400`, `line-height:1.5`, **`word-break: keep-all; overflow-wrap: break-word`**, `-webkit-font-smoothing: antialiased`.

Toss Product Sans는 토스 전용(비공개)이므로 우리 제품은 **Pretendard Variable**을 1순위로 쓰고 이어서 위 시스템 폴백을 둔다 [추정, 사용자 허용]. 한국어 줄바꿈은 `word-break: keep-all`이 필수다.

### 2.2 타입 스케일 [V-typo, V-mobile]
패키지에 fontSize 11~42 (1px 단위) 각각의 lineHeight 표가 있다. 규칙: fontSize x 1.5 (11~18px), 이후 점차 비율이 줄어 30px 이상은 +10px 간격 (30/40, 34/44, 42/52).
이름 있는 단계(t1..t7, subTypography)는 [V-mobile]에서 `t5`(xlarge 버튼 17px), `t6`(medium 15px), `t7`(small 13px) 사용을 직접 확인했고, 나머지는 같은 표에서 대응시킨 [추정] 이다.

| 토큰 | size / line-height | 비고 |
|---|---|---|
| t1 | 30 / 40 | 화면 타이틀 [추정 매핑] |
| t2 | 26 / 35 | [추정 매핑] |
| t3 | 22 / 31 | 섹션 타이틀 [추정 매핑] |
| t4 | 20 / 29 | [추정 매핑] |
| **t5** | **17 / 25.5** | 큰 버튼, 리스트 타이틀 [V-mobile 사용 확인] |
| **t6** | **15 / 22.5** | 본문, medium 버튼, 토스트 [V-mobile] |
| **t7** | **13 / 19.5** | 캡션, small 버튼 [V-mobile] |
| sub8 / sub9 | 12 / 18, 11 / 16.5 | 최소 크기 [추정 매핑] |

가중치 [V-mobile 사용 확인]: regular 400, medium 500, semibold 600, bold 700. 헤더 xLarge=700(t5), large/medium=600(t6/t7), small=500(t7). 토스트 문구 = t6 semibold. 배지 = bold.
letter-spacing: 번들에서 지정을 찾지 못했다. 기본 0으로 두고, 24px 이상 큰 숫자/제목만 -0.01em 정도 [추정, approx].

### 2.3 어드민 데스크톱 권장 [추정]
본문 14/21 (fontSize 14 표 값), 테이블 13/19.5, 페이지 타이틀 22/31 bold, KPI 숫자 30/40 bold + `font-variant-numeric: tabular-nums`.

---

## 3. 간격, 반경, 높이

### 3.1 반경
| 요소 | 값 | 출처 |
|---|---|---|
| Button xlarge / large / medium / small | 16 / 14 / 10 / 8px | [V-mobile] |
| Button full(바닥 고정 CTA) | 0px, 단 BottomCTA 래퍼는 16px | [V-mobile] |
| Modal / BottomSheet 패널 | 28px (너비 `calc(100% - 20px)`, 배경 layeredBackground) | [V-mobile] |
| Dialog(Alert/Confirm) 팝업 | 24px, 너비 `calc(100vw - 64px)`, max 320px, 배경 floatBackground | [V-mobile] |
| 팝오버/메뉴 | 20px, min-width 180px, padding 10px 0 | [V-mobile] |
| Toast | 한 줄 100px(알약), 여러 줄 20px | [V-mobile] |
| Switch | 50x30, radius 15 | [V-mobile] |
| Badge | 크기별 8~14px(작은 배지 8) | [V-mobile] |
| 카드(일반) | 16~20px | [추정] |
| 입력창(SearchField 등) | 12~16px | [추정] |

### 3.2 패딩/높이
- 화면 좌우 기본 패딩 20px: 헤더/리스트 패딩 `0 20px`, 토스트 마진 `0 20px` [V-mobile]
- 4의 배수 스케일(4/8/12/16/20/24/32/40/48) [추정]
- 버튼 min-height/패딩 [V-mobile]: xlarge 56 (패딩 `2px 28px`, inline일 땐 `15px 28px`), large 48 (`2px 16px`), medium 38 (`2px 16px`), small 32 (`2px 10px`). 최소 너비 96/80/64/52.
- BottomCTA 버튼 내부 radius 16px [V-mobile]
- ListRow 높이: 한 줄 리스트 최소 약 56px, 두 줄 약 72px [추정] (코드에서 고정값 확인 못함)
- 그림자: TDS는 거의 쓰지 않는다. 카드는 면 색(grey100/white)과 여백으로 구분 [관찰, 추정].

---

## 4. 컴포넌트 스펙

### 4.1 Button [V-mobile]
Props: `color` = primary | danger | dark | light, `variant` = fill | weak, `size` = xlarge | large | medium | small, `display` = inline | block | full, `loading`, `disabled`.

| color | fill (배경 / 글자) | weak (배경 / 글자) |
|---|---|---|
| primary | blue500 / white(0.9 알파) | blue 알파 15% 배경(blue300 베이스) / blue600 |
| danger | red500 / white | red 알파 15% 배경 / red600 |
| dark | grey700 / white | greyOpacity100 / grey700 |
| light(어두운 면 위) | white / blue700 | white 알파 20% / white |

- 눌림 상태: **scale 0.96** (spring `rapid` {stiffness 1000, damping 55}), 위에 어두운 dimmer 오버레이 opacity 0.26 (배경색은 fill 색에서 명도 -0.134 정도 어둡게 계산). 해제 시 scale 1 (spring `quick`).
- 로딩: 글자 숨김, 점 3개(8px, 큰 버튼 기준)가 0.3s 간격으로 opacity 0.2->1, scale 0.8->1 반복. 배경은 opacity 0.13 dimmer.
- disabled: fill은 opacity 0.3, weak는 글자 0.3 (fill 배경 대비 약 70% 투명).
- 구현: 별도 hover 상태는 없음(모바일). 데스크톱은 hover 시 배경만 한 단계 어둡게(blue600) [추정].

### 4.2 TextField [V-web 컴포넌트 존재, 스펙은 추정 + 일부 V-mobile]
변형: box / line / big / hero (CSS 변수명 `--text-field-box-*`, `-line-*`, `-big-*`, `-hero-*` 확인). SearchField 내부 [V-mobile]: 패딩 `14px 16px`, 아이콘 24px grey600, 지우기 아이콘 grey400, 지우기 버튼 aria-label "검색어 삭제".
권장 스타일 [추정]: line 타입 = 하단 1px grey200 보더, 포커스 시 blue500 2px, 라벨은 위로 올라가는 플로팅(13px grey600), 에러 시 red500 + 하단 13px 에러 문구, 입력 17px(t5), 높이 56. box 타입 = grey100 배경 radius 12, 포커스 시 보더 blue500.

### 4.3 ListRow [V-web 구조만]
구성: left(아이콘/이미지 40px 원형, 보더 greyOpacity100 [V-mobile 40x40 radius20]) + contents(top / title / bottom 텍스트) + right(화살표, 배지, 텍스트버튼, 스위치). 좌우 패딩 20px, 세로 패딩 12~16px, 타이틀 t5/t6 semibold grey900, 설명 t7 grey600 [추정]. 구분선은 쓰지 않고 여백으로 구분하며 눌림 시 배경 grey100(또는 greyOpacity50) [추정].

### 4.4 Badge [V-mobile]
12종: {blue, teal, green, red, yellow, elephant} x {fill, weak}.
- fill 배경/글자: blue500/white, teal600/white, green600/white, red500/white, yellow500/grey800, elephant(=회색) grey700/white
- weak: 같은 색의 옅은 배경(약 10~15% 알파, 50~100 단계)에 진한 글자 [단계는 추정]
- 크기 4종 (size 파라미터): 글자 9~16px, 패딩 [3,6]~[5,10]px, radius 8~14px [V-mobile 표], bold, line-height 1.5em.
- 어드민 상태 라벨 권장: 대기=yellow weak, 진행=blue weak, 완료=green weak, 오류=red weak, 보관/기타=elephant weak [추정].

### 4.5 BottomSheet / Modal / Dialog [V-mobile 반경, 나머지 추정]
- 패널 radius 28px, `layeredBackground`, 좌우 10px 여백으로 떠 있는 형태, 내부 패딩 `21px 0 13px` [V-mobile 확인]
- 딤: rgba(0,0,0,0.2) [V-colors dimmedBackground]
- 타이틀 한 줄 규칙 [V-web 라이팅 규칙]. 핸들바/드래그 닫기 지원 [추정].
- Dialog 버튼: 취소 대신 "닫기" / "다음에", 확인 계열은 "확인" [V-web].

### 4.6 Toast [V-mobile]
- 위치: 화면 하단 중앙 고정 (`bottom:0`, 수평 중앙), z-index 3e4, 자동 사라짐 기본 3000ms
- 배경(light) grey500 #8b95a1 / (dark) grey200, 글자 t6 semibold, 색 white(floatBackground)
- 패딩 `14px 20px` (왼쪽 아이콘 있으면 `14px 20px 14px 16px`, 버튼 있으면 `14px 14px 14px 16px`)
- 한 줄: radius 100px, 너비 max-content / 여러 줄: radius 20px, 너비 `calc(100vw - 40px)`
- 참고: 실제 토스 앱의 토스트는 더 어두운 반투명 느낌인데, 코드상 값은 위와 같다.

### 4.7 Tab / SegmentedControl / Checkbox / Radio / Switch
- Tab [V-mobile 변수만]: `--tab-item-padding`, `--tab-left-padding` 등. 모양은 밑줄 인디케이터 + 선택 grey900 semibold / 비선택 grey600 [추정]. 좌우 패딩 20px.
- SegmentedControl [V-mobile 존재]: fixed/fluid 모드, 슬라이딩 인디케이터. 배경 grey100, 선택 칸 white + 약한 그림자, radius 10~12 [추정].
- Checkbox [V-mobile 변형명]: Circle, Line, LineTransparent. 원형 체크(24px)로 선택 시 blue500 채움, 비선택 grey300 선 [크기/색 추정].
- Switch [V-mobile 직접]: 트랙 50x30 radius 15, off = grey200 (눌림 grey400), on = blue500 (눌림 blue700), 썸 white 원 16px->24px로 커지며 이동(translate 16px), 눌림 scale 0.96, disabled opacity 0.3, spring `quick`.
- Radio: Checkbox 원형과 동일 규칙 [추정].

### 4.8 아이콘/Asset/로더
- Asset 시스템: Icon(이름+size+color), Image, Lottie, Video, SquircleMasking, Frame(원/사각 등) 컴포넌트 [V-mobile 확인]. 아이콘 기본 24px, 색은 grey 스케일 토큰으로만 지정.
- 로더: 버튼 내부 점 3개(위 4.1), 별도 Loader 컴포넌트, Skeleton 컴포넌트 [V-web 목록]. 스켈레톤은 grey100 면에 천천히 깜빡임 [추정].
- 이모지 대신 3D 일러스트/라인 아이콘(Tossface 폰트가 폴백에 포함) 사용. 어드민은 lucide/Phosphor 같은 1.5~2px 라인 아이콘 + grey600 권장 [추정].

---

## 5. 모션

[V-mobile] 직접 확인한 값:
- **Spring 프리셋** (stiffness / damping / mass 1): basic 200/30, small 480/50, quick 800/55, medium 270/25, large 100/15, slow 70/20, rapid 1000/55, bounce 300/15
- **Cubic-bezier**: linear [0,0,1,1], ease [.6,0,0,.6], out [.25,.1,.25,1], expo [.16,1,.3,1], back [.34,1.56,.64,1]. 기본 duration 0.5s (bezier 프리셋)
- **눌림**: 버튼/스위치 scale **0.96**, spring rapid로 들어가고 quick으로 복귀. 딤 오버레이 opacity 0.26.
- 로더 점: 0.3s reverse 반복, 점 간 0.1s 딜레이. 로딩 펄스 0.6s `out`.
- disabled 클릭 시 wiggle: translateX 0->2->-2->1->-1->0, 총 약 87ms.
- 요소 진입: translateY(30px) + opacity 0에서 올라오는 패턴 (스테퍼 등) [V-mobile].

CSS로 옮기는 방법 (spring은 CSS에 없으므로 근사) [추정, approx]:
- 눌림 진입 120ms `cubic-bezier(.25,.1,.25,1)`, 복귀 200ms, 시트/모달 진입 300~350ms `cubic-bezier(.16,1,.3,1)`, 페이드 150~200ms.
- `prefers-reduced-motion: reduce`에서는 transform 애니메이션 제거.

---

## 6. 라이팅 (UX Writing)

### 6.1 확인된 원칙 [V-web: toss.im/tossfeed/article/uxwriter-interview]
1. 잡초 뽑기: 의미에 기여하지 않는 단어를 지운다.
2. 모든 서비스가 한 사람이 말하는 듯 같은 톤. 문구를 A/B 테스트해 이긴 표현을 원칙으로 만든다.
3. 클릭 유도용 과장 금지. 사용자에게 실제 이득이 되는 문구만.
4. TDS 컴포넌트에 라이팅 규칙이 박혀 있다: 바텀시트 타이틀은 한 줄, 단일 CTA는 "~하기" 행동형, 화면 이동은 "확인"/"다음", 버튼 두 개일 때 보조 버튼에 "취소" 대신 "닫기"/"다음에".
5. 해요체 통일 (기사 다수가 언급; 원문 가이드 전문은 비공개).
6. 사례: "대출 잔액이 줄어들었으니 확인해보세요" -> "갚느라 고생 많으셨다" (공감 톤으로 지표 개선).

### 6.2 우리 제품에 적용하는 규칙 [추정, 위 원칙에서 도출]
- 해요체. 합쇼체("~하십시오")와 반말 금지. 에러도 책임을 사용자에게 돌리지 않는다.
- 문장 하나에 한 가지 말만. 느낌표는 화면당 0~1개, 기본은 쓰지 않는다. 이모지 남발 금지.
- 버튼은 동사형: "저장하기", "의견 보내기". "확인", "다음"은 이동용.
- 에러 = 무슨 일이 + 어떻게 하면 되는지.

| 상황 | 나쁜 예 | 좋은 예 |
|---|---|---|
| 제출 완료 | 의견이 성공적으로 제출되었습니다!!! | 의견을 보냈어요 |
| 빈 상태 | 데이터가 존재하지 않습니다. | 아직 받은 의견이 없어요 |
| 에러 | 오류가 발생했습니다. 다시 시도해 주십시오. | 연결이 잠깐 불안정해요. 잠시 후 다시 해볼까요? |
| 삭제 확인 | 정말로 삭제하시겠습니까? | 이 의견을 삭제할까요? 삭제하면 되돌릴 수 없어요 |
| 보조 버튼 | 취소 | 닫기 / 다음에 |
| 위젯 유도 | 소중한 의견을 남겨주세요~! | 불편했던 점을 알려주세요 |
| 필수값 | 필수 입력 항목입니다. | 이메일을 입력해 주세요 |
| 권한 | 접근 권한이 없습니다. | 이 페이지는 관리자만 볼 수 있어요 |

---

## 7. "사람이 만든" 토스 느낌의 원칙

1. 색 절제: 화면은 white + grey 계열이 90% 이상, 강조는 blue500 하나. 상태 색(red/green/yellow)은 배지와 숫자에만, 면적으로 쓰지 않는다.
2. 화면당 주요 액션 1개: primary(fill blue) 버튼은 한 화면에 하나. 나머지는 weak 또는 텍스트 버튼.
3. 넉넉한 여백: 좌우 20px, 섹션 간 24~40px, 카드 안 패딩 20px 이상. 구분선보다 여백과 grey100 면.
4. 그라데이션, 글래스모피즘, 네온 글로우, 이중 그림자, 보라-파랑 그라데이션 히어로 금지. 그림자는 거의 없거나 매우 옅게(`0 2px 8px rgba(0,27,55,0.1)` 정도 [추정]).
5. 한국어 우선: 영문 라벨 혼용 금지, `word-break: keep-all`, 날짜 "2026년 11월 11일" 또는 "11월 11일", 상대 시간 "3분 전".
6. 숫자: 천 단위 콤마(`1,234`), 큰 수는 "1.2만"/"3.4천" 보다 정확한 값 우선 (대시보드 KPI는 `toLocaleString('ko-KR')`), 퍼센트는 소수 1자리, 숫자는 굵게 + tabular-nums, 단위는 숫자보다 작고 grey600.
7. 크기 위계는 2~3단계: 큰 숫자/제목 -> 본문 -> 캡션. 굵기는 400/600/700만 사용.
8. 모든 눌리는 것은 눌리는 반응(0.96)을 가진다. 장식용 애니메이션은 넣지 않는다.
9. 카드 중첩(카드 안 카드), 아이콘 + 제목 + 설명 3열 균등 격자, 모든 요소에 둥근 큰 radius + 그림자 같은 "AI 템플릿" 패턴을 피한다.
10. 빈 상태/에러/로딩(스켈레톤) 화면을 항상 설계한다.

---

## 8. tokens.css

값 근거는 위 표기. `/* approx */` 표시가 있는 줄은 추정값이다.

```css
:root {
  /* ---- Grey [V-colors] ---- */
  --grey-50:#f9fafb; --grey-100:#f2f4f6; --grey-200:#e5e8eb; --grey-300:#d1d6db; --grey-400:#b0b8c1;
  --grey-500:#8b95a1; --grey-600:#6b7684; --grey-700:#4e5968; --grey-800:#333d4b; --grey-900:#191f28;
  /* ---- Blue [V-colors] ---- */
  --blue-50:#e8f3ff; --blue-100:#c9e2ff; --blue-200:#90c2ff; --blue-300:#64a8ff; --blue-400:#4593fc;
  --blue-500:#3182f6; --blue-600:#2272eb; --blue-700:#1b64da; --blue-800:#1957c2; --blue-900:#194aa6;
  /* ---- Red / Orange / Yellow / Green / Teal / Purple [V-colors] ---- */
  --red-50:#ffeeee; --red-100:#ffd4d6; --red-200:#feafb4; --red-300:#fb8890; --red-400:#f66570;
  --red-500:#f04452; --red-600:#e42939; --red-700:#d22030; --red-800:#bc1b2a; --red-900:#a51926;
  --orange-50:#fff3e0; --orange-100:#ffe0b0; --orange-200:#ffcd80; --orange-300:#ffbd51; --orange-400:#ffa927;
  --orange-500:#fe9800; --orange-600:#fb8800; --orange-700:#f57800; --orange-800:#ed6700; --orange-900:#e45600;
  --yellow-50:#fff9e7; --yellow-100:#ffefbf; --yellow-200:#ffe69b; --yellow-300:#ffdd78; --yellow-400:#ffd158;
  --yellow-500:#ffc342; --yellow-600:#ffb331; --yellow-700:#faa131; --yellow-800:#ee8f11; --yellow-900:#dd7d02;
  --green-50:#f0faf6; --green-100:#aeefd5; --green-200:#76e4b8; --green-300:#3fd599; --green-400:#15c47e;
  --green-500:#03b26c; --green-600:#02a262; --green-700:#029359; --green-800:#028450; --green-900:#027648;
  --teal-50:#edf8f8; --teal-100:#bce9e9; --teal-200:#89d8d8; --teal-300:#58c7c7; --teal-400:#30b6b6;
  --teal-500:#18a5a5; --teal-600:#109595; --teal-700:#0c8585; --teal-800:#097575; --teal-900:#076565;
  --purple-50:#f9f0fc; --purple-500:#a234c7; --purple-600:#9128b4;

  /* ---- Surfaces [V-colors] ---- */
  --bg:#ffffff;
  --bg-grey:#f2f4f6;
  --bg-layered:#ffffff;
  --bg-float:#ffffff;
  --bg-screen:#f6f7f9;               /* pcScreenBg: admin body */
  --border-hairline:#e5e8eb;
  --dim:rgba(0,0,0,0.2);
  --grey-alpha-100:rgba(2,32,71,0.05);
  --grey-alpha-200:rgba(0,27,55,0.1);
  --grey-alpha-300:rgba(0,29,58,0.18);
  --grey-alpha-400:rgba(0,25,54,0.31);
  --white-alpha-900:rgba(255,255,255,0.9);   /* approx */
  --white-alpha-200:rgba(255,255,255,0.2);   /* approx */

  /* ---- Semantic [mapping approx] ---- */
  --text-primary:var(--grey-900);     /* approx */
  --text-secondary:var(--grey-700);   /* approx */
  --text-tertiary:var(--grey-600);    /* approx */
  --text-placeholder:var(--grey-500); /* approx */
  --text-disabled:var(--grey-400);    /* approx */
  --accent:var(--blue-500);
  --accent-pressed:var(--blue-700);
  --accent-weak-bg:rgba(100,168,255,0.15);  /* blue300 @15% [V-mobile] */
  --accent-weak-text:var(--blue-600);
  --danger:var(--red-500);
  --danger-weak-bg:rgba(251,136,144,0.15);  /* red300 @15% [V-mobile] */
  --success:var(--green-600);
  --warning:var(--yellow-500);

  /* ---- Typography ---- */
  --font-sans:'Toss Product Sans','Pretendard Variable',Pretendard,'SF Pro KR','SF Pro Display',-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',Roboto,'Noto Sans KR','Noto Sans','Helvetica Neue',Arial,sans-serif;
  --fs-t1:30px; --lh-t1:40px;   /* name mapping approx */
  --fs-t2:26px; --lh-t2:35px;   /* name mapping approx */
  --fs-t3:22px; --lh-t3:31px;   /* name mapping approx */
  --fs-t4:20px; --lh-t4:29px;   /* name mapping approx */
  --fs-t5:17px; --lh-t5:25.5px; /* verified t5 */
  --fs-t6:15px; --lh-t6:22.5px; /* verified t6 */
  --fs-t7:13px; --lh-t7:19.5px; /* verified t7 */
  --fs-t8:12px; --lh-t8:18px;   /* name mapping approx */
  --fw-regular:400; --fw-medium:500; --fw-semibold:600; --fw-bold:700;
  --ls-tight:-0.01em;           /* approx */

  /* ---- Radius ---- */
  --r-btn-xl:16px; --r-btn-l:14px; --r-btn-m:10px; --r-btn-s:8px;   /* verified */
  --r-sheet:28px;  --r-dialog:24px; --r-popover:20px;               /* verified */
  --r-toast-single:100px; --r-toast-multi:20px;                     /* verified */
  --r-card:20px;   /* approx */
  --r-input:12px;  /* approx */
  --r-pill:999px;

  /* ---- Spacing ---- */
  --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-5:20px; --sp-6:24px; --sp-8:32px; --sp-10:40px; /* approx (4px grid) */
  --page-x:20px;                /* verified: list/header/toast side padding */

  /* ---- Control heights (verified) ---- */
  --h-btn-xl:56px; --h-btn-l:48px; --h-btn-m:38px; --h-btn-s:32px;
  --h-row:56px;                 /* approx */

  /* ---- Shadow (use sparingly) ---- */
  --shadow-float:0 4px 16px rgba(0,27,55,0.1);  /* approx */

  /* ---- Motion ---- */
  --ease-out:cubic-bezier(.25,.1,.25,1);   /* verified */
  --ease-expo:cubic-bezier(.16,1,.3,1);    /* verified */
  --ease-back:cubic-bezier(.34,1.56,.64,1);/* verified */
  --press-scale:0.96;                      /* verified */
  --dur-press:120ms;                       /* approx: CSS stand-in for spring rapid */
  --dur-release:200ms;                     /* approx: stand-in for spring quick */
  --dur-sheet:320ms;                       /* approx */
  --dur-fade:180ms;                        /* approx */
  --toast-ms:3000;                         /* verified default */
}

html { font-size:16px; -webkit-tap-highlight-color:transparent; }
body {
  font-family:var(--font-sans); font-size:1rem; font-weight:400; line-height:1.5;
  color:var(--text-primary); background:var(--bg);
  word-break:keep-all; overflow-wrap:break-word;          /* verified */
  -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale;
}
* , *::before, *::after { box-sizing:border-box; }
.num { font-variant-numeric:tabular-nums; }
```

### 최소 React 컴포넌트 예시 (Button)
```tsx
type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  color?: 'primary'|'danger'|'dark'; variant?: 'fill'|'weak'; size?: 'xl'|'l'|'m'|'s'; loading?: boolean;
};
export function Button({ color='primary', variant='fill', size='l', loading, disabled, children, ...rest }: Props) {
  return <button className={`tds-btn tds-btn--${color} tds-btn--${variant} tds-btn--${size}`}
    disabled={disabled||loading} aria-busy={loading} {...rest}>{loading ? <Dots/> : children}</button>;
}
```
```css
.tds-btn{display:inline-flex;align-items:center;justify-content:center;border:0;cursor:pointer;font-weight:600;
  transition:transform var(--dur-release) var(--ease-out),background-color 150ms,opacity 150ms}
.tds-btn:active:not(:disabled){transform:scale(var(--press-scale));transition-duration:var(--dur-press)}
.tds-btn:disabled{opacity:.3;cursor:default}
.tds-btn--xl{min-height:56px;padding:2px 28px;border-radius:var(--r-btn-xl);font-size:var(--fs-t5)}
.tds-btn--l {min-height:48px;padding:2px 16px;border-radius:var(--r-btn-l); font-size:var(--fs-t5)}
.tds-btn--m {min-height:38px;padding:2px 16px;border-radius:var(--r-btn-m); font-size:var(--fs-t6)}
.tds-btn--s {min-height:32px;padding:2px 10px;border-radius:var(--r-btn-s); font-size:var(--fs-t7)}
.tds-btn--primary.tds-btn--fill{background:var(--blue-500);color:var(--white-alpha-900)}
.tds-btn--primary.tds-btn--fill:hover{background:var(--blue-600)}      /* approx: desktop hover */
.tds-btn--primary.tds-btn--weak{background:var(--accent-weak-bg);color:var(--blue-600)}
.tds-btn--danger.tds-btn--fill{background:var(--red-500);color:#fff}
.tds-btn--dark.tds-btn--weak{background:var(--grey-alpha-100);color:var(--grey-700)}
@media (prefers-reduced-motion:reduce){.tds-btn{transition:none}.tds-btn:active{transform:none}}
```

---

## 9. 검증 요약
- 직접 확인(코드): 색 전체(light/dark), t5/t6/t7 사용처와 11~42px 라인하이트 표, 폰트 스택, 버튼 4사이즈 크기/반경/패딩/색 매핑/눌림 0.96, 스프링/이징 프리셋, 스위치, 토스트, 모달/다이얼로그/팝오버 반경, 배지 색 매핑.
- 웹 문서 확인: 컴포넌트 목록, UX 라이팅 규칙(바텀시트 한 줄, ~하기, 닫기/다음에).
- 추정: t1~t4 이름 매핑, 시맨틱 텍스트 매핑, TextField/ListRow/Tab/Checkbox 세부 치수, letter-spacing, 카드/입력 반경, 그림자, CSS용 모션 시간.
- 다음 단계 권장: 실제 토스 앱(인앱) 화면과 나란히 비교해서 ListRow 높이, 카드 반경 등 추정 값을 보정.
