#!/usr/bin/env sh
# Exodus Multi Wallet – install the wallet sidebar into Exodus (macOS / Linux).
# Usage:  sh install.sh   (or ./install.sh after chmod +x)
cd "$(dirname "$0")" || exit 1
exec node install.js install
