#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_JAVA_HOME="${ROOT_DIR}/.tools/jdk-21"
FALLBACK_JAVA_HOME="${ROOT_DIR}/.tools/jdk-17"
LOCAL_ANDROID_SDK_ROOT="${ROOT_DIR}/.tools/android-sdk"

if [[ ! -d "${LOCAL_JAVA_HOME}" && -d "${FALLBACK_JAVA_HOME}" ]]; then
  LOCAL_JAVA_HOME="${FALLBACK_JAVA_HOME}"
fi

if [[ -d "${LOCAL_JAVA_HOME}" ]]; then
  export JAVA_HOME="${LOCAL_JAVA_HOME}"
  export PATH="${JAVA_HOME}/bin:${PATH}"
fi

if [[ -d "${LOCAL_ANDROID_SDK_ROOT}" ]]; then
  export ANDROID_SDK_ROOT="${LOCAL_ANDROID_SDK_ROOT}"
  export ANDROID_HOME="${LOCAL_ANDROID_SDK_ROOT}"
  export PATH="${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin:${ANDROID_SDK_ROOT}/platform-tools:${PATH}"
fi

if command -v python3 >/dev/null 2>&1 && [[ "${LIFE_ANDROID_DISABLE_PROXY:-0}" != "1" ]]; then
  PROXY_PORT="${LIFE_ANDROID_REPO_PROXY_PORT:-4873}"
  export LIFE_ANDROID_GOOGLE_REPO="http://127.0.0.1:${PROXY_PORT}/google"
  export LIFE_ANDROID_MAVEN_REPO="http://127.0.0.1:${PROXY_PORT}/maven"

  python3 "${ROOT_DIR}/scripts/android-repo-proxy.py" --port "${PROXY_PORT}" >/tmp/life-android-repo-proxy.log 2>&1 &
  PROXY_PID=$!
  trap 'kill "${PROXY_PID}" >/dev/null 2>&1 || true' EXIT
  sleep 1
fi

cd "${ROOT_DIR}/android"
./gradlew "$@"
