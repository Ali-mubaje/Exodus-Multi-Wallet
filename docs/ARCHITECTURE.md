# Architecture & internals

This document explains how Exodus Multi Wallet is built – for anyone reading the code, changing it, or adapting it
to a new Exodus version.

## Overview

Exodus is an Electron app. Exodus Multi Wallet hooks in at two places:

```
                 install.js
                     │  appends ONE line to src/app/main/index.js (inline IIFE)
                     ▼
┌──────────────────────────────┐        IPC (exodus-wallets:*)       ┌───────────────────────────┐
│  payload/main.js              │  ◄───────────────────────────────► │  payload/preload.js       │
│  (Electron main process)      │                                    │  (Exodus UI,              │
│                               │                                    │   isolated world)         │
│  • manage data folders        │                                    │  • sidebar as DOM         │
│  • launch Exodus with --datadir│                                   │  • menu, address view,    │
│  • balance/address cache      │                                    │    dialogs                │
│  • window titles, start wallet│                                    │  • calls main.js via IPC  │
│  • incoming-payment detection │   exodus-wallets:received  ──────► │  • notification cards     │
└──────────────────────────────┘                                    └───────────────────────────┘
```

## Installer (`install.js`)

- Reads `app.asar` with a small, self-contained asar parser (header pickle, offsets, per-4-MB-block
  integrity hashes).
- Backs up the untouched original as `app.asar.orig`. Every change is built from the original.
- Appends an IIFE-wrapped copy of `main.js` to `src/app/main/index.js` (marker
  `/*exodus-wallets-sidebar*/`). Why inline: Exodus overrides `require()` and only allows certain
  modules.
- Places `preload.js` under `src/app/wallet-switcher/`; the preload path is corrected from `main/` to
  `../wallet-switcher/preload.js` during inlining.
- Verifies the freshly built asar (payload files + a few unchanged files) **before** replacing the
  original.
- `uninstall` simply restores `app.asar.orig`.

### Cross-platform detection

`install.js` finds Exodus per OS and handles the `resources` vs `Resources` folder name:

| OS | App directory | asar |
|---|---|---|
| Windows | `%LOCALAPPDATA%\exodus\app-x.y.z` (newest) | `resources/app.asar` |
| macOS | `/Applications/Exodus.app/Contents` (and `~/Applications`) | `Resources/app.asar` |
| Linux | `/opt/Exodus`, `/usr/lib/exodus`, … or `exodus` on `PATH` | `resources/app.asar` |

`exodusRunning()` checks for a running Exodus (Windows: `tasklist`; posix: `ps`) so the installer can
refuse to patch while the app is open.

## Main process (`payload/main.js`)

### Wallet model
- **Default wallet:** the `Exodus` folder in the app-data dir (owned by Exodus, launched without
  `--datadir`).
- **Other wallets:** one folder each under `Exodus-Wallets/<name>`, launched with `--datadir <folder>`.
- "Open" detection: on Windows Chromium keeps a `lockfile` in the folder while Exodus runs; on
  macOS/Linux Exodus' single-instance lock is the symlink `SingletonLock` → `<host>-<pid>`, and
  `lockAlive()` also checks that this pid still exists (a crash can leave the symlink behind).

### Balance & address cache
- A small script is injected into each running Exodus window via `executeJavaScript` that reads fiat
  balances, language and currency through Exodus' own selectors (`selectors.fiatBalances`,
  `selectors.locale`, `selectors.walletAccounts`).
- The result is stored as `wallet-switcher-cache.json` in the wallet's data folder, so other windows
  see the balance without opening the wallet. Interval: 20 s.
- **Addresses:** Exodus' address API is not global; it arrives via a React provider (`exodus` prop).
  The script walks the React fiber tree to find it and calls
  `addressProvider.getReceiveAddress({ assetName, walletAccount })` per portfolio, excluding hardware
  portfolios (Ledger/Trezor). Interval: 5 min. Stored under `addresses`/`addressesAt`.

