FROM golang:1.24.9-bookworm AS build
ENV CGO_ENABLED=0
RUN go install github.com/minio/minio@7aac2a2c5b7c882e68c1ce017d8256be2feea27f
RUN go install github.com/minio/mc@77f82e18b5401a65958f1619df6ebb994634bd88

FROM alpine:3.22
RUN apk add --no-cache ca-certificates
COPY --from=build /go/bin/minio /go/bin/mc /usr/local/bin/
