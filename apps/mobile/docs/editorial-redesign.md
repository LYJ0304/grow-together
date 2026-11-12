# Editorial UI 개선

첨부 `codex_prompt.md`, `README.md`, 두 HTML과 12개 화면 PNG를 참고했다. HTML은 디자인 의도 확인에만 사용했고 데모 데이터/코드를 앱에 이식하지 않았다.

## 화면과 파일

| 화면 | 변경과 담당 파일 |
| --- | --- |
| 공통 | `src/theme/editorial.ts`, `src/components/page-intro.tsx`, `app-header.tsx`: 기존 색상 토큰 기반 제목·설명·카드·세그먼트와 공통 도구 헤더 |
| 오늘 | `app/(tabs)/main.tsx`, `home-day-header.tsx`: 실제 계획/완료/일기 수, 순간→일정→질문 순서, 따뜻한 기록 진입 영역 |
| 빠른 추가 | `home-quick-add.tsx`: 일기/수동 일정/AI 추천 선택. 선택 자체는 저장하지 않음. 선택 날짜와 기존 초안 유지 |
| 일정 | `app/(tabs)/todo.tsx`, `schedule-generation-modal.tsx`: 7일 스트립, 시간/할 일, 입력·후보·확정 흐름 유지. 작은 화면에서도 날짜 터치 영역 44px |
| 기록 | `app/(tabs)/(records)/calendar.tsx`: 캘린더/모아보기, 기존 월별 저장 날짜 조회 재사용, 날짜별 상세 진입, 로딩/실패/빈 목록 구분 |
| 일기 | `app/(tabs)/(records)/diary.tsx`, `diary/diary-result.tsx`: 공통 제목·지면 스타일, 재료/초안/편집/명시적 저장 로직 유지 |
| 리포트 | `app/(tabs)/report.tsx`, `report/report-content.tsx`: 주 선택과 실제 준비 상태 유지, 빈 데이터와 미연동 구분 |
| 질문 | `app/(tabs)/chat.tsx`: 추천 질문·작성 영역 정리, AI 미연결 안내와 세션 초안 유지 |
| 온보딩 | `onboarding/child-onboarding.tsx`, `onboarding-steps.tsx`, `onboarding-styles.ts`: 5단계 공통 위계, 마지막 단계는 AI 결과가 아닌 입력 확인으로 표시 |
| 프로필/설정 | `app/children.tsx`, `app/mypage.tsx`: 프로필 카드·개인화 편집, 실제 기록 관리 링크·AI 안내 |

## 실제 기능과 경계

새 API, DB, Worker 변경이나 의존성 추가는 없다. 인증·계정 격리·Query 캐시 정책·일정 완료 및 생성 로직·일기 저장 로직은 유지한다. 모아보기는 기존 월별 일기 날짜 조회의 결과만 사용하며 존재하지 않는 제목이나 발췌를 만들지 않는다. 목록 표시 방식은 기존 계정별 세션 상태로 보존한다.

현재 모바일 리포트 어댑터와 질문 AI 연결은 기존 main에서도 미구현이다. 준비 상태를 명확히 노출하며 가상 통계/진단/성장 점수/답변을 추가하지 않는다. 실제 리포트 데이터 연결은 후속 구현이 필요하다.

## 검증 및 캡처

- 신규 행동: `npm run test:editorial:ui`. 빠른 추가가 없이 바로 일기로 이동하는 기존 동작과 목록 전환 부재에서 RED를 확인한 뒤 구현하여 GREEN 확인.
- 스타일 변경은 TDD 예외로 실제 화면 캡처와 기존 회귀 검사를 사용.
- `npm run test:editorial:captures`: 320/390/430/1024px의 8개 주요 화면과 설정 화면. 테스트 데이터는 Playwright 요청 fixture에만 존재한다.
- 캡처 위치: `/tmp/grow-editorial/before/`, `/tmp/grow-editorial/after/`. 캡처는 테스트용 인증과 실제 응답 형태의 fixture 사용 결과이며 라이브 API 동작 증명은 아니다.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, 색상/브랜드·리포트·주요 UI 회귀 검사.
- `EXPO_PUBLIC_API_URL=http://localhost:8080 EXPO_OFFLINE=1 npx expo export --platform all --output-dir /tmp/grow-editorial-export`.

Native export는 번들 검증이다. 실제 iOS/Android 기기의 키보드, VoiceOver/TalkBack, Dynamic Type, 모달 포커스와 시스템 뒤로 가기 실기기 검증은 별도로 필요하다. 모션은 기존 Reduce Motion 설정과 공통 컴포넌트를 사용한다.

기존 프로필 UI 테스트가 현재 main의 `/children` 빈 상태를 온보딩 화면으로 가정하고 있었다. 현행 빈 프로필·계정 데이터 비노출·API 오류/재시도를 직접 검증하도록 갱신했다. 화면 자체의 등록 정책을 변경하지 않았다. 제목/상태 문구 변경을 반영한 기존 테스트도 함께 갱신했다.
