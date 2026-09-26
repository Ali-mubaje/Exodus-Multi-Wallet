#!/usr/bin/env sh
# Exodus Multi Wallet one-line installer for macOS / Linux.
#
#   curl -fsSL https://raw.githubusercontent.com/Ali-mubaje/Exodus-Multi-Wallet/main/bootstrap.sh | sh
#   curl -fsSL .../bootstrap.sh | sh -s -- update
#
# Actions: toggle (default: install, or uninstall if the sidebar is installed), install, update,
# uninstall, status. Quit Exodus first. Only run this if you trust the source.
#
# If the local updater exists (set up by the first install), it is used - it checks every release
# against the release key it already has. Otherwise update.js is downloaded from the latest GitHub
# release (trust on first use); it verifies the signed release manifest and every file before
# anything is installed. This script itself never downloads the add-on.
#
# Everything runs inside emw_main, which is only called on the very last line: if the download of
# this script is cut off, that line is missing and nothing runs.
set -eu

emw_main () {
  repo="Ali-mubaje/Exodus-Multi-Wallet"
  action="${1:-toggle}"
  if [ "$#" -gt 0 ]; then shift; fi
  case "$action" in
    toggle|install|update|uninstall|status) ;;
    *) echo "Unknown action '$action'. Use toggle, install, update, uninstall or status."; exit 1 ;;
  esac

  command -v node >/dev/null 2>&1 || { echo "Node.js is required. Get it at https://nodejs.org/ and run this again."; exit 1; }

  case "$(uname -s)" in
    Darwin) local_dir="$HOME/Library/Application Support/Exodus-Multi-Wallet" ;;
    *) local_dir="$HOME/.local/share/exodus-multi-wallet" ;;
  esac

  # This script arrives through a pipe; give the updater the terminal for its confirmation question.
  input=/dev/null
  if [ -t 1 ] && (: </dev/tty) 2>/dev/null; then input=/dev/tty; fi

  if [ -f "$local_dir/update.js" ]; then
    echo "Using the local updater: $local_dir/update.js"
    node "$local_dir/update.js" "$action" "$@" <"$input"
    return
  fi

  command -v curl >/dev/null 2>&1 || { echo "curl is required to download the updater."; exit 1; }
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  echo "Downloading the updater from the latest release of $repo ..."
  curl -fsSL --proto '=https' --proto-redir '=https' --max-filesize 1048576 \
    -o "$tmp/update.js" "https://github.com/$repo/releases/latest/download/update.js" \
    || { echo "Could not download the updater from https://github.com/$repo/releases/latest"; exit 1; }
  node "$tmp/update.js" "$action" "$@" <"$input"
}

emw_main "$@"
