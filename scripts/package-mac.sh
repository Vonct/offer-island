#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
bash scripts/build-mac.sh
stage=$(mktemp -d /tmp/offer-island-dmg.XXXXXX)
ditto "dist/Offer Island.app" "$stage/Offer Island.app"
ln -s /Applications "$stage/Applications"
hdiutil create -volname "Offer Island" -srcfolder "$stage" -ov -format UDZO "dist/Offer-Island-0.3.0.dmg"
hdiutil verify "dist/Offer-Island-0.3.0.dmg"
