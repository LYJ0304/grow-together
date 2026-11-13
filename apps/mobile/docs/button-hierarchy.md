# UI Color Harmony & Button Hierarchy

기존에는 다섯 가지 파스텔 톤이 행동의 중요도와 무관하게 적용되었다. 생성·저장·사진 제거·취소가 비슷하게 강조되었고 일부 커스텀 버튼은 별도 코랄 정책을 사용했다. 이제 기존 브랜드 코랄/피치와 밝은 화면을 유지하며 행동 역할에 따라 통일한다.

## 최종 팔레트와 역할

| Variant | 배경 / 글자 | 일반 텍스트 대비 | 눌림 대비 |
| --- | --- | --- | --- |
| primary | `#B25447` / `#FFFFFF` | 4.94:1 | 6.34:1 (`#914C41`) |
| secondary | `#FDEDE6` / `#914C41` | 5.56:1 | 5.11:1 (기존 soft pink) |
| tertiary | `#FFFFFF` / `#292929`, 기존 중립 outline | 14.55:1 | 11.99:1 |
| destructive | `#FFFFFF` / `#A03C30`, danger outline | 6.60:1 | 5.79:1 |
| destructive-confirm | `#A03C30` / `#FFFFFF` | 6.60:1 | 6.34:1 |

`destructive-confirm`은 별도 행동 역할이 아니라 최종 삭제 확인에서만 사용하는 destructive의 채움 표현이다. 중립 outline과 화면 배경 대비는 3.30:1, danger outline은 6.28:1이다. 비활성은 기존 `disabled` 배경/테두리와 `muted` 글자를 사용하며 실제 비활성 접근성 상태를 유지한다. 비활성은 WCAG 최소 대비 예외다.

`ActionButton`의 기본 variant는 secondary다. 메인 진행·저장·다음 단계에는 primary를 명시한다. 같은 화면의 다른 버튼마다 색을 배정하지 않고 동일 역할을 재사용한다. `tone` API와 사용하지 않는 blush/petal/mist 색상은 제거했다. `brand`, 로고 gold, 흰색 surface, 밝은 background 및 탭 색상은 보존한다.

## 화면별 적용

| 화면 | 주요 변경 |
| --- | --- |
| Welcome/Auth | 로그인·회원가입 제출 primary, 보조 가입 이동 secondary, 인증 없이 미리보기 tertiary |
| Main | 일정 만들기 primary, 질문 진입·재조회 secondary. 카드·FAB·탭의 밝은 브랜드 표현 유지 |
| Schedule | 활동 추천 secondary. 후보 생성 전 generate primary, 생성 후 regenerate secondary + 최종 저장 primary. 취소/닫기 tertiary |
| Diary | 초안 정리/저장 primary, 직접 작성/재생성 secondary, 사진 첨부·변경·제거/재료 확인/돌아가기 tertiary. 실제 일기 삭제는 outlined destructive, 최종 확인은 solid destructive |
| Calendar | 선택 날짜의 일기 진입 primary. 선택 날짜/오늘/기록 표시의 기존 대비·접근성 유지 |
| Chat | 중립 화면·추천 질문 유지. 기존 브랜드 전송 아이콘/포커스 유지, 비활성 전송은 명시적 회색 상태 |
| Report | 기록 남기기 primary, 일정 확인 secondary. AI의 실제 준비 상태 유지 |
| Onboarding | 다음/최종 저장 primary, 이전/건너뛰기 tertiary. 선택 체크와 기존 5단계 흐름 유지 |
| Profile/Settings/Spouse | 실제 저장·검색 primary, 편집·재조회 secondary, 취소/로그아웃 neutral. 로그아웃을 영구 삭제처럼 표시하지 않음 |

## 파일 역할

- `src/theme/colors.ts`, `src/theme/buttons.ts`: 기존 팔레트와 normal/pressed/disabled 역할별 색상.
- `src/components/action-button.tsx`: semantic variant API와 기존 모션을 유지한 눌림·비활성 표현. outline의 1px만큼 안쪽 padding을 보정해 기존 콘텐츠 박스·버튼 크기를 유지.
- `app/welcome.tsx`, `src/components/auth-screen.tsx`, `app/(tabs)/(records)/calendar.tsx`, `app/children.tsx`, `app/spouse.tsx`, `src/components/add-plan-modal.tsx`: 커스텀 버튼의 기존 크기·폰트·핸들러를 보존하면서 공통 역할 적용.
- `app/(tabs)/main.tsx`, `todo.tsx`, `(records)/diary.tsx`, `src/components/diary/diary-result.tsx`, `schedule-generation-modal.tsx`, `report/report-content.tsx`: 화면별 행동 우선순위와 저장/삭제 상태에 맞는 역할.
- 온보딩·등록·빠른 추가·날짜 모달: 다음/저장·취소/닫기·선택의 역할 통일.
- `app/mypage.tsx`, `chat.tsx`, `report.tsx`, `app-header.tsx`, `home-day-header.tsx`: 중립 로그아웃, 전송/헤더/날짜 이동의 실제 비활성 상태 색상.
- `tests/brand-colors.mjs`, `tests/brand-roles-ui.mjs`: 색상 개수 대신 실제 역할·대비·pressed/disabled/selected 상태·기존 동작 검사.
- `AGENTS.md`, `.harness/conventions.md`, `.harness/references/brand-colors.md`: 종전 Peach 기본/서로 다른 pastel 정책을 새 역할 정책으로 갱신.

