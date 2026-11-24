# 맥북 staging 운영 가이드

GrowTogether staging은 맥북의 Docker Compose에서 API, Worker, PostgreSQL,
MinIO를 실행합니다. Expo/Metro는 맥북에서 별도로 실행하고, 휴대폰은 같은
Tailscale tailnet에서 앱 번들과 HTTPS API 및 파일 주소에 접근합니다.

## 1. 배포 후보와 준비물

- Docker Desktop, 저장소 README가 요구하는 Node.js/npm, 맥북과 휴대폰의 Tailscale.
- tailnet에서 MagicDNS와 HTTPS 인증서를 활성화합니다. 맥북의 전체
  `*.ts.net` 이름과 접근할 계정·기기의 포트 권한을 확인합니다.
- 휴대폰에서 프로젝트 SDK를 지원하는 Expo Go 또는 development build를
  준비합니다. iOS에서 설치된 Expo Go가 프로젝트 SDK를 지원하지 않으면,
  Xcode에서 기기 등록·서명을 준비하고 `apps/mobile`에서
  `npx expo run:ios --device`로 development build를 설치합니다. Android
  development build는 Android SDK와 기기 연결 후
  `npx expo run:android --device`로 설치합니다.
- 확인할 `main` 커밋을 별도 디렉터리에 체크아웃하고 SHA를 기록합니다.
  아래 Compose 명령은 해당 체크아웃의 저장소 루트에서 실행합니다.

```bash
git fetch origin main
staging_sha="$(git rev-parse origin/main)"
git worktree add --detach ../growtogether-staging "$staging_sha"
cd ../growtogether-staging
git rev-parse HEAD
```

## 2. staging 설정 및 기동

```bash
umask 077
cp infra/staging/.env.example infra/staging/.env
```

템플릿의 `STAGING_BUILD_TAG`를 체크아웃한 SHA로 설정합니다. DB 비밀번호, `openssl rand -base64 32`로 생성한 JWT secret,
API·Worker 공유 키, OpenRouter 키와 모델 ID, MinIO root 및 API 계정을
채웁니다. root와 API 계정은 서로 다른 이름과 비밀번호를 사용합니다.
파일은 Git에서 제외되며 OpenRouter 키는 Worker에만 주입됩니다.
환경변수 이름에 `AWS_`가 붙은 액세스 키는 AWS SDK가 읽는 MinIO 계정입니다.

기본 포트는 아래와 같습니다. 주소 예시의 호스트를 실제 MagicDNS 이름으로
바꾸고, `STAGING_STORAGE_URL`에는 MinIO의 **외부 HTTPS 주소**를 입력합니다.
API는 내부적으로 `http://minio:9000`에 접속하며 서명 URL에는 외부 주소를
사용합니다. 스토리지 주소는 경로 접두어 없이 호스트와 포트로 구성합니다.

| 서비스 | 맥북 루프백 | 휴대폰에서 사용할 주소 |
| --- | --- | --- |
| API | `127.0.0.1:18080` | `https://<macbook>.ts.net` |
| MinIO S3 | `127.0.0.1:19000` | `https://<macbook>.ts.net:9443` |
| Expo/Metro | `127.0.0.1:18081` | `https://<macbook>.ts.net:8443` |

```bash
stage() { docker compose --env-file infra/staging/.env -f infra/compose.staging.yaml "$@"; }
stage config -q
stage build
stage up -d --no-build --wait
stage ps -a
stage images
curl -fsS http://127.0.0.1:18080/actuator/health
```

PostgreSQL의 준비 상태, Worker의 HTTP 준비 상태, MinIO 버킷과 정책 초기화
성공 후 API가 시작됩니다. `minio-init`의 정상 상태는 종료 코드 0입니다.
MinIO는 [고정된 Community 소스](../../../../infra/minio/Dockerfile)에서
빌드합니다. QA 기록에는 Git SHA와 `stage images`에 나온 이미지의 전체
ID(`docker image inspect <image> --format '{{.Id}}'`) 또는 레지스트리 digest를
남깁니다. 동일 후보를 재시작할 때는 빌드 없이 실행합니다.

## 3. Tailnet 진입점과 Expo 실행

