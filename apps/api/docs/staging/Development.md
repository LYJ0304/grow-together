# API staging 배포 가이드

이 문서는 **개발 검증용 staging 환경**을 Render 무료 Web Service와 Render 무료 Postgres로 구성하는 방법을 설명한다. production 배포 절차는 다루지 않는다.

설정은 Render 대시보드에서 진행하며 CLI 설치는 필요하지 않다. API는 기존 Dockerfile로 실행하고, DB는 별도 Render Postgres 리소스로 생성한다. 로컬 개발용 `infra/compose.yaml`은 Render에서 실행하지 않는다.

## 1. 배포할 코드 준비

staging 서비스는 GitHub의 `staging` 브랜치를 배포한다. 로컬 커밋만으로는 Render에 반영되지 않는다.

1. 작업 브랜치를 push하고 `develop` 대상 PR을 만든다.
2. 검증 후 작업 PR을 squash merge한다.
3. `develop → staging` 승격 PR은 merge commit으로 병합한다.
4. Render에서 배포할 `staging` 커밋을 확인한다.

브랜치 병합과 실제 배포는 각각 별도 요청으로 진행한다. 전체 규칙은 [harness conventions](../../../../.harness/conventions.md)을 따른다.

저장소 루트에서 API 테스트와 Docker 이미지 빌드를 확인한다. 테스트에는 Docker와 Java 21이 필요하다.

```bash
cd apps/api
./gradlew test
```

Docker 이미지는 저장소 루트에서 빌드한다.

```bash
docker build -f apps/api/Dockerfile -t growtogether-api:staging .
```

Dockerfile은 `bootJar`를 빌드하며 테스트는 실행하지 않는다. 이미지 빌드 성공과 테스트 통과를 별도로 확인한다. 테스트 결과에서 PostgreSQL 통합 테스트가 생략되지 않았는지도 확인한다.

## 2. staging PostgreSQL 생성

