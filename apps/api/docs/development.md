# API development

For the default Docker setup, follow the
[local development guide](../../../infra/docs/local-development.md).
The API is available at `http://localhost:8080`.

## Run outside Docker

Use Java 21 and the module's [environment template](../.env.example).
`apps/api/.env` configures the profile, JWT, CORS, and database connection.
Compose overrides its database connection with values from `infra/.env`.

The existing Compose PostgreSQL service does not publish a host port. To use it
with a host JVM, stop the regular Compose stack first so only one PostgreSQL
process uses the data volume. From the repository root, run:

```bash
docker compose --env-file infra/.env -f infra/compose.yaml down
docker compose --env-file infra/.env -f infra/compose.yaml run --rm -p 5432:5432 postgres
```

Keep this terminal open. `down` without `--volumes` preserves the database volume.
Use an available host port and match `DATABASE_URL` if 5432 is already in use.
Alternatively, use an existing local PostgreSQL instance.

Match the API database credentials to `infra/.env` (or your existing PostgreSQL
instance). Spring Boot does not load `.env` automatically. In another terminal,
from the repository root, export the API settings before starting it:

```bash
cd apps/api
set -a
source .env
set +a
./gradlew bootRun
```

## Checks

From `apps/api`:

```bash
./gradlew test
```

Tests use PostgreSQL Testcontainers and require Docker. Check that integration
tests were executed rather than skipped.

## Health and API exploration

`/api/health` returns a fixed UP response. Use `/actuator/health` to check database
connectivity as well.

Swagger UI is available at `/swagger-ui.html` and serves the existing
[OpenAPI contract](../../../contracts/openapi.yaml) via `/openapi.yaml`.
The UI and contract are public; protected API operations still require JWT
authentication. The generated `/v3/api-docs` endpoint is disabled.

Sign up and log in using **Try it out**, then enter the login `accessToken` in
**Authorize → bearerAuth**, without a `Bearer ` prefix. Do not use a refresh token
here. After token refresh, enter the new access token again; reloading the UI
requires authorization again under the default settings.

For Render deployment and staging verification, see the
[staging deployment guide](staging/Development.md).

## Private file storage (S3 / R2)

`com.growtogether.storage` owns file metadata, authorization and lifecycle. The bucket
stores private objects; diary/chat attachment relationships remain separate domain work.
Existing diary `imageUrl` records are unchanged. No mobile upload UI is added here.

Enable `STORAGE_ENABLED=true`, set `STORAGE_BUCKET` and `STORAGE_REGION`, and provide
credentials via the AWS SDK default chain (workload IAM role preferred in AWS, or
`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`, optional `AWS_SESSION_TOKEN`).
For R2 use `STORAGE_REGION=auto` and
`STORAGE_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com`. Standard AWS S3
needs no endpoint override. `STORAGE_PATH_STYLE` defaults to false. Disabled storage
keeps other API features available; upload/download/storage operations return 503.

Keep the bucket private and restrict credentials to `s3:PutObject`, `s3:GetObject`
(also authorizes HEAD), and `s3:DeleteObject` on `<bucket>/files/*`. To distinguish missing AWS objects as 404, also grant
`s3:ListBucket` on the bucket; without it, AWS returns 403 for missing objects and
this API reports a sanitized 503 while keeping the file PENDING for retry (see
[AWS HeadObject permissions](https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadObject.html)).
R2 tokens should
be scoped to the selected bucket with equivalent object read/write access. Configure
bucket CORS for actual browser origins, PUT/GET/HEAD methods and the required
`Content-Type`, `Content-Length`, `If-None-Match` headers. API CORS does not configure
bucket CORS. Keep signed URLs out of logs: anyone holding one can use it until expiry.
Follow [AWS presigning](https://docs.aws.amazon.com/sdk-for-java/latest/developer-guide/examples-s3-presign.html)
and [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).

1. Authenticated `POST /api/v1/files/presigned-url` with
   `{"originalName":"photo.jpg","contentType":"image/jpeg","size":12345}`.
   Initial policy: JPEG (`jpg`/`jpeg`), PNG, WebP; 1 byte–5MiB. No client object key
   or owner ID is accepted. The response has `id`, `uploadUrl`, `expiresAt`, `headers`.
2. PUT the raw file body to `uploadUrl` with **all** returned headers. The HTTP client
   normally derives Content-Length from the exact body length; do not use multipart
   or transfer encoding. Do not attach the API Authorization header. Content-Type,
   Content-Length and `If-None-Match: *` are signed, preventing replacement while the
   object exists. The URL is reusable until expiry, rather than a one-time token.
3. Authenticated `POST /api/v1/files/{id}/complete` verifies HEAD size/Content-Type
   and transitions PENDING → READY. Repeating completion on READY returns 200.
   Missing object returns 409 and allows retry; mismatch becomes FAILED. HEAD does
   not validate image bytes or malware; content inspection belongs in the later
   diary attachment acceptance flow before these files are used as trusted images.
4. `GET /api/v1/files/{id}` returns metadata, and
   `GET /api/v1/files/{id}/download-url` signs GET only for READY. Both enforce the
   owner from JWT. Absent and another user's files both return 404.
5. `DELETE /api/v1/files/{id}` marks DELETING and deletes the object. Provider errors
   return sanitized 503 and preserve DELETING for retry. Previously issued download
   URLs cannot be revoked individually and may work until object deletion/expiry.

URL lifetime is `STORAGE_URL_TTL_SECONDS` (default 300, allowed 1–900). PENDING expires
24 hours after creation. Hourly cleanup (`STORAGE_CLEANUP_INTERVAL_MS`, default
3600000) removes expired PENDING and FAILED/DELETING after their upload URL expires.
Each run handles at most 100 rows, independently retries failures on later runs,
and never deletes READY files. Disable with `STORAGE_CLEANUP_ENABLED=false`.
Deleted metadata is kept until the PUT URL expires so cleanup can delete an object
recreated after the first deletion. Operations lock the metadata row to serialize
completion, deletion and cleanup. Monitor cleanup warnings for persistent failures.

Operational limits: an upload started before URL expiry can finish after expiry;
a process/DB failure after issuing a URL can also leave an object without metadata.
This MVP does not inventory unknown bucket objects or guarantee atomic DB/S3 writes.
Production needs a bucket reconciliation policy for these residual orphans; do not
apply an indiscriminate expiration rule to `files/*`, which also holds READY files.
Deleting a READY file is currently owner-controlled: add domain reference checks
when diary/chat begin referencing file IDs. Real AWS/R2 credentials and external
bucket configuration are required for an end-to-end provider smoke test.
