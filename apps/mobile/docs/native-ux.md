# Native UX와 홈 화면

홈은 질문 초안 작성과 오늘 일정 확인/완료에 집중한다. 실제 AI 연결은 준비 중이며, 홈의 보내기 버튼은 같은 세션의 초안을 유지한 채 Chat 입력창으로 이동한다. 추천 질문은 비어 있지 않은 초안을 덮어쓰지 않는다.

## 내비게이션

Expo SDK 55 / Router 55.0.18에서 Native Tabs는 `unstable-native-tabs`이다. 기존 브랜드, 웹 링크, 화면 상태 보존을 함께 지원하기 위해 이미 설치된 React Navigation 기반 Expo Router JS Tabs를 사용한다. SDK 업그레이드는 하지 않았다.

- `(tabs)`에서 오늘·일정·기록·리포트·질문을 관리한다. 수동 `BottomNavigation`은 제거했다.
- 기록 탭 안의 Stack이 Calendar와 Diary를 관리한다. `/main`, `/todo`, `/calendar`, `/diary`, `/report`, `/chat` 주소와 날짜 파라미터를 유지한다.
- 탭 왕복 시 화면의 보기 모드, 스크롤, 날짜/월, 질문/일기 초안이 유지된다. 현재 탭 재선택은 스크롤 최상단 이동 또는 기록 Stack 복귀에 사용된다.
- 설정/프로필/페르소나는 상위 Stack의 상세 화면이다. 설정의 뒤로 가기, 프로필의 기존 변경사항 보호, 페르소나의 질문 복귀 경로를 유지한다.
- 일기 저장/정리/사진 처리 중 탭을 실제 비활성화하고 접근성 상태도 전달한다. 기존 `usePreventRemove` 보호를 유지한다.
- 인증 보호와 epoch 기반 Navigator/캐시/세션 메모리 초기화는 유지한다. 일반 탭 이동은 화면을 재생성하지 않는다.

### Floating Pill Navigation

`FloatingTabBar`가 기존 JS Tabs의 `tabBar` 렌더러를 대체한다. 화면/Stack/탭 개수는 바꾸지 않고 아이콘과 라벨을 함께 표시한다. `TabIcon`의 작은 선택 타원은 제거하고, 바 전체에서 하나의 선택 캡슐을 이동시킨다.

- 흰색 `surface` 바는 높이 56px, 반경 28px, 좌우 여백 18px와 좌우 Safe Area를 사용한다. 넓은 웹에서는 최대 520px로 중앙 정렬한다.
- 선택 배경은 기존 `tint`로 50×70px이며 바 위아래로 7px씩 돌출된다. 아이콘은 `brand`, 작은 라벨은 대비가 확보된 `onTint`를 사용한다. 비선택 라벨/아이콘은 `muted`다. 새 팔레트는 추가하지 않는다.
- 선택 캡슐의 하단은 Safe Area보다 10px 위에 위치한다. 돌출부를 포함한 `80 + insets.bottom` 공간을 일반 레이아웃에서 확보하므로 콘텐츠를 덮지 않는다. 실제 높이를 React Navigation에 전달해 키보드 숨김과 Safe Area 변경도 반영한다.
- 선택 위치는 Reanimated의 `motion.state`(220ms)로 전환하고 Reduce Motion에서는 즉시 확정한다. 창 크기 변경 시 각 탭의 새 중심으로 정렬한다. 터치 피드백은 기존 `TabButton`/`MotionPressable`을 재사용한다.
- 웹 href/수정키 클릭, `tabPress`의 취소와 재선택 동작 데이터, `tabLongPress`를 유지한다. 네이티브 키보드는 공통 Keyboard 이벤트로, 웹 Chat/Diary는 기존 focused viewport 신호로 숨김을 결정한다.
- 터치 영역은 최소 44px, 라벨은 11px이며 글꼴 확대는 1.4배까지 허용한다. iOS는 기존 Navigator와 동일하게 button 역할 및 선택 상태, Large Content Viewer를 제공하고 웹/Android는 tab 역할을 사용한다. 실제 VoiceOver/TalkBack 검증은 별도 기기에서 필요하다.

`npm run test:tabs:ui`는 `tests/floating-tabs.mjs`를 실행한다. 반응형 레이아웃·Safe Area·라벨·링크/Enter 이동·선택 배경의 실제 중간 프레임·Reduce Motion을 검사한다. `test:native-ux`의 navigation 단계와 `test:diary:ui`, `test:chat:keyboard`로 기존 초안·스크롤·저장 차단·키보드 회귀를 함께 확인한다.

## 데이터와 피드백

오늘 전체 일정으로 완료 수/전체 수와 진행률을 계산한다. 미완료 우선, 각 그룹 안에서 시간순, 동시간은 ID순으로 최대 세 개를 표시한다. 시간이 지난 미완료 일정은 별도 상태 문구로 표시한다. 모든 일정이 완료되면 추가 활동을 권유하지 않는다.

