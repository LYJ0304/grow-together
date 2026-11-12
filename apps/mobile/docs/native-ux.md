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

### Shared soft-glass Floating Tab Bar

`FloatingTabBar`는 기존 Expo Router JS Tabs의 공통 렌더러다. iOS·Android·Web에서 같은 아이콘, 라벨, 배치와 피치색 선택 영역을 사용한다. OS별 Native Tabs나 Liquid Glass, 별도 navigation 라이브러리로 전환하지 않는다.

- 바는 높이 70px·반경 35px, 좌우 여백 20px + 좌우 Safe Area, 최대 너비 520px로 중앙 정렬한다. 흰색 반투명 `navigationSurface`와 1px `navigationEdge`, 약한 그림자로 표현한다.
- 선택 영역은 바 내부 행의 실제 너비를 탭 수로 나눈 크기이며 높이 56px다. 테두리와 padding 안에서 정렬되므로 바 밖으로 돌출되지 않는다. 기존 `tint`와 `brand` 아이콘, 대비를 확보한 `onTint` 라벨을 사용한다.
- 선택 배경은 Reanimated `motion.state`(220ms)로 이동한다. 아이콘은 동일한 SVG의 muted/brand 색상 레이어를 교차 페이드해 플랫폼별 SVG tint 애니메이션 차이를 피한다. Reduce Motion에서는 위치와 색상을 즉시 확정한다.
- 다른 탭으로의 일반 이동이 허용되면 native `selectionAsync`로 가벼운 선택 피드백을 제공한다. 웹·재선택·차단·취소된 tabPress에는 호출하지 않는다. 장치에서 피드백이 불가능해도 이동에는 영향을 주지 않으며 저장 성공 알림과 구분한다.
- 하단 Safe Area + 10px와 바를 포함한 `80 + insets.bottom` 공간을 기존 일반 레이아웃에서 예약한다. 각 ScrollView에 임의의 100~120px padding을 추가하거나 바를 콘텐츠 위에 덮지 않는다. 키보드 숨김 시 실제 높이를 0으로 React Navigation에 전달한다.
- 기존 `TabButton`/Press Feedback, href·수정키 링크, 취소 가능한 tabPress와 재선택 스크롤/Stack 동작 데이터, tabLongPress, 저장 중 이동 차단과 초안 보존을 유지한다.
- 터치 영역은 최소 44px, 라벨은 11px이며 글꼴 확대는 1.4배까지 지원한다. iOS의 기존 button 역할·선택 상태·Large Content Viewer와 Web/Android의 tab 역할을 유지한다.

이번 단계는 세 플랫폼의 동일한 반투명 색상 표현이며 실제 배경 blur/refraction은 아니다. `expo-blur`/`BlurTargetView`나 플랫폼별 glass 효과는 추가하지 않는다. 향후 blur가 필요하면 content-overlap, 플랫폼 지원, Reduce Transparency, 성능을 별도 검토한다. VoiceOver/TalkBack과 실제 native 키보드·햅틱은 기기 검증이 필요하다.

`npm run test:tabs:ui`는 `tab-feedback.mjs`의 native/web 피드백 분기 검사와 `floating-tabs.mjs`의 반응형·Safe Area·라벨·링크/Enter·수정키 이동·선택 배경과 아이콘의 실제 중간 프레임·Reduce Motion 검사를 실행한다. `test:native-ux` navigation 단계, `test:diary:ui`, `test:chat:keyboard`로 초안·스크롤·저장 차단·키보드 회귀를 확인한다.

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
