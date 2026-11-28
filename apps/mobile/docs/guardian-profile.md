# 마이페이지와 보호자 프로필

상단 AppHeader의 두 진입점을 `내 프로필 열기` 하나로 통합한다. `/mypage`는 내 프로필,
가족(기존 `/children`), 계정/알림 안내, 개인정보의 기록 관리, 앱 버전, 로그아웃 순서다.
가짜 가족 검색, 비밀번호 변경·탈퇴·정책 URL, 동작하지 않는 알림 토글은 제공하지 않는다.
하단 5개 탭과 기존 일기/기록/아이 관리 기능은 유지한다.

## 계약과 저장

- `GET /api/v1/users/me`: JWT 주체의 `{ id, name, email }`
- `PATCH /api/v1/users/me`: `{ name }`만 수정, 같은 프로필 응답
- 성공 응답 `Cache-Control: no-store`, 인증 없음 401, 사용자 없음 404,
  이름/JSON 검증 실패 400 (`INVALID_REQUEST`), 미지원 미디어 415
- 공백 이름 금지, 요청 이름 50 UTF-16 단위 이내, 저장 시 앞뒤 Unicode 공백 제거
- 이메일·ID·비밀번호를 수정하는 계약이 아니다. 요청의 추가 필드로 다른 사용자를 지정하지 못한다.
- 기존 `users.name`, `email`을 재사용하며 테이블/컬럼/마이그레이션은 추가하지 않는다.
- UserProfileService는 프로필의 최소 조회 저장소를 사용해 인증 서비스 내부에 의존하지 않는다.
  수정은 트랜잭션 안에서 조회한 User의 이름만 바꾸며 JPA 변경 감지로 저장한다.

## 모바일 상태와 이동

`features/user/userApi.ts`, `useUserProfile`과 기존 AuthProvider/QueryClient를 사용한다.
키는 `['userProfile', accountKey, epoch]`이며 인증 계정에서만 조회한다.
로그아웃/계정 변경 시 기존 AuthProvider가 캐시와 세션 입력을 지우고 화면을 다시 구성한다.
성공한 수정 응답을 해당 키에 바로 반영하고 마이페이지로 돌아간다. 포커스 시 서버를 재확인한다.
프로필 화면은 인증된 사용자만 접근한다.

폼은 기존 이름을 표시하고 이메일은 읽기 전용 텍스트로 제공한다. 무변경/잘못된 이름은 저장하지
않으며 저장 중 중복 요청과 뒤로 가기를 차단한다. 실패하면 입력을 유지한다.
미저장 이름의 뒤로 가기는 공통 Modal로 확인하며 Web 새로고침에는 beforeunload를 사용한다.
키보드 대응 ScrollView/KeyboardAvoidingView, Safe Area, 최대 너비 600을 사용한다.
아이 조회의 로딩/미등록/실패를 구분하며 실제 변경은 기존 관리 화면에서 수행한다.

## 검증과 한계

프로필 Controller/Service/H2 Integration 테스트는 인증 경계·입력 검증·응답 노출 범위,
다른 계정 불변, 비밀번호/이메일 보존, 저장 후 조회와 실제 재로그인을 검사한다.
기존 아이/Swagger 검사와 모바일 인증·아이·온보딩·메인·탭 회귀 검사를 함께 실행한다.
`npm run test:profile:ui`는 조회/오류/수정/캐시/재조회, 미저장 뒤로 가기, 중복 저장,
비로그인 접근 차단, 계정 변경 시 이전 이름 비노출과 보호 라우트를 검사한다.
브라우저 fixture는 실 API 배포를 증명하지 않으며, 네이티브 export는 기기 실행을 대신하지 않는다.
실기기 키보드·Safe Area·시스템 뒤로 가기·VoiceOver/TalkBack과 설치형 PWA는 추가 확인한다.

OAuth는 User와 인증 자격/Provider identity를 분리하고 `(provider, providerSubject)` 유일성을
보장하는 별도 계약·마이그레이션이 필요하다. 현재 필수 passwordHash에 가짜 값을 채우거나 이메일만으로
외부 계정을 자동 연결하지 않는다. 가족 연결은 계정과 Family/FamilyMember/Child 접근 권한을 구분하고
초대/승인/역할을 별도 설계한다. 이번 작업에는 관련 테이블·가짜 상태·연결 버튼을 추가하지 않았다.
