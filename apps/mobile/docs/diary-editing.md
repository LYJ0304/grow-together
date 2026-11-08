# 기록과 일기 작성

기록 탭은 기존 `/calendar`, 일기는 `/diary?date=YYYY-MM-DD` 경로를 유지한다. 날짜 선택과 일기·질문 초안은 세션 메모리에 남으며 탭 왕복으로 사라지지 않는다. 로그아웃·계정 전환·미리보기 전환 시 초기화되고 앱 종료나 웹 새로고침 후 복원하지 않는다. 웹 종료에는 미저장 내용이 있을 때 확인을 제공한다.

## 로그인 상태

선택 날짜의 실제 완료 일정만 재료 후보로 조회한다. 일정 메모는 계획일 수 있으므로 관찰로 자동 포함하지 않는다. 관찰 메모를 추가하고 `입력한 기록으로 초안 정리` 또는 `직접 작성하기`를 선택한다. 현재 초안 정리는 로컬 문장 조합이며 LLM이나 worker 호출이 아니다. 재정리로 수정본을 교체할 때 확인하고 실패·취소 시 수정본을 보존한다.

저장은 기존 `/api/v1/diary` CRUD를 사용한다. 본문(최대 1000자)과 선택한 일정 ID를 저장하고, 기존 일기 본문 수정에는 서버가 반환한 일정 연결과 사진 URL을 유지한다. 새 사진 업로드는 제공하지 않는다. 조회 실패를 기록 없음으로 취급하지 않는다. `/diary?id=ID&mode=view`로 서버 일기를 조회할 수 있다.

서버 일기에는 날짜 필드·날짜별 목록 조회가 없다. 캘린더에는 **현재 세션에서 저장한 ID와 입력 날짜의 대응만** 표시하며 전체 서버 기록이라고 표현하지 않는다. 날짜·관찰 메모 원본·초안 재료는 서버에서 별도로 보존되지 않는다. 계정 데이터용 임시 기기 저장을 추가하지 않는다. 신규 저장의 응답이 유실되면 중복 가능성을 안내하고, 사용자가 확인하기 전까지 즉시 재제출하지 못하게 한다. 이는 서버의 멱등성이나 중복 방지를 보장하지 않는다.

## 미리보기와 과거 데이터

미리보기는 `@growtogether/diary/preview/v2/`에 기기 전용 일기를 저장한다. 사진은 기존 크기 조절·base64 변환을 사용하며 최대 3장이다. 실패하면 본문과 사진을 유지하고 다시 저장할 수 있다. 본문 수정은 사진·관찰·기타 메타데이터를 보존한다.

과거 `@growtogether/diary/v1/` 데이터는 소유자를 판별할 수 없다. 삭제·자동 계정 귀속·자동 이전 없이 그대로 보존하고, 일반 계정 및 새 미리보기 목록에 표시하지 않는다. 소유자 확인과 이전은 별도 작업이다.

## 아직 연결되지 않은 기능

- worker 추천·일기 생성: 인증된 외부 API와 내부 worker 중계 계약 필요. 모바일에 서비스 키를 넣지 않는다.
- 추천 준비물·이유: 실제 응답 필드가 없으므로 생성해 표시하지 않는다.
- 활동 반응·사진 업로드: 전용 저장 계약이 없다. 완료 성공 후 안내 패널에서는 기존 일정 메모 편집만 연결한다.
- 일정 미룸·건너뜀: 현재 상태는 예정/완료뿐이다. 완전한 겹침 검사에는 기간 정보가, 중복 저장 방지에는 서버 정책이 필요하다.
- 질문 답변: 육아 도우미 연결 준비 상태이며 초안만 보존한다. 가짜 답변이나 스트리밍을 제공하지 않는다.

## 검증

기본 검사는 `npm run typecheck`, `npm run lint`, `npm run format:check`와 기존 API·인증·저장소 단위 검사다. UI 검사는 Expo web export를 제공하는 서버가 필요하다.

```sh
EXPO_PUBLIC_API_URL=http://localhost:8080 npx expo export --platform web --clear --output-dir /tmp/growtogether-web
python3 - <<'PY_SERVER'
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        target = super().translate_path(path)
        return target + '.html' if Path(target + '.html').is_file() else target
ThreadingHTTPServer(('127.0.0.1', 8156), partial(Handler, directory='/tmp/growtogether-web')).serve_forever()
PY_SERVER
# 별도 터미널, apps/mobile에서 실행
MOBILE_URL=http://localhost:8156 BROWSER_EXECUTABLE_PATH=/usr/bin/google-chrome npm run test:ux
MAIN_URL=http://localhost:8156 MOBILE_URL=http://localhost:8156 BROWSER_EXECUTABLE_PATH=/usr/bin/google-chrome npm run test:main:ui
CALENDAR_URL=http://localhost:8156 BROWSER_EXECUTABLE_PATH=/usr/bin/google-chrome npm run test:calendar:ui
MOBILE_URL=http://localhost:8156 BROWSER_EXECUTABLE_PATH=/usr/bin/google-chrome npm run test:diary:saved-edit
```

UI 검사의 API 응답은 모킹한다. 작은 화면·큰 글씨·긴 본문·줄어든 viewport 확인은 실제 iOS/Android 키보드, 사진 권한, 시스템 뒤로 가기 검증을 대신하지 않는다.
