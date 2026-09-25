#!/usr/bin/env bash
# Keep Tauri's build-options server alive while Xcode invokes ios xcode-script.
set -euo pipefail
set -m # Give the background Tauri process tree its own process group.

cd "$(dirname "$0")/.."
scratch=$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/tiny-chat-ios.XXXXXX")
tauri_pid=
cleanup() {
    if [[ -n "$tauri_pid" ]]; then
        kill -TERM -- "-$tauri_pid" 2>/dev/null || true
        wait "$tauri_pid" 2>/dev/null || true
    fi
    rm -rf "$scratch"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# --open prepares the project and keeps the options server running. Suppress
# opening the GUI on CI, using a unique directory for concurrent runner jobs.
printf '#!/bin/sh\nexit 0\n' > "$scratch/open"
chmod +x "$scratch/open"
export PATH="$scratch:$PATH"
log_file="$scratch/tauri.log"
pnpm --filter @tiny-chat/tauri exec tauri ios build \
    --target aarch64 --ci --open -vv \
    --config '{"bundle":{"createUpdaterArtifacts":false,"iOS":{"minimumSystemVersion":"27.0","frameworks":["FoundationModels"]}}}' \
    > "$log_file" 2>&1 &
tauri_pid=$!

deadline=$((SECONDS + 300))
until grep -q 'Opening Xcode' "$log_file"; do
    if ! kill -0 "$tauri_pid" 2>/dev/null; then
        cat "$log_file"
        echo 'Tauri exited before the iOS project was ready' >&2
        exit 1
    fi
    if (( SECONDS >= deadline )); then
        cat "$log_file"
        echo 'Timed out waiting for Tauri to prepare the iOS project' >&2
        exit 1
    fi
    sleep 2
done
cat "$log_file"

cd apps/tauri/gen/apple
# Xcode, not the shell, expands $(inherited).
# shellcheck disable=SC2016
xcodebuild \
    -scheme tiny-chat_iOS \
    -workspace tiny-chat.xcodeproj/project.xcworkspace \
    -sdk iphoneos \
    -destination 'generic/platform=iOS' \
    -configuration release \
    -archivePath "${RUNNER_TEMP:?RUNNER_TEMP must be set}/tiny-chat_iOS.xcarchive" \
    archive \
    CODE_SIGN_IDENTITY="" \
    CODE_SIGNING_REQUIRED=NO \
    CODE_SIGNING_ALLOWED=NO \
    AD_HOC_CODE_SIGNING_ALLOWED=YES \
    ONLY_ACTIVE_ARCH=NO \
    DEVELOPMENT_TEAM="" \
    IPHONEOS_DEPLOYMENT_TARGET=27.0 \
    'OTHER_LDFLAGS=$(inherited) -framework FoundationModels'
