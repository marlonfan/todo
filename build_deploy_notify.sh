#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${ROOT_DIR}"

APP_BIN="${ROOT_DIR}/bin/todo-app"
APP_PATTERN="${ROOT_DIR}/bin/todo-app"
LOG_DIR="${ROOT_DIR}/tmp"
LOG_FILE="${LOG_DIR}/todo-app.log"
PID_FILE="${LOG_DIR}/todo-app.pid"

NTFY_URL="https://ntfy.marlon.life/Tasks"
NTFY_TOKEN="tk_91spjtu4g6rxdwykrl1w75x9x8km3"
NTFY_TITLE_SUCCESS="todo deploy success"
NTFY_TITLE_FAIL="todo deploy failed"
NTFY_PRIORITY_SUCCESS="default"
NTFY_PRIORITY_FAIL="high"

timestamp() {
  date -u +"%Y-%m-%d %H:%M:%S UTC"
}

git_short() {
  git rev-parse --short HEAD 2>/dev/null || echo "unknown"
}

send_ntfy() {
  local title="$1"
  local priority="$2"
  local body="$3"
  curl -sS -X POST "${NTFY_URL}" \
    -H "Authorization: Bearer ${NTFY_TOKEN}" \
    -H "Title: ${title}" \
    -H "Priority: ${priority}" \
    -d "${body}" >/dev/null
}

on_error() {
  local line="${1:-unknown}"
  local last_log="(log not found)"
  if [[ -f "${LOG_FILE}" ]]; then
    last_log="$(tail -n 20 "${LOG_FILE}" | tr '\n' ' ' | sed 's/[[:space:]]\+/ /g')"
  fi
  send_ntfy "${NTFY_TITLE_FAIL}" "${NTFY_PRIORITY_FAIL}" \
    $'时间: '"$(timestamp)"$'\ncommit: '"$(git_short)"$'\n阶段: build/deploy\n错误行: '"${line}"$'\n日志尾部: '"${last_log}"
}

trap 'on_error "${LINENO}"' ERR

echo "[deploy] $(timestamp) start"
mkdir -p "${LOG_DIR}" "${ROOT_DIR}/cmd/server/web/dist" "${ROOT_DIR}/bin"

echo "[deploy] stopping old process..."
if [[ -f "${PID_FILE}" ]]; then
  OLD_PID="$(cat "${PID_FILE}" 2>/dev/null || true)"
  if [[ -n "${OLD_PID}" ]] && kill -0 "${OLD_PID}" 2>/dev/null; then
    kill "${OLD_PID}" 2>/dev/null || true
  fi
fi
pkill -f "${APP_PATTERN}" 2>/dev/null || true
pkill -f "./bin/todo-app" 2>/dev/null || true
sleep 1

echo "[deploy] building frontend..."
pushd "${ROOT_DIR}/web" >/dev/null
npm install
npm run build
popd >/dev/null

echo "[deploy] syncing embedded frontend files..."
rm -rf "${ROOT_DIR}/cmd/server/web/dist/"*
cp -r "${ROOT_DIR}/web/dist/." "${ROOT_DIR}/cmd/server/web/dist/"

echo "[deploy] building backend..."
CGO_ENABLED=1 go build -o "${APP_BIN}" cmd/server/main.go

echo "[deploy] starting service..."
if command -v setsid >/dev/null 2>&1; then
  setsid "${APP_BIN}" > "${LOG_FILE}" 2>&1 < /dev/null &
else
  nohup "${APP_BIN}" > "${LOG_FILE}" 2>&1 < /dev/null &
fi
NEW_PID=$!
disown || true
echo "${NEW_PID}" > "${PID_FILE}"
sleep 2

if ! kill -0 "${NEW_PID}" 2>/dev/null; then
  echo "[deploy] process failed to stay alive, check ${LOG_FILE}"
  exit 1
fi

SUCCESS_BODY=$'时间: '"$(timestamp)"$'\ncommit: '"$(git_short)"$'\nPID: '"${NEW_PID}"$'\n日志: '"${LOG_FILE}"$'\n状态: build+restart success'
send_ntfy "${NTFY_TITLE_SUCCESS}" "${NTFY_PRIORITY_SUCCESS}" "${SUCCESS_BODY}"

echo "[deploy] success. pid=${NEW_PID}"
echo "[deploy] log: ${LOG_FILE}"
