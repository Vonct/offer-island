#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

volume_name="Offer Island"
output="dist/Offer-Island-0.3.2.dmg"
background_source="desktop/assets/dmg-background.svg"
background_png="dist/dmg-background.png"

bash scripts/build-mac.sh
stage=$(mktemp -d /private/tmp/offer-island-dmg.XXXXXX)
rw_dir=$(mktemp -d /private/tmp/offer-island-rw.XXXXXX)
rw_dmg="$rw_dir/working.dmg"
mount_dir=""

cleanup() {
  if [[ -n "$mount_dir" ]] && hdiutil info | grep -Fq "$mount_dir"; then
    hdiutil detach "$mount_dir" -quiet || true
  fi
  rm -rf "$stage" "$rw_dir"
}
trap cleanup EXIT

sips -s format png "$background_source" --out "$background_png" >/dev/null

ditto "dist/Offer Island.app" "$stage/Offer Island.app"
ln -s /Applications "$stage/Applications"
mkdir "$stage/.background"
cp "$background_png" "$stage/.background/background.png"

hdiutil create -volname "$volume_name" -fs HFS+ -srcfolder "$stage" -ov -format UDRW "$rw_dmg" >/dev/null
if [[ -e "/Volumes/$volume_name" ]]; then
  echo "A volume named '$volume_name' is already mounted. Eject it and retry." >&2
  exit 1
fi
attach_output=$(hdiutil attach "$rw_dmg" -readwrite -noverify -noautoopen)
mount_dir=$(printf '%s\n' "$attach_output" | awk -F '\t' 'END {print $NF}')

osascript <<APPLESCRIPT
tell application "Finder"
  tell disk "$volume_name"
    open
    tell container window
      set current view to icon view
      set toolbar visible to false
      set statusbar visible to false
      set bounds to {120, 120, 780, 520}
    end tell
    set opts to icon view options of container window
    set arrangement of opts to not arranged
    set icon size of opts to 112
    set text size of opts to 13
    set background picture of opts to POSIX file "$mount_dir/.background/background.png"
    set position of item "Offer Island.app" of container window to {165, 205}
    set position of item "Applications" of container window to {495, 205}
    close
    open
    update without registering applications
    delay 3
    close
  end tell
end tell
APPLESCRIPT

for _ in {1..40}; do
  [[ -f "$mount_dir/.DS_Store" ]] && break
  sleep 0.25
done
if [[ ! -f "$mount_dir/.DS_Store" ]]; then
  echo "Finder did not save the DMG layout (.DS_Store)." >&2
  exit 1
fi

sync
hdiutil detach "$mount_dir" -quiet
hdiutil convert "$rw_dmg" -ov -format UDZO -imagekey zlib-level=9 -o "$output" >/dev/null
hdiutil verify "$output"
echo "Packaged $output"
