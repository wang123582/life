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

exec "$@"