### Wallet status (every window, every 3 s)
- `STATUS_JS` reads Exodus' own redux state: `application.walletExists / isLocked / isLoading /
  isRestoring`, `restoringAssets.data` (coins still being restored) and `fiatBalances.loaded`.
  `statusFrom()` turns that into `onboarding → locked → loading → restoring (n left) → syncing → ready`.
- Each window writes it with `pid` and `hidden` to `wallet-switcher-live.json` in its own folder (on
  change, at least every 10 s). The sidebar reads it for other wallets (fresh = younger than 25 s).

### Background sync (hidden instances)
- A **visible** window runs `ensureBackground()` every 20 s: every wallet that has a seed, isn't running,
  isn't waiting for its 12 words and isn't paused is launched with `EXODUS_WALLETS_HIDDEN=1`. A
  `wallet-switcher-bgstart` file (mtime) makes sure only one window launches it and retries after 90 s.
- A **hidden** instance (`enterHiddenMode()`) wraps `show / showInactive / focus / restore / maximize /
  setFullScreen` of `BaseWindow`/`BrowserWindow`: Exodus' own attempts to show its window are recorded
  instead of executed; a 400 ms safety net hides anything that still becomes visible. On macOS the Dock
  icon is hidden. Exodus syncs as usual in its own hidden "Wallet Process" window.
- **Reveal:** opening the wallet launches Exodus for that folder again; Exodus reports that to the
  running instance as `second-instance`. Our handler (registered before Exodus' own) replays the recorded
  `show()`/`maximize()`, then Exodus focuses the window. The `focus`/`showBackup` commands reveal too.
  `hide` (menu *Move to background*) goes the other way.
- **Watchdog:** a hidden instance quits once no visible window has a fresh live file for 30 s, or when
  background sync is switched off (`backgroundSync` in `settings.json`, default on).
- **Pause:** `wallet-switcher-pause` holds a timestamp until which the wallet must not be started –
  2 min around rename/delete, and effectively "until opened again" after an explicit *Close*.
- **Locked wallets:** a password-protected wallet stays on Exodus' lock screen in the background (status
  `locked`); the add-on never touches passwords. After locking/unlocking the payment baseline is reset.

### Setup progress for new wallets
- *Create*, *Restore* and *Adopt old folder* write `wallet-switcher-setup.json` (`kind`, `since`).
- The wallet's own window watches its status; once it has been `ready` for a few seconds, it fetches and
  saves the addresses (`snapshotAddresses(force)`, shown as `addresses`) and the balance, then deletes the
  marker, stores `setupDoneAt` in the cache and writes a `type: 'ready'` event. That one is delivered to the
  focused window like a payment – including the wallet's own window.

### Incoming-payment notifications
- **Detect (every window, for its own wallet):** every 3 s `HOLDINGS_JS` reads the coin amount per
  portfolio and asset (`selectors.balances.getBalances(...).balance`) plus Exodus' own fiat value for it
  (`selectors.fiatBalances.byAssetSource`). The last amounts are kept in memory only; an increase is a
  payment.
- **No false alarms:** the first read and the first 30 s after the UI is ready only set the baseline
  (Exodus is still loading/syncing). A lower amount (a send, or an asset briefly missing while loading)
  is only accepted once it has stayed lower for 20 s.
- **Hand-over:** the receiving window first saves its balance (so the others can roll it), then writes
  one JSON file per payment to `Exodus-Wallets/.incoming/` – wallet, asset, amount, fiat value at that
  moment, currency, portfolio (only with several portfolios). If that window is in front, nothing is
  written: Exodus shows its own notification there.
- **Deliver (only the focused window):** every second the window in front (`BaseWindow.getFocusedWindow()`)
  claims open events by creating `<id>.done` with the exclusive `wx` flag – whoever creates it shows the
  card, so card and sound appear in exactly one window. Events of its own wallet are claimed silently.
  It adds the coin icon as a `data:` URL, the wallet picture, the hide-balances setting and Exodus'
  sound setting (`config` keys `sounds.all.enabled` / `sounds.all.volume`) and sends
  `exodus-wallets:received`. Undelivered events expire after 10 min; old files are pruned.
- **One sound:** Exodus plays `receive.wav` itself on `TX_RECEIVE` in the receiving wallet's window –
  even when that window is hidden. `STATUS_JS` therefore wraps `HTMLMediaElement.prototype.play` in the
  page (observe only, it always calls the original) and counts `receive.wav` plays. If the count went up
  around the payment (checked 1.5 s after detection), the event carries `exodusSound: true` and the card
  stays silent.
- **Only running wallets** are watched – with background sync that is every wallet while any Exodus
  window is open.

### Language (i18n)
- Follows `selectors.locale.language` (default `en`). Main-process strings: `MESSAGES` (en, de).
- The sidebar has its own dictionary `TEXTS` in `preload.js` and switches at runtime when
  `state.locale.language` changes.

### Window titles
- Exodus' main window is a `BaseWindow` (not a `BrowserWindow`), so there is no
  `browser-window-created`. Titles are set on an interval: “EXODUS <version> – <wallet name>”.

### Start wallet & redirect
- `startWallet` lives in `Exodus-Wallets/settings.json`.
- When Exodus is launched without `--datadir` (desktop icon/start menu) and a different start wallet is
  set, `redirectToStartWallet()` relaunches into that folder and exits.
- Our own launches carry `EXODUS_WALLETS_DIRECT=1` and are not redirected; shortcuts always use
  `--datadir`.

### Command channel between windows
- Each wallet runs in its own process. For "close", "focus" and "show backup", `main.js` drops a
  `wallet-switcher-command.json` into the target folder; that process polls it once a second.

### Rename & delete
- **Rename** of an open foreign wallet: send a `quit` command, wait for the `lockfile` to vanish, then
  rename the folder. The **current** wallet is renamed by a detached helper after exit (PowerShell on
  Windows, a `sh` script on macOS/Linux) that can optionally reopen it. The default wallet only gets a
  display name (`standardName`); its folder stays put.
- **Delete** goes through `shell.trashItem` (trash/recycle bin) only. If it fails, it aborts.
  Confirmation is by typing the name; the client gates the button and `api.remove` re-checks.

### Icons & pictures
- **Coin icons:** taken from Exodus itself (`src/res/deps/img/<asset>-<hash>.svg`, preferring 40×40).
  Tokens Exodus adds at runtime (custom tokens, e.g. *XO Cash* on Solana) have no icon in the app; Exodus
  stores theirs as `<data folder>/images/<asset>.svg`, which we read as a `data:` URL. Anything else falls
  back to the base coin's icon.
- **Wallet picture:** default is the Exodus logo. A custom picture is cropped square, resized to 128 px
  and stored as `wallet-switcher-avatar.png` in the data folder; the sidebar gets it as a `data:` URL
  (Exodus' CSP only allows `self` and `data:`).

### Platform-specific runtime bits
- **Desktop shortcuts** use `shell.writeShortcutLink` (Windows `.lnk`) and are hidden/blocked on other
  platforms.
- The current-wallet rename helper has a PowerShell and a POSIX shell variant.

## UI (`payload/preload.js`)

- Runs in an isolated world (no Node; only the global selectors used for the cache).
- Builds `#xw-root` directly on `body`. Because the Exodus theme class sits on an element inside
  `#app-container`, `syncTheme()` copies the computed CSS variables over.
