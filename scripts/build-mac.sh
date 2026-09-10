#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
swiftc desktop/OCR.swift -o dist/offer-ocr -framework Vision -framework AppKit
app="dist/Offer Island.app"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources/app"
swiftc desktop/OfferIsland.swift -o "$app/Contents/MacOS/OfferIsland" -framework AppKit -framework WebKit
cp "$(command -v node)" "$app/Contents/Resources/node"
cp dist/offer-ocr "$app/Contents/Resources/offer-ocr"
cp desktop/assets/OfferIslandIcon.icns "$app/Contents/Resources/OfferIslandIcon.icns"
cp LICENSE "$app/Contents/Resources/LICENSE"
cp THIRD_PARTY_NOTICES.md "$app/Contents/Resources/THIRD_PARTY_NOTICES.md"
cp -R web server "$app/Contents/Resources/app/"
cat > "$app/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleExecutable</key><string>OfferIsland</string><key>CFBundleIdentifier</key><string>io.offer-island.desktop</string><key>CFBundleName</key><string>Offer Island</string><key>CFBundleIconFile</key><string>OfferIslandIcon</string><key>CFBundleVersion</key><string>0.3.2</string><key>CFBundleShortVersionString</key><string>0.3.2</string><key>NSHighResolutionCapable</key><true/><key>NSPrefersDisplaySafeAreaCompatibilityMode</key><false/><key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict></dict></plist>
PLIST
codesign --force --deep --sign - "$app"
echo "Built $app"
