#!/bin/bash
# Build and install GitWorld screensaver for macOS
set -e

echo "Building GitWorld screensaver..."

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
SAVER_NAME="GitWorld"
SAVER_DEST="$HOME/Library/Screen Savers/${SAVER_NAME}.saver"

# Clean
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/${SAVER_NAME}.saver/Contents/MacOS"
mkdir -p "$BUILD_DIR/${SAVER_NAME}.saver/Contents/Resources"

# Copy Info.plist
cp "$SCRIPT_DIR/${SAVER_NAME}.saver/Contents/Info.plist" \
   "$BUILD_DIR/${SAVER_NAME}.saver/Contents/Info.plist"

# Copy HTML resources
cp "$SCRIPT_DIR/${SAVER_NAME}.saver/Contents/Resources/screensaver.html" \
   "$BUILD_DIR/${SAVER_NAME}.saver/Contents/Resources/screensaver.html"

# Compile Swift screensaver
echo "Compiling Swift..."
swiftc \
  -target arm64-apple-macos13.0 \
  -framework ScreenSaver \
  -framework WebKit \
  -framework AppKit \
  -emit-library \
  -o "$BUILD_DIR/${SAVER_NAME}.saver/Contents/MacOS/${SAVER_NAME}" \
  -module-name GitWorld \
  "$SCRIPT_DIR/GitWorldScreenSaver/GitWorldView.swift"

# Install
echo "Installing to ~/Library/Screen Savers/..."
rm -rf "$SAVER_DEST"
cp -R "$BUILD_DIR/${SAVER_NAME}.saver" "$SAVER_DEST"

echo ""
echo "Installed! Open System Settings → Screen Saver → GitWorld"
echo ""
echo "To test immediately:"
echo "  /System/Library/CoreServices/ScreenSaverEngine.app/Contents/MacOS/ScreenSaverEngine"
echo ""
echo "To uninstall:"
echo "  rm -rf \"$SAVER_DEST\""