[Render 대시보드](https://dashboard.render.com/)에서 **New → Postgres**를 선택한다.

| 항목 | 입력값 |
| --- | --- |
| Name | `growtogether-staging-db` |
| Database | `growtogether_staging` |
| User | 비워두어 자동 생성하거나 `growtogether` 지정 |
| Region | API와 동일한 리전 |
| PostgreSQL Version | `16` — 현재 API 통합 테스트와 동일 |
| Plan | `Free` |

DB가 준비되면 Info의 연결 정보에서 **내부 Hostname, Port, Database, Username, Password**를 확인한다. API에는 이 정보를 사용하고, 로컬·production DB와 공유하지 않는다.

동일 계정·리전의 API는 내부 주소로 연결한다. 외부에서 DB에 접속할 필요가 없다면 DB 설정에서 외부 접근을 비활성화한다. 이 구성에서는 별도 관리형 Connection Pooling을 추가하지 않는다.

무료 Render Postgres는 **생성 후 30일에 만료되어 접속이 중단**된다. 이후 14일의 유료 전환 유예 기간이 지나면 DB와 데이터가 삭제된다. 매달 자동 초기화되어 계속 제공되는 서비스가 아니다. 무료 DB에는 백업도 제공되지 않는다.

staging에는 폐기 가능한 테스트 데이터를 사용한다. 만료 후 새 DB를 만들면 API의 접속 정보도 다시 설정해야 하며, 기존 데이터는 자동 복원되지 않는다. 보존할 데이터가 필요해지면 백업·복원 또는 유료 DB 사용을 먼저 준비한다.

## 3. staging API Web Service 생성

**New → Web Service**에서 GitHub 저장소 `LYJ0304/grow-together`를 연결한다.

| 항목 | 입력값 |
| --- | --- |
| Name | `growtogether-staging-api` 또는 사용 가능한 고유 이름 |
| Branch | `staging` |
| Language / Runtime | `Docker` |
| Region | staging DB와 동일 |
| Root Directory | 비워두기 — 저장소 루트 사용 |
| Dockerfile Path | `apps/api/Dockerfile` |
| Docker Build Context Directory | `.` |
| Docker Command | 비워두기 — Dockerfile의 ENTRYPOINT 사용 |
| Plan | `Free` |
| Health Check Path | `/actuator/health` |
| Auto Deploy | 초기 검증 중에는 비활성화하고 수동 배포 |

API 이미지에는 루트 `contracts/openapi.yaml`이 포함되므로 **빌드 컨텍스트는 저장소 루트 `.`**이어야 한다. 기존 Render 설정의 Root Directory가 `apps/api`였다면 비우고 Dockerfile Path와 Build Context도 위 표대로 변경한다. 이전의 `apps/api` 빌드 컨텍스트로는 명세 파일을 복사할 수 없다.

Docker 실행 방식이므로 별도 Build/Start Command는 필요하지 않다. Render가 제공하는 `https://<서비스 이름>.onrender.com` 주소로 접근하며, HTTPS는 Render가 처리한다.

## 4. API 환경변수 설정

**API Web Service → Environment → Environment Variables**에 입력한다. DB 리소스의 환경변수 설정과 혼동하지 않는다.

| Key | Value | 설명 |
| --- | --- | --- |
| `SERVER_PORT` | `10000` | 현재 Spring API의 포트를 Render 기본 PORT와 맞춤 |
| `SPRING_PROFILES_ACTIVE` | `staging` | local 대신 staging 프로필 활성화 |
| `DATABASE_URL` | `jdbc:postgresql://<내부 Hostname>:5432/<Database>?sslmode=require` | Render Postgres 내부 접속 정보로 작성 |
| `POSTGRES_USER` | `<Username>` | DB 생성 후 표시되는 실제 사용자명 |
| `POSTGRES_PASSWORD` | `<Password>` | DB 생성 후 표시되는 실제 비밀번호 |
| `JWT_SECRET` | `<생성한 Base64 키>` | 아래 명령으로 생성 |
| `JWT_ACCESS_TOKEN_SECONDS` | `900` | 선택 사항, 기본값 15분 |
| `JWT_REFRESH_SESSION_SECONDS` | `1209600` | 선택 사항, 기본값 14일 |
| `CORS_ALLOWED_ORIGINS` | `<브라우저 프런트엔드 origin>` | 브라우저 호출이 있을 때 지정. 여러 주소는 쉼표로 구분 |

`<...>`는 실제 값으로 바꾸고, 대시보드 입력값에는 따옴표를 붙이지 않는다. Render가 제공하는 `postgresql://...` 전체 URL을 `DATABASE_URL`에 그대로 넣지 않는다. 현재 API는 **JDBC URL과 별도 사용자명·비밀번호**를 사용한다.

JWT 키는 로컬 터미널에서 생성한다.

```bash
openssl rand -base64 32
```

출력된 값을 `JWT_SECRET`에 한 줄로 입력한다. 실제 키와 DB 비밀번호는 저장소·문서·로그에 남기지 않는다. JWT 키는 재배포 시에도 유지하며, 변경하면 기존 서명으로 발급한 access token은 무효화된다.

현재 `application-staging.yml`은 없으며 별도 파일을 만들 필요는 없다. 공통 `application.yml`과 Render 환경변수를 사용한다. 로컬 `.env` 파일은 Render로 업로드하지 않는다. 변수 이름은 [API 환경변수 예시](../../.env.example)를 참고한다.

CORS 값은 API 주소가 아니라 **브라우저에서 API를 호출하는 프런트엔드 origin**이다. 예를 들어 로컬 Expo 웹은 `http://localhost:8081`을 사용한다. 네이티브 모바일 요청에는 CORS가 적용되지 않는다. CORS는 인증이나 staging 접근 제한을 대신하지 않는다.

## 5. 배포 및 검증

1. 배포할 커밋이 원격 `staging`에 반영되었는지 확인한다.
2. DB가 준비되었고 API의 환경변수가 저장되었는지 확인한다.
3. API 서비스의 **Manual Deploy**에서 배포를 시작한다.
4. 로그에서 Docker 빌드, Flyway 마이그레이션, Spring API 기동 성공을 확인한다.
5. 실제 서비스 주소로 health를 확인한다.

```bash
curl --fail --show-error https://<실제-API-호스트>/actuator/health
```

정상 응답은 `{"status":"UP"}`이다. `/api/health`는 고정 UP 응답이므로 DB 연결까지 확인하는 배포 판정에는 `/actuator/health`를 사용한다.

Flyway가 API 시작 시 스키마를 생성·이전하므로 별도 테이블 생성 명령은 필요하지 않다. V4는 일기에 연결된 기존 Todo에 일기 소유자를 반영한다. 소유자를 알 수 없는 미연결 Todo는 삭제하지 않고 보존하며, API에서는 접근할 수 없게 한다.

Swagger UI는 `https://<실제-API-호스트>/swagger-ui.html`에서 접근한다. UI와 `/openapi.yaml`은 로그인 없이 공개되며, 실제 Todo·일기 API의 JWT 인증은 유지한다. Swagger UI는 `contracts/openapi.yaml`을 읽고 `/v3/api-docs` 자동 생성 명세는 제공하지 않는다.

Swagger UI에서 회원가입·로그인 API의 **Try it out**으로 요청을 실행한다. 로그인 응답의 `accessToken` 값만 복사해 **Authorize → bearerAuth**에 입력한다(`Bearer ` 접두사는 입력하지 않는다). 이후 보호 API를 실행하면 UI가 Authorization 헤더를 붙인다. refresh token을 Authorize에 넣지 않는다. 갱신한 access token은 Authorize에 다시 입력한다. 기본 설정에서는 새로고침 후 토큰을 다시 입력해야 한다.

기능 검증은 Swagger UI 또는 API 클라이언트로 진행한다. 모바일 가입·로그인 화면도 인증 API와 연결되어 있다. 모바일 설정과 세션 동작은 [모바일 개발 가이드](../../../mobile/docs/development.md)와 [인증 문서](../../../mobile/docs/authentication.md)를 참고한다.

- 테스트 사용자 A와 B를 `/api/v1/auth/signup`으로 가입시킨다.
- `/api/v1/auth/login`으로 로그인하고, 보호된 API에 `Authorization: Bearer <accessToken>`을 전달한다.
- 토큰 없이 Todo·일기 API를 호출하면 `401`인지 확인한다.
- A가 생성한 Todo는 A의 날짜별 목록에만 나타나는지 확인한다.
- B가 A의 Todo를 조회·수정·삭제하거나 일기에 연결하면 `404`인지 확인한다.
- `/api/v1/auth/refresh` 호출 후 반환된 새 refresh token으로 교체한다. 동시 갱신이나 이전 토큰 재사용은 세션을 폐기할 수 있으므로 갱신 요청은 순차 처리한다.
- `/api/v1/auth/logout` 후 해당 세션의 access·refresh token이 거부되는지 확인한다.

요청 본문과 응답은 [OpenAPI 계약](../../../../contracts/openapi.yaml)을 따른다. 검증에 사용한 Render 배포 커밋과 결과를 PR에 남긴다. 이 문서의 절차는 실제 배포 성공을 의미하지 않는다.

## 6. 공개 범위와 운영 보완

Render Web Service는 기본적으로 인터넷에 공개된다. 최초 staging에서 허용할 테스트 대상과 접근 제한 방식을 정한다. 일반 공개로 진행하면 로그인·회원가입 요청 제한을 공개 전에 적용한다.

재시작 정책·백업/복원·이전 버전 복구·로그/알림·배포 자동화는 [#63](https://github.com/LYJ0304/grow-together/issues/63)의 운영 보완 범위다. Compose 재시작 정책을 Render에 복사하지 않고 플랫폼이 제공하는 기능을 먼저 확인한다. 최초 배포 필수 작업은 [#62](https://github.com/LYJ0304/grow-together/issues/62)에서 관리한다.

무료 API는 15분 동안 요청이 없으면 절전되며, 다음 요청에서 다시 시작하는 데 시간이 걸릴 수 있다. 무료 DB의 30일 만료와는 별개다.

## 공식 문서

- [Render Docker 배포](https://render.com/docs/docker)
- [모노레포 Root Directory와 Docker 경로](https://render.com/docs/monorepo-support)
- [Web Service 포트와 HTTPS](https://render.com/docs/web-services)
- [Postgres 생성 및 내부 연결](https://render.com/docs/postgresql-creating-connecting)
- [Health checks](https://render.com/docs/health-checks)
- [무료 API와 DB 제한](https://render.com/docs/free)
