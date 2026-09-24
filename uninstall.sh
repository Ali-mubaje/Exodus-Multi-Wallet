#!/usr/bin/env sh
# Exodus Multi-Wallet – remove the wallet sidebar and restore the original Exodus (macOS / Linux).
# Usage:  sh uninstall.sh   (or ./uninstall.sh after chmod +x)
cd "$(dirname "$0")" || exit 1
exec node install.js uninstall
