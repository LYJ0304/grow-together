#!/bin/sh
set -eu

export MC_CONFIG_DIR="$(mktemp -d)"
trap 'rm -r "$MC_CONFIG_DIR"' EXIT

if [ "$MINIO_ROOT_USER" = "$MINIO_API_USER" ]; then
    echo "The MinIO root and API accounts must differ." >&2
    exit 1
fi

mc alias set staging http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
mc mb --ignore-existing staging/growtogether-staging
mc anonymous set none staging/growtogether-staging
mc admin policy create staging growtogether-files /bootstrap/files-policy.json
mc admin user add staging "$MINIO_API_USER" "$MINIO_API_PASSWORD"
mc admin policy attach staging growtogether-files --user "$MINIO_API_USER"