기존 Serve 구성을 `tailscale serve status`로 확인한 뒤 사용 가능한 포트에
연결합니다. macOS 앱 설치 방식에 따라 CLI 위치가 다르면 공식 문서의
[macOS CLI 경로](https://tailscale.com/docs/reference/tailscale-cli#using-the-cli-on-macos)를 사용합니다.

```bash
tailscale serve --bg --https=443 http://127.0.0.1:18080
tailscale serve --bg --https=9443 http://127.0.0.1:19000
tailscale serve --bg --https=8443 http://127.0.0.1:18081
tailscale serve status
```

Compose는 API와 MinIO S3 포트만 루프백에 바인딩합니다. Worker와
PostgreSQL은 내부 네트워크에서 통신하며 MinIO 관리 콘솔은 비활성화됩니다.
파일 PUT·GET 요청은 Tailscale Serve를 기본 경로 `/`에서 통과합니다.
서명 URL의 호스트·포트·경로·쿼리와 업로드 Content-Type을 유지합니다.

```bash
cd apps/mobile
npm ci
export EXPO_PUBLIC_APP_ENV=staging
export EXPO_PUBLIC_API_URL=https://macbook.example.ts.net
export EXPO_PUBLIC_ENABLE_AUTH_BYPASS=false
export EXPO_PACKAGER_PROXY_URL=https://macbook.example.ts.net:8443
npm start -- --localhost --port 18081 --dev-client
```

위 주소에서 `macbook.example.ts.net`을 실제 전체 이름으로 치환합니다. SDK와
호환되는 Expo Go를 사용하는 경우 `--dev-client`를 `--go`로 바꿉니다.
휴대폰에서 Metro가 안내하는 링크 또는 QR을 엽니다. 개발 빌드에서
`npx expo run:ios --device` 등으로 최초 설치한 뒤에는 위 명령으로 번들을
실행합니다. [Expo CLI](https://docs.expo.dev/more/expo-cli/) · [Tailscale Serve](https://tailscale.com/docs/reference/tailscale-cli/serve)

## 4. QA 및 재시작

1. 휴대폰의 Wi-Fi를 끄고 셀룰러에서 Tailscale을 켭니다. API
   `/actuator/health`와 Metro 번들 로딩을 확인합니다.
2. 새 QA 계정으로 로그인합니다. 사진 일기를 작성한 뒤 앱을 다시 열어
   사진을 확인합니다. 업로드 실패 시 URL 발급, PUT, 완료, GET 단계의 상태
   코드를 확인합니다. 로그나 이슈에 서명 URL 전체를 남기지 않습니다.
3. AI 채팅으로 실제 답변을 받은 뒤 API·Worker 연결 및 모델 설정을 확인합니다.
4. 맥북을 재시작하고 로그인합니다. Docker Desktop 및 Tailscale이 실행
   중인지 확인하고, 필요하면 `stage up -d --no-build --wait`로 복구합니다.
   Metro를 다시 실행하고 같은 계정의 사진을 조회합니다.

운영 시간에는 전원과 네트워크를 연결하고 macOS에서 맥북이 절전 상태로
들어가는지 확인합니다. Docker Desktop의 로그인 시 시작 설정을 사용할 수
있습니다. `stage stop`은 컨테이너를 중지하고 볼륨을 보존합니다. Metro는
실행 터미널에서 종료하고, Serve 주소를 내릴 때는 해당 포트별로
`tailscale serve --https=<port> off`를 실행합니다.

## 5. PostgreSQL 및 파일 백업과 복원

백업은 DB와 파일을 같은 시점에 보관합니다. 테스트를 종료하고 진행 중인
업로드를 끝낸 뒤 MinIO Serve 포트를 내립니다. API와 MinIO를 중지하면
PostgreSQL 덤프와 MinIO 볼륨을 안전하게 복사할 수 있습니다. MinIO
아카이브에는 객체 메타데이터와 버킷 설정이 포함됩니다. 운영자만 읽을 수
있도록 보관하고 맥북 장애 시에도 접근할 수 있는 위치에 복사합니다.

```bash
stage stop api minio
umask 077
backup_dir="$(mktemp -d "${HOME}/growtogether-staging-backup.XXXXXXXX")"
stage exec -T postgres pg_dump -Fc -U growtogether_staging growtogether_staging > "$backup_dir/db.dump"
stage run --rm --no-deps -v "$backup_dir:/backup" --entrypoint tar minio -C /data -cf /backup/minio.tar .
stage up -d --no-build --wait
```

백업 후 MinIO Serve 포트를 다시 연결합니다. 복원은 원본과 동일한
MinIO 이미지 및 자격 증명을 사용해 별도 프로젝트의 빈 볼륨에서 검증합니다.
아래 명령은 원본 staging과 충돌하지 않는 포트를 사용합니다.

```bash
restore_stage() {
  STAGING_MINIO_PORT=29000 STAGING_API_PORT=28080 STAGING_STORAGE_URL=http://127.0.0.1:29000 docker compose \
    --env-file infra/staging/.env -f infra/compose.staging.yaml \
    -p growtogether-staging-restore "$@"
}
restore_stage up -d --wait postgres
restore_stage exec -T postgres pg_restore --exit-on-error --no-owner \
  -U growtogether_staging -d growtogether_staging < "$backup_dir/db.dump"
restore_stage run --rm --no-deps -v "$backup_dir:/backup:ro" --entrypoint /bin/sh minio -ec '
  test -z "$(ls -A /data)"
  tar -C /data -xf /backup/minio.tar
'
restore_stage up -d --no-build --wait
```

복원된 API의 `http://127.0.0.1:28080/actuator/health`를 확인하고, 맥북에서
동일 QA 계정으로 일기와 사진을 조회해 DB의 객체 키와 파일이 함께
복원됐는지 확인합니다. `restore_stage stop`으로 복원 검증 프로젝트를
중지합니다.
