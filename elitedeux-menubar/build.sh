#!/bin/bash
# Compilează EliteDeux.app și îl instalează în /Applications.
set -euo pipefail
cd "$(dirname "$0")"

APP="/Applications/EliteDeux.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"

swiftc -O main.swift -o "$APP/Contents/MacOS/EliteDeux"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>EliteDeux</string>
  <key>CFBundleIdentifier</key><string>ro.ericcosulea.elitedeux.menubar</string>
  <key>CFBundleExecutable</key><string>EliteDeux</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>LSUIElement</key><true/>
</dict>
</plist>
PLIST

codesign --force --sign - "$APP" 2>/dev/null || true
echo "Gata: $APP"