전체 파일 목록은 PR diff를 기준으로 한다. API·DB·Worker·캐시·라우팅·입력/저장 핸들러·로고·타이포그래피·간격·애니메이션 타이밍·탭 구조는 변경하지 않는다. UI 테스트의 데이터는 Playwright 응답 fixture/미리보기 로컬 저장에만 사용된다.

## 검증과 화면 비교

색상 변경은 TDD 예외를 적용한다. 새 역할 일관성 검사에서는 수정 전 로그인 CTA가 peach라서 primary 기대와 불일치하는 RED를 확인했고, 수정 후 GREEN을 확인했다. 기존 palette-count 검사 대신 각 역할의 normal/pressed 텍스트 대비와 outline 대비를 계산하고, 저장·삭제 확인·후보 선택/해제·비활성 상태·실제 라우팅을 유지해서 검증한다.

화면 비교는 실행 환경의 `/tmp/grow-hierarchy/review.html` 및 `before/`, `after/`에 보존한다. 320/390/430/1024px 기본 화면과 Welcome/Login/Signup, 생성/선택/비활성·일기 작성/저장/삭제 상태를 포함한다. 수정 전 기본 화면 비교는 직전 main(PR #198)의 보존된 Web export를 사용했다. 이후 상태 캡처는 실제 앱의 테스트 전용 fixture와 미리보기 흐름을 사용한다.

필수 검증: typecheck, lint, format, colors, brand, brand UI, visual-polish, logo, launch motion, 영향 화면 UI 회귀 검사, Web/iOS/Android export, harness 테스트. 실제 실행 결과는 PR 본문에 기록한다.

실기기의 VoiceOver/TalkBack·Dynamic Type·네이티브 pressed/Safe Area·키보드는 미검증이다. Native export는 번들 검증이며 브라우저 fixture UI 검사를 라이브 API E2E로 주장하지 않는다.

기준 문서: [Apple HIG Color](https://developer.apple.com/design/human-interface-guidelines/color), [Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons), [Radix scales](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale), [WCAG contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [Non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

## 변경 파일 전체 목록

- `.harness/conventions.md`
- `.harness/references/brand-colors.md`
- `AGENTS.md`
- `apps/mobile/app/(tabs)/(records)/calendar.tsx`
- `apps/mobile/app/(tabs)/(records)/diary.tsx`
- `apps/mobile/app/(tabs)/chat.tsx`
- `apps/mobile/app/(tabs)/main.tsx`
- `apps/mobile/app/(tabs)/report.tsx`
- `apps/mobile/app/(tabs)/todo.tsx`
- `apps/mobile/app/children.tsx`
- `apps/mobile/app/mypage.tsx`
- `apps/mobile/app/onboarding.tsx`
- `apps/mobile/app/spouse.tsx`
- `apps/mobile/app/welcome.tsx`
- `apps/mobile/src/components/action-button.tsx`
- `apps/mobile/src/components/add-plan-modal.tsx`
- `apps/mobile/src/components/app-header.tsx`
- `apps/mobile/src/components/auth-screen.tsx`
- `apps/mobile/src/components/child-registration-modal.tsx`
- `apps/mobile/src/components/diary/diary-result.tsx`
- `apps/mobile/src/components/home-day-header.tsx`
- `apps/mobile/src/components/home-quick-add.tsx`
- `apps/mobile/src/components/onboarding/child-onboarding.tsx`
- `apps/mobile/src/components/onboarding/date-field.tsx`
- `apps/mobile/src/components/onboarding/onboarding-steps.tsx`
- `apps/mobile/src/components/report/report-content.tsx`
- `apps/mobile/src/components/schedule-generation-modal.tsx`
- `apps/mobile/src/theme/buttons.ts`
- `apps/mobile/src/theme/colors.ts`
- `apps/mobile/tests/brand-colors.mjs`
- `apps/mobile/tests/brand-roles-ui.mjs`
- `apps/mobile/tests/chat-ui.mjs`
- `apps/mobile/docs/button-hierarchy.md`

기존 질문 UI 검사에서 포커스/화면 높이 변경 후 스크롤된 제목을 측정하던 실패는 변경 전 main에서도 재현했다. 제목을 스크롤해서 보이게 한 뒤 기존 위치·크기 기준을 검사하도록 테스트 준비만 보정했으며, 새 기준을 기존 main과 수정본 모두에서 통과시켰다.

## 실제 실행 결과

- 통과: `typecheck`, `lint`, `format:check`, `test:colors`, `test:brand`, `test:brand:ui`, `test:visual-polish`.
- 통과: `test:schedule:ui`, `test:diary:ui`, `test:children:onboarding:ui`, `test:children:ui`, `test:auth:ui`, `test:report:ui`, `test:main:ui`, `test:main:motion`, `test:tabs:ui`, `header-entry.mjs`, `test:chat:ui`, `test:chat:status`, `test:spouse`.
- 통과: `test:logo`, `launch-transitions.mjs`(테스트 전용 CDP Chrome), Web/iOS/Android export, harness unittest 58개.
- 기존 파스텔 정책의 UI 검사도 변경 전에 통과시켜 기준 캡처를 남겼다. 새 Primary 기대가 기존 Peach와 달라지는 RED는 의도한 실패다.
- 초기 인증 검사 실행의 Chrome 경로/URL 설정 오류는 실제 설치된 Chromium과 올바른 인자로 수정해 통과했다. 질문 화면의 기존 스크롤 측정 실패는 위에서 설명한 준비 단계 보정 후 기준 main·수정본 모두 통과했다.
- 최종 미해결 검사 실패는 없다. 실기기 검증 및 라이브 API E2E는 실행하지 않았다.
