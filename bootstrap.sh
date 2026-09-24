#!/usr/bin/env sh
# Exodus Multi Wallet one-line installer for macOS / Linux.
#
#   curl -fsSL https://raw.githubusercontent.com/Ali-mubaje/Exodus-Multi-Wallet/main/bootstrap.sh | sh
#
# Downloads the tool and installs the sidebar into Exodus. If it is already installed,
# this uninstalls it again (toggle). Quit Exodus first. Only run this if you trust the source.
set -eu

REPO="Ali-mubaje/Exodus-Multi-Wallet"
BRANCH="main"

command -v node >/dev/null 2>&1 || { echo "Node.js is required. Get it at https://nodejs.org/ and run this again."; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Downloading $REPO ($BRANCH) ..."
if command -v git >/dev/null 2>&1; then
  git clone --depth 1 -b "$BRANCH" "https://github.com/$REPO.git" "$TMP/src" >/dev/null 2>&1
  DIR="$TMP/src"
elif command -v curl >/dev/null 2>&1; then
  curl -fsSL "https://github.com/$REPO/archive/refs/heads/$BRANCH.tar.gz" | tar xz -C "$TMP"
  DIR="$TMP/$(basename "$REPO")-$BRANCH"
else
  echo "Need either git or curl to download the tool."; exit 1
fi

cd "$DIR"

# Toggle: uninstall if already installed, otherwise install.
if node install.js status 2>/dev/null | grep -q "sidebar installed"; then
  echo "Sidebar already installed -> removing it ..."
  node install.js uninstall
else
  echo "Installing the sidebar ..."
  node install.js install
fi
