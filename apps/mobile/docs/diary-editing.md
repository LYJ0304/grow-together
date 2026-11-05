# 저장된 일기 본문 수정

캘린더에서 저장된 일기를 열고 `수정`을 누르면 기존 본문을 편집할 수 있다. `변경사항 저장`은 이미 존재하는 일기의 본문만 갱신하며 사진·날짜·감정·성장 포인트·제안·원본 기록 및 기타 저장 필드를 유지한다. `취소`와 저장 실패는 원본을 보존한다.

현재 화면은 기존 AsyncStorage 저장소를 사용한다. 신규 생성용 `saveDiary()`는 같은 날짜의 중복 생성을 계속 거부하고, `updateDiary()`는 누락·손상된 일기를 새로 생성하지 않는다. 서버 동기화·날짜/사진 편집·저장된 일기 재생성은 이번 범위에 포함하지 않는다.

편집 중 빈 본문은 저장할 수 없다. 저장 중에는 중복 저장·본문 입력·취소·삭제·뒤로 가기를 막고, 저장하지 않은 변경이 있는 상태에서 화면을 나가면 확인을 요청한다. 여러 탭/프로세스 사이의 동시 편집 트랜잭션이나 계정별 서버 저장은 제공하지 않는다.

검증 명령은 `npm run test:diary`, `npm run test:calendar`, `npm run test:diary-generation`이다. Expo web export를 제공하는 서버를 준비한 뒤 아래 UI 검사를 실행한다. 브라우저 경로와 서버 주소는 실행 환경에 맞게 바꾼다.

```sh
CHROME_PATH=/opt/google/chrome/chrome node tests/diary-saved-edit.mjs http://localhost:8131
CHROME_PATH=/opt/google/chrome/chrome node tests/diary-result.mjs http://localhost:8131
CHROME_PATH=/opt/google/chrome/chrome node tests/diary-navigation.mjs http://localhost:8131
CALENDAR_URL=http://localhost:8131 BROWSER_EXECUTABLE_PATH=/opt/google/chrome/chrome npm run test:calendar:ui
```
