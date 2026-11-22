#!/bin/sh
set -eu
cd "$(dirname "$0")"
sdk=${ANDROID_HOME:?"Set ANDROID_HOME to the Android SDK directory"}
platform="$sdk/platforms/android-35"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
javac --release 8 -encoding UTF-8 -d "$work" \
  -cp "$platform/android.jar:$platform/uiautomator.jar:$platform/optional/android.test.base.jar" \
  FocusedTextInput.java
java -cp "$sdk/build-tools/35.0.0/lib/d8.jar" com.android.tools.r8.D8 --release --min-api 26 --lib "$platform/android.jar" \
  --classpath "$platform/uiautomator.jar" --classpath "$platform/optional/android.test.base.jar" \
  --output "$work/input.jar" "$work"/io/rebroid/input/*.class
mkdir -p ../dist/android-input
cp "$work/input.jar" ../dist/android-input/focused-text-input.jar
