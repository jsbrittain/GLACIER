#!/usr/bin/env bash

set -eoux pipefail
RUNNER_OS=${RUNNER_OS:-$(uname -s)}

if [[ "$RUNNER_OS" == "Windows" ]]; then
    echo "Running on Windows"
elif [[ "$RUNNER_OS" == "Linux" ]]; then
    echo "Linux detected. Setting up Xvfb for Electron..."
    sudo apt-get update
    sudo apt-get install -y xvfb
    Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &
    echo "DISPLAY=:99"  >> "$GITHUB_ENV"
    echo "Xvfb started on DISPLAY=:99"
elif [[ "$RUNNER_OS" == "macOS" || "$RUNNER_OS" == "Darwin" ]]; then
    echo "Running on macOS"
else
    echo "Unknown OS: $RUNNER_OS"
    exit 1
fi