기존 `createTodoApi.setCompletion`과 `PUT /api/v1/todos/{id}/completion`의 `{ completed }` 계약을 그대로 사용한다. 서버 성공 전에는 체크 상태를 변경하지 않으며 같은 요청을 중복 전송하지 않는다. 성공 응답을 날짜별 캐시에 반영하고 해당 날짜를 다시 조회한다. 실패/응답 유실에는 상태 확인과 재시도를 안내한다. 인증 epoch가 바뀐 응답은 캐시에 쓰지 않는다. 자정과 foreground 전환 시 날짜/데이터를 갱신한다.

`src/theme`에 색상·타이포그래피·간격·모서리·motion을 모았다. 기존 typography import는 호환 export를 유지한다. 본문/입력/버튼은 시스템 글꼴, 브랜드 제목은 Jua를 사용한다. Reanimated로 체크 색상과 얇은 진행률을 짧게 전환한다. 시스템 Reduce Motion을 초기 조회하고 변경도 구독하며 Stack/Sheet/탭 바/재선택 스크롤에도 적용한다.

추가 의존성은 SDK 호환 `expo-haptics ~55.0.18` 하나다. 일정 완료와 저장 성공에만 사용하며 iOS/Android에서 호출하고 웹에서는 실행하지 않는다. 장치 설정 등으로 진동이 제공되지 않아도 업무 흐름에는 영향을 주지 않는다.

## Sheet와 키보드

`@gorhom/bottom-sheet` 5.2.14의 peer 범위는 현재 Reanimated/Gesture Handler를 포함하지만, 새 제스처 라이브러리를 추가하지 않아도 요구사항을 충족할 수 있어 기존 RN Modal을 사용했다. 모바일은 하단 Sheet와 slide 전환, 웹은 가운데 Dialog와 기존 입력 동작을 제공한다. Reduce Motion에서는 전환을 생략한다. 드래그 대신 명시적 닫기와 Android Modal back을 지원한다.

변경된 입력을 닫을 때는 계속 작성/내용 버리기를 선택한다. 저장 중에는 닫기와 중복 제출을 차단한다. 제목·시간·길이 검증과 실패 시 입력 보존, 응답 유실 안내를 유지한다. 키보드 위로 폼을 이동하고 내용은 스크롤하며 저장 버튼은 별도 footer에 둔다.

Chat/Diary/일정 폼은 native KeyboardAvoidingView와 웹 visualViewport 대응을 사용한다. Chat과 Diary의 키보드가 열리면 공통 탭 바를 숨긴다. 탭 바가 하단 Safe Area를 소유하고 개별 화면에서는 중복 적용하지 않는다. 별도 Keyboard Controller는 추가하지 않았다.

## 검증

제품 코드에는 테스트 일정이나 진행률을 넣지 않았다. Playwright의 API 응답 가로채기/인증 fixture는 테스트에만 사용한다. `test:native-ux`도 **웹에서 모바일 UX 동작을 검사하는 테스트**이며 실기기 테스트가 아니다.

```bash
# apps/mobile, .env.example에 맞는 공개 환경변수 사용
EXPO_PUBLIC_API_URL=http://localhost:8080 npx expo start --web --port 8158

# 실행 중인 웹 서버와 사용 가능한 Chromium 경로를 지정한다.
export MOBILE_URL=http://localhost:8158
export MAIN_URL=$MOBILE_URL CHAT_URL=$MOBILE_URL CALENDAR_URL=$MOBILE_URL
export CHILDREN_URL=$MOBILE_URL
export BROWSER_EXECUTABLE_PATH=/path/to/chrome
export CHROME_PATH=$BROWSER_EXECUTABLE_PATH

npm run typecheck
npm run lint
npm run format:check
npm run test:native-ux
npm run test:main:ui
npm run test:ux
npm run test:calendar:ui
npm run test:plan -- http://localhost:8158
npm run test:chat:keyboard
npm run test:chat:composer
npm run test:chat:draft
npm run test:chat:status
npm run test:chat:polish
npm run test:children:ui
AUTH_TEST_PREVIEW=true node tests/auth-ui.mjs http://localhost:8158
npx expo export --platform web
```

API 클라이언트/세션 검사는 기존 todo-api, auth-session, child-api/child-query, diary-api 테스트를 사용한다. `test:auth:api`는 별도 격리된 API와 짧은 JWT 만료 설정을 요구하므로 서버 없이 통과했다고 간주하지 않는다.

iOS/Android JS/Hermes export는 의존성 번들링 확인이다. 장치의 swipe-back, 시스템 뒤로 가기, 실제 키보드/노치, Haptic 강도 및 VoiceOver/TalkBack은 기기 또는 시뮬레이터에서 추가 확인해야 한다. 백엔드/API/worker/생성·저장 계약과 Vercel 배포 설정은 바꾸지 않았다.

참고: [Expo JS Tabs](https://docs.expo.dev/router/advanced/tabs/), [Native Tabs의 SDK별 API](https://docs.expo.dev/router/advanced/native-tabs/), [SDK 55 Haptics](https://docs.expo.dev/versions/v55.0.0/sdk/haptics/), [Keyboard handling](https://docs.expo.dev/guides/keyboard-handling/).
