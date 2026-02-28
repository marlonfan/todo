# syntax=docker/dockerfile:1.7

FROM node:20-bookworm AS web-builder
WORKDIR /src/web

COPY web/package*.json ./
RUN npm ci

COPY web/ ./
RUN npm run build

ARG GO_VERSION=1.25.5
FROM golang:${GO_VERSION}-bookworm AS go-builder

WORKDIR /src

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    gcc \
  && rm -rf /var/lib/apt/lists/*

COPY go.mod go.sum ./
RUN go mod download

COPY . .
COPY --from=web-builder /src/web/dist ./cmd/server/web/dist

RUN CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -o /out/todo-app ./cmd/server/main.go


FROM debian:bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    tzdata \
  && rm -rf /var/lib/apt/lists/*

COPY --from=go-builder /out/todo-app /app/todo-app
COPY config.yaml.example /app/config.yaml

EXPOSE 8080
VOLUME ["/app/data"]

ENTRYPOINT ["/app/todo-app"]
CMD ["-config", "/app/config.yaml"]
