# GrowTogether

일정과 일기를 관리하는 모바일 앱과 독립적인 API·AI worker로 구성된 모노레포입니다.

| 앱 | 기술 | 로컬 포트 | 역할 |
| --- | --- | --- | --- |
| `apps/mobile` | Expo 55 · React Native · TypeScript | `8081` (Expo 기본값) | 모바일·웹 클라이언트 |
| `apps/api` | Spring Boot 4 · Java 21 | `8080` | 인증, 도메인 API, 데이터 저장 |
| `apps/ai-worker` | Python 3.12 · uv | `8000` (내부 HTTP) | 독립적인 AI 작업 실행과 내부 AG-UI 스트리밍 |

## Getting started

저장소 루트에서 환경 파일을 준비합니다.

```bash
cp infra/.env.example infra/.env
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
cp apps/ai-worker/.env.example apps/ai-worker/.env
openssl rand -base64 32
```

생성한 값을 `apps/api/.env`의 `JWT_SECRET`에 입력한 뒤 PostgreSQL과 API를 실행합니다.

```bash
docker compose --env-file infra/.env -f infra/compose.yaml up --build
```

다른 터미널에서 Expo를 실행합니다.

```bash
cd apps/mobile
npm ci
npm start
```

API는 `http://localhost:8080`, Swagger UI는 `http://localhost:8080/swagger-ui.html`에서 확인합니다. 실제 기기에서는 `EXPO_PUBLIC_API_URL`의 `localhost`를 개발 PC의 LAN 주소로 바꿉니다. 인증 API를 검증할 때는 `EXPO_PUBLIC_ENABLE_AUTH_BYPASS=false`로 설정합니다.

## Prerequisites

| 도구 | 용도 |
| --- | --- |
| Node.js · npm | Expo 실행 및 모바일 의존성 설치 |
| Docker · Docker Compose | PostgreSQL과 API 실행 |
| OpenSSL | JWT 서명 키 생성 |
| Java 21 | Docker 밖에서 API를 실행하거나 테스트할 때 필요 |
| Python 3.12 · uv | Docker 밖에서 AI worker를 실행하거나 검사할 때 필요 |

## Service dependencies

```text
Mobile / Web → API → PostgreSQL
API → AI worker → 모델 제공자 (상담 기능, 선택 사항)
```

기본 Compose는 PostgreSQL과 API를 실행합니다. DB 마이그레이션은 API 시작 시 Flyway가 처리합니다. AI worker는 별도 `worker` 프로필로 실행하며 상담 기능 사용 시 API가 내부 AG-UI 스트리밍을 호출합니다. 자세한 실행 방법은 [로컬 개발 가이드](infra/docs/local-development.md)를 참고합니다.

## Environment variables

환경 파일은 모듈별로 관리하며 실제 값은 커밋하지 않습니다. 전체 항목과 기본값은 각 `.env.example`을 기준으로 합니다.

| 환경 파일 | 주요 변수 | 용도 |
| --- | --- | --- |
| [infra/.env.example](infra/.env.example) | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Compose의 PostgreSQL 설정 |
| [apps/mobile/.env.example](apps/mobile/.env.example) | `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_ENABLE_AUTH_BYPASS` | API 주소와 UI 미리보기 설정; 공개 값만 사용 |
| [apps/api/.env.example](apps/api/.env.example) | `DATABASE_URL`, `JWT_SECRET`, `CORS_ALLOWED_ORIGINS` | DB 연결, JWT 서명, 브라우저 접근 설정 |
| [apps/ai-worker/.env.example](apps/ai-worker/.env.example) | `SERVICE_NAME`, `LOG_LEVEL`, `WORKER_TOKEN`, `MODEL_BASE_URL`, `MODEL_API_KEY`, `MODEL_NAME` | 로그·내부 인증·모델 연결 설정 |

Compose는 `infra/.env`의 DB 설정을 API에 전달합니다. API를 호스트에서 직접 실행할 때는 환경변수를 별도로 로드해야 합니다. 절차는 [API 개발 가이드](apps/api/docs/development.md)에 있습니다.

## Common commands

| 실행 위치 | 명령어 | 용도 |
| --- | --- | --- |
| 저장소 루트 | `docker compose --env-file infra/.env -f infra/compose.yaml up --build` | DB·API 실행 |
| 저장소 루트 | `docker compose --env-file infra/.env -f infra/compose.yaml --profile worker run --rm ai-worker uv run --no-sync python -m app.main` | AI 예제 작업 실행 |
| `apps/mobile` | `npm start` / `npm run web` | Expo / 웹 클라이언트 실행 |
| `apps/mobile` | `npm run typecheck` / `npm run lint` | 타입·린트 검사 |
| `apps/mobile` | `npm run test:auth` | 인증 세션 테스트 |
| `apps/api` | `./gradlew test` | API 테스트; PostgreSQL 통합 테스트에 Docker 필요 |
| `apps/ai-worker` | `uv sync --locked` | 의존성 설치 |
| `apps/ai-worker` | `uv run ruff check .` / `uv run pytest` | 린트·테스트 |

## Repository layout

```text
apps/
  mobile/       # Expo 앱과 모바일 개발 문서
  api/          # Spring Boot API와 배포 문서
  ai-worker/    # 독립적인 AI 작업 실행기
contracts/      # OpenAPI 계약
infra/          # 로컬 Compose, PostgreSQL, 실행 가이드
.harness/       # 개발 규칙, 스킬, 워크플로
.agents/skills/ # Codex용 저장소 스킬 링크
```

## Deployment and operations

Render staging 설정과 배포 검증은 [API staging 배포 가이드](apps/api/docs/staging/Development.md)를 따릅니다. 이 문서는 개발 검증용 staging 범위를 다룹니다.

## Learn more

- [모바일 개발](apps/mobile/docs/development.md) · [인증과 세션](apps/mobile/docs/authentication.md)
- [API 개발](apps/api/docs/development.md) · [OpenAPI 계약](contracts/openapi.yaml)
- [AI worker 개발](apps/ai-worker/docs/development.md)
- [기여 규칙](AGENTS.md) · [개발 워크플로](.harness/conventions.md)
