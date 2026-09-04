# ==============================================================================
# Build Stage
# ==============================================================================
FROM --platform=$BUILDPLATFORM golang:alpine AS builder

ARG TARGETOS
ARG TARGETARCH

WORKDIR /app

RUN apk add --no-cache git ca-certificates

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build \
    -ldflags="-s -w" \
    -o /app/atm-server ./atm/main.go

# ==============================================================================
# Final Runtime Stage
# ==============================================================================
FROM alpine:3.20 AS runner

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata curl && \
    addgroup -g 10002 -S atmgroup && \
    adduser -u 10002 -S atmuser -G atmgroup

COPY --from=builder --chown=atmuser:atmgroup /app/atm-server /app/atm-server

USER atmuser

EXPOSE 8081 8082 8083

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8081/atm/health || exit 1

ENTRYPOINT ["/app/atm-server"]
