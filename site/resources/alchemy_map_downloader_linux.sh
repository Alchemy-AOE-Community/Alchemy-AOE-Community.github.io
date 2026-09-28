#!/usr/bin/env bash
#
# Current Alchemy League Map Downloader — Linux / Proton edition (ZIP-scanning version)
#
# Downloads the latest season's custom random map scripts for
# Age of Empires II: Definitive Edition into the game's
# random-map-scripts folder.
#
# Dependencies: bash + curl (or wget) + unzip.

set -u

# --- Configuration -----------------------------------------------------------

APP_ID="813780"
GAME_SUBPATH="resources/_common/random-map-scripts"

# Updated folder name
MAPS_FOLDER="Current_Alchemy_League_Maps_DO_NOT_DISTRIBUTE"

# Base URL where season ZIPs live
BASE_URL="https://raw.githubusercontent.com/Alchemy-AOE-Community/Alchemy-AOE-Community.github.io/main/site/resources"

ABOUT_URL="https://raw.githubusercontent.com/f-istvan/aoe2-Custom-Map-Downloader/main/about.txt"

# --- Helpers -----------------------------------------------------------------

die() { echo "ERROR: $*" >&2; exit 1; }

fetch() {
    local url="$1" out="$2"
    if command -v curl >/dev/null 2>&1; then
        curl -fL --retry 2 -o "$out" "$url"
    elif command -v wget >/dev/null 2>&1; then
        wget -q -O "$out" "$url"
    else
        die "Neither curl nor wget is installed."
    fi
}

steam_roots() {
    cat <<EOF
$HOME/.local/share/Steam
$HOME/.steam/steam
$HOME/.steam/root
$HOME/.var/app/com.valvesoftware.Steam/.local/share/Steam
$HOME/snap/steam/common/.local/share/Steam
EOF
}

library_paths_from_vdf() {
    local steam_root="$1"
    local vdf="$steam_root/steamapps/libraryfolders.vdf"
    [ -f "$vdf" ] || return 0
    grep -oE '"path"[[:space:]]+"[^"]+"' "$vdf" 2>/dev/null \
        | sed -E 's/.*"path"[[:space:]]+"([^"]+)".*/\1/'
}

find_game_root() {
    local -a libraries=()
    local root path
    while IFS= read -r root; do
        [ -d "$root/steamapps" ] && libraries+=("$root/steamapps")
        while IFS= read -r path; do
            [ -n "$path" ] && [ -d "$path/steamapps" ] && libraries+=("$path/steamapps")
        done < <(library_paths_from_vdf "$root")
    done < <(steam_roots)

    local lib manifest installdir candidate
    for lib in "${libraries[@]}"; do
        manifest="$lib/appmanifest_${APP_ID}.acf"
        if [ -f "$manifest" ]; then
            installdir=$(grep -oE '"installdir"[[:space:]]+"[^"]+"' "$manifest" \
                | sed -E 's/.*"installdir"[[:space:]]+"([^"]+)".*/\1/')
            [ -n "$installdir" ] || installdir="AoE2DE"
            candidate="$lib/common/$installdir"
            if [ -d "$candidate/$GAME_SUBPATH" ]; then
                echo "$candidate"
                return 0
            fi
        fi
        candidate="$lib/common/AoE2DE"
        if [ -d "$candidate/$GAME_SUBPATH" ]; then
            echo "$candidate"
            return 0
        fi
    done

    return 1
}

# --- Main --------------------------------------------------------------------

echo "Locating Age of Empires II: Definitive Edition..."

if [ -n "${AOE2_PATH:-}" ]; then
    GAME_ROOT="$AOE2_PATH"
    echo "Using AOE2_PATH override: $GAME_ROOT"
else
    GAME_ROOT="$(find_game_root)" \
        || die "Could not auto-discover AoE2:DE. Set AOE2_PATH manually."
fi

SCRIPTS_DIR="$GAME_ROOT/$GAME_SUBPATH"
[ -d "$SCRIPTS_DIR" ] || die "random-map-scripts folder not found at: $SCRIPTS_DIR"

DEST_PATH="$SCRIPTS_DIR/$MAPS_FOLDER"
echo "Game found at:    $GAME_ROOT"
echo "Installing to:    $DEST_PATH"
echo

rm -rf "$DEST_PATH"
mkdir -p "$DEST_PATH" || die "Cannot create $DEST_PATH"

command -v unzip >/dev/null 2>&1 || die "unzip is not installed. Please install it."

# --- Find latest season ZIP (ALS9 upward) ------------------------------------

echo "Scanning for latest season ZIP..."

latest=0
season=9   # Start at ALS9

while true; do
    test_url="$BASE_URL/ALS${season}/Map_Archive.zip"
    echo "Checking $test_url ..."
    if curl -sfL "$test_url" -o /dev/null 2>&1; then
        latest=$season
        season=$((season + 1))
    else
        break
    fi
done

[ "$latest" -gt 0 ] || die "No season ZIPs found."

ZIP_URL="$BASE_URL/ALS${latest}/Map_Archive.zip"
echo "Latest season detected: ALS${latest}"
echo "ZIP URL: $ZIP_URL"
echo

# --- Download + extract ZIP --------------------------------------------------

TMP_ZIP="$(mktemp)"
trap 'rm -f "$TMP_ZIP"' EXIT

echo "Downloading map archive..."
fetch "$ZIP_URL" "$TMP_ZIP" || die "Failed to download ZIP."

echo "Extracting maps..."
unzip -jq "$TMP_ZIP" -d "$DEST_PATH" || die "Failed to extract ZIP."

# --- about.txt ---------------------------------------------------------------

echo "Downloading about.txt..."
fetch "$ABOUT_URL" "$DEST_PATH/about.txt" \
    && echo "about.txt installed." \
    || echo "about.txt download failed (non-fatal)."

echo
echo "Done. Maps installed from ALS${latest}."
echo "Maps are in: $DEST_PATH"

if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$DEST_PATH" >/dev/null 2>&1 &
fi

