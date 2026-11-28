# 기록 탐색 화면

`app/(tabs)/(records)/calendar.tsx`는 같은 일기 데이터를 캘린더와 모아보기로 보여준다.
모아보기는 기존과 같이 **표시 월의 일기를 최신 날짜 순서로 탐색**하는 목록이다.
전체 기간 검색·유형 필터·사진 갤러리는 기존 모델에 없어 추가하지 않았다.
월별 API는 ID와 날짜만 제공하므로 제목이나 작성 시각을 만들어 표시하지 않는다.

## 날짜와 화면 상태

- 세션의 `calendarDate`, `calendarMonth`, `recordsView`와 기존 route 복귀/초안을 유지한다.
- 기본 캘린더는 월요일 시작 7일이다. 펼치면 같은 주 시작의 월간 그리드가 나타나고,
  날짜 선택 후 주간으로 돌아간다. 월 이동은 같은 일자를 유지하되 월말로 보정한다.
- 연월 바로 이동은 기존 공통 DateSelection 모달의 연도 직접 입력·월·일 선택을 재사용한다.
- 오늘은 외곽선, 선택 날짜는 채움, 기록 유무는 별도 점과 접근성 레이블로 구분한다.
- 주간/월간 경계의 날짜 마커를 위해 보이는 날짜 범위에 필요한 월 목록도 조회한다.
- 날짜 계산은 기존 calendar 유틸리티와 diaryDateKey/parseDiaryDate의 로컬 날짜를 사용한다.

## 데이터와 성능

- 로그인한 사용자는 기존 `/api/v1/diary?month=YYYY-MM`와
  `/api/v1/diary/by-date?date=YYYY-MM-DD`를 사용한다. API/DB 계약은 변경하지 않았다.
- 월 마커의 `savedDiaryDates` 키를 유지하며 실제 표시 범위의 월별 조회를 공유한다.
- 두 뷰의 RecordCard는 `diaryByDate` 캐시의 원본 데이터를 공유한다. `select`로 UI에 필요한
  본문·첫 사진·실제 ID만 투영하므로 Main/DiaryEditor의 캐시 형식은 바꾸지 않는다.
- 월 최대 31개 날짜를 FlatList로 렌더링한다. 실제 보이는 카드만 상세 조회를 활성화하며
  숨겨진 카드 전체의 본문/사진을 미리 요청하지 않는다. 빠른 뷰 전환은 30초 freshness를
  사용하고, 화면 복귀·기존 생성/수정/삭제 invalidate는 최신 자료를 다시 확인한다.
- 월 목록/상세의 로딩·빈 결과·오류는 구분한다. 상세 실패 시 확인된 기록을 빈 날짜로
  바꾸지 않고 다시 불러오기를 제공한다. 사진이 없거나 로드되지 않으면 텍스트 레이아웃을 쓴다.
- 기존 세션별 초안 이어쓰기, 상세의 date/mode/실제 ID, 저장/삭제 알림을 유지한다.

## Safe Area와 검증

탭 바가 이미 높이와 하단 Safe Area를 예약하므로 화면은 top/left/right만 적용하고,
목록 끝에 24px 여백만 둔다. 전환의 시각적 높이는 36px, 실제 버튼은 최소 44px다.
날짜 셀도 320px에서 44px 이상이며, 불안정한 높이 애니메이션이나 새 달력 패키지는 추가하지 않는다.

Web export 서버를 실행한 뒤 `apps/mobile`에서:

```sh
BROWSER_EXECUTABLE_PATH=/usr/bin/chromium MOBILE_URL=http://localhost:8251 npm run test:records:ui
BROWSER_EXECUTABLE_PATH=/usr/bin/chromium CALENDAR_URL=http://localhost:8251 npm run test:calendar:ui
BROWSER_EXECUTABLE_PATH=/usr/bin/chromium MOBILE_URL=http://localhost:8251 npm run test:diary:dates
node tests/tab-scroll-target.mjs
```

타입/린트/포맷 검사, 기존 저장/수정/삭제·초안 검사를 함께 실행한다. 브라우저 테스트와
Web/iOS/Android export는 실기기 동작을 증명하지 않는다. iOS Safari·설치형 PWA의 홈 인디케이터,
Android 시스템 내비게이션·뒤로 가기, 네이티브 VoiceOver/TalkBack은 기기에서 별도 확인한다.