- CSS is deliberately shielded against Exodus with `!important` and a maximal `z-index`.
- All privileged actions go through `ipcRenderer.invoke('exodus-wallets:*')`; `main.js` checks the
  sender URL and session before doing anything.
- **Notifications** (`XW.nt`): cards live in `.xw-nt-stack` inside `#xw-root`, below the backdrop and
  the sidebar. `notify()` inserts the card and starts Exodus' own `media/audio/receive.wav` (loaded once,
  the same file Exodus plays) in the same call. With the sidebar closed, unseen payments are counted on
  the wallet button; opening it makes the affected rows glow and their balances roll (after the panel
  stagger, 460 ms + 30 ms per row). Motion follows `#xw-root.xw-reduce` for reduced motion.

## Files in a wallet's data folder

| File | Purpose |
|---|---|
| `wallet-switcher-cache.json` | balance, currency, portfolios, receive addresses (cache) |
| `wallet-switcher-avatar.png` | custom wallet picture (optional) |
| `wallet-switcher-command.json` | short-lived command for this wallet's window |
| `wallet-switcher-restore` | marker: wallet should be set up from a 12-word phrase |
| `wallet-switcher-setup.json` | marker: new wallet, setup not finished yet |
| `wallet-switcher-live.json` | live status of the running instance (pid, hidden, sync state) |
| `wallet-switcher-pause` | do not start in the background until this timestamp |
| `wallet-switcher-bgstart` | last background start (prevents double starts) |

Global, under `Exodus-Wallets`: `settings.json` (settings incl. start wallet, default-wallet
display name), `imported.log` (adopted old folders) and `.incoming/` (short-lived incoming-payment
events and their `.done` claims, pruned after ~10 min).

## Adapting to a new Exodus version

Checkpoints if something stops working:

1. **Session name** of the UI (`persist:main` → folder `Partitions/main`).
2. **Selectors** `selectors.fiatBalances/locale/walletAccounts/enabledAssets/assets`, for
   notifications also `selectors.fiatBalances.byAssetSource`, `selectors.balances.getBalances` and the
   `config` keys `sounds.all.enabled` / `sounds.all.volume`.
3. **Address API** via the React provider (`exodus.addressProvider.getReceiveAddress`).
4. **Window type** of the main window (currently `BaseWindow`).
5. **Icon path** `src/res/deps/img/<asset>-<hash>.svg`.
6. **Backup route** `/settings/backup` for "show 12 words".
7. **Receive sound** `src/static/media/audio/receive.wav` (page-relative `media/audio/receive.wav`).
8. **Redux state** `application.{walletExists,isLocked,isLoading,isRestoring}` and `restoringAssets`
   (wallet status), `second-instance` handling and the `show()`/`maximize()` calls of the main window
   (background sync).

The debug log on the desktop (`exodus-wallets-debug.log`) shows which step fails.

> Note: code comments, log output and docs are in English. The only German in the code is the German UI
> translation (`TEXTS.de` in `preload.js`, `MESSAGES.de` in `main.js`), used when Exodus runs in German.
> Up to v1.0.2 the global files were called `einstellungen.json` and `importiert.log`; `globalFile()`
> renames them to `settings.json` / `imported.log` on first use, so existing settings are kept.
