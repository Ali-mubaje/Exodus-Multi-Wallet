# Exodus Multi Wallet – a wallet sidebar for Exodus

Exodus Multi Wallet adds a sidebar to the [Exodus](https://www.exodus.com/) desktop app that lets you manage
**several independent wallets** (each with its own 12-word phrase) and switch between them with one
click – without swapping the data folder by hand every time.

The sidebar is styled to match Exodus: same colors, font (Roboto) and the signature violet-to-cyan
gradient. It automatically picks up the active Exodus theme as well as the language and display currency.

> **In short:** a wallet switcher that looks and feels like it shipped with Exodus.

**Version 1.1.0** · tested with **Exodus 26.8.27 on Windows** and **26.8.26 on macOS** · Linux: should
work but not yet tested against a specific version.

<p align="center">
  <img src="docs/images/sidebar.png" width="330" alt="Wallet sidebar with combined total and wallet list">
</p>

---

## Features

- **Multiple wallets side by side** – each in its own data folder under the Exodus-Wallets directory,
  each with its own 12-word phrase.
- **One-click switching** – open a wallet, jump to an already-running window, or *Switch* to close the
  current wallet and open another – the new window appears exactly where the old one was, in the same
  size (maximized if the old one was). With background sync the wallet is already loaded, so switching
  is almost instant.
- **Several wallets open at once** – each wallet runs in its own Exodus window/process, so you can keep
  multiple wallets open side by side; the sidebar marks which ones are currently running.
- **Combined total up top** – the value of all wallets together; with mixed currencies shown as
  subtotals (e.g. `$12,330.19 + £150.14`; no online exchange-rate conversion).
- **Balances without opening** – every running window saves its last fiat balance every 20 s, so the
  sidebar shows the balances of all wallets.
- **Background sync** – while any Exodus window is open, all your other wallets keep running
  invisibly (each as its own hidden Exodus instance, using Exodus' own sync). Balances stay current and
  payments are detected even for wallets you don't have open. Open a background wallet from the sidebar
  and its window simply appears; *Move to background* hides it again. Wallets you explicitly *close* stay
  closed until you open them again. When the last Exodus window closes, the background wallets quit too.
  Switch it off for all wallets in the settings (⚙ in the sidebar header), or for a single wallet in its
  ⋯ menu (*Don't sync in the background*). Wallets with a password stay locked in the background until
  you open them once and unlock them – the sidebar marks them.
- **Address Guard** – protects the saved receive addresses against "clipper" malware, which swaps crypto
  addresses so payments go to the attacker:
  - **Integrity seal** – when a wallet saves its addresses, they are sealed (HMAC-SHA256 over all of
    them, with one key for all wallets kept by the operating system: Windows DPAPI / macOS Keychain).
    Before every show, copy and export the seal is checked (*Verified · 2 min ago* in the address view) –
    from every window, for every wallet. Only a seal that verifies counts: addresses that can't be
    confirmed yet (e.g. right after an update, before the wallet has compared them with Exodus) show a
    calm *Not confirmed yet* and copying is paused until *Re-read from Exodus* (or opening the wallet).
  - **Match with Exodus** – each running wallet regularly re-reads its addresses from Exodus and
    compares. If the saved addresses were changed or don't match Exodus, copying and export are blocked
    for that wallet, a red banner explains it (*Show details*: saved vs. Exodus, difference highlighted)
    and *Re-read from Exodus* restores them. The wallet row and the wallet button get a red mark.
    If Exodus itself changed an address (e.g. a new address format), you get a neutral note instead.
  - **Clipboard watcher** – for ~2 s after copying, while Exodus is in front, the sidebar checks whether
    another program swaps the address in the clipboard. If a different address of the same format that
    isn't one of yours appears, a persistent warning shows up (plus a system notification, never with
    the address) – with a special view for "lookalike" addresses that keep the start and end.
    Copying something else yourself, switching apps or copying one of your own addresses never triggers it.
  - Both checks are **on by default** and can be switched off in the settings (⚙) – only there: the
    switches are signed with the seal key, so another program editing the settings file can't turn them
    off (the sidebar tells you if that was tried). While a check is off, an amber note under the header
    says so.
- **Incoming-payment notifications** – when another wallet receives funds, the Exodus window you're
  working in shows a small card at the top left: coin (with the original Exodus icon), amount, value at
  the time it arrived, wallet and portfolio – together with Exodus' own receive sound, in the same moment.
  Click the card to jump to that wallet. If you're not looking at Exodus, the card waits in the Exodus
  window you used last (its timer only runs once that window is in front again), and a system
  notification appears next to the clock (macOS: Notification Center). With the sidebar closed, a green
  dot/counter on the wallet button marks unseen payments; opening the sidebar makes the wallet's row glow
  and its balance roll up. Payments to the wallet of the current window are left to Exodus' own display.
  The sound plays exactly once: for a background wallet the card plays it; if the receiving wallet's
  window is visible, Exodus plays it there and the card stays silent. Hidden balances hide the amount in
  the card and the system notification too.
- **Setup progress for new wallets** – after *Create*, *Restore with 12 words* or *Adopt old folder*, the
  wallet needs to stay open until Exodus has loaded everything. The sidebar shows what's happening
  (e.g. *Restoring – 12 coins left · keep it open*), and a **Ready** card appears once all balances and
  addresses are loaded – then you can close it.
- **Copy addresses without opening** – receive addresses for all coins, with a coin search and
  **portfolio tabs**; with several portfolios you copy the address of the right one.
- **Bulk export** – *Export addresses …* lets you multi-select portfolios (and optionally filter by
  coin) and copies every matching address to the clipboard, **one address per line**. The export icon in
  the header does the same **across all wallets** – pick which wallets to include and export them at once.
- **Show 12 words** – takes you to Exodus' own backup screen (Exodus asks for the password there).
- **Set a start wallet** – this wallet opens when you launch Exodus normally.
- **Rename** – including open wallets (they are closed for it and optionally reopened).
- **Delete** – moves the wallet folder to the **trash/recycle bin** (confirm by typing the name).
- **Custom picture per wallet** – or the Exodus logo as the default.
- **Adopt old folders** – manually renamed `exodus.wallet` folders are detected and copied in.
- **Window title** – each window carries its wallet name (taskbar, Alt+Tab / ⌘Tab).
- **Right-click** a wallet to open the menu at the cursor.
- **Language & currency** follow the Exodus setting (English/German, with matching number and date format).

### Screenshots

| Action menu | Copy addresses | Delete wallet |
|:---:|:---:|:---:|
| ![Menu](docs/images/menu.png) | ![Addresses](docs/images/addresses.png) | ![Delete](docs/images/delete.png) |

<p align="center">
  <img src="docs/images/notification.png" width="396" alt="Incoming-payment notification at the top left, with an unseen-payments counter on the wallet button">
  <br><em>Incoming payment on another wallet – with the counter for unseen payments on the wallet button</em>
</p>

*(The images show sample data in a test environment.)*

---

## Quick install (one line)

**Requirements:** [Node.js](https://nodejs.org/) and the Exodus desktop app. **Quit Exodus first.**
These commands install the sidebar from the latest **signed release** – run again to uninstall it (toggle).

**Windows (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/Ali-mubaje/Exodus-Multi-Wallet/main/bootstrap.ps1 | iex
```

**macOS / Linux:**

```sh
curl -fsSL https://raw.githubusercontent.com/Ali-mubaje/Exodus-Multi-Wallet/main/bootstrap.sh | sh
```

The script only downloads the updater (`update.js`) from the latest GitHub release and runs it. The
updater checks the release signature and every file (see [What gets verified](#what-gets-verified)),
shows which version it is about to install and asks before changing anything. After the install it
keeps a copy of itself on your computer – the **local updater** – which you use for all later updates.

> These fetch and run a script from this repository. That's convenient but powerful – only paste a
> `curl … | sh` / `irm … | iex` command from a source you trust, and feel free to open
> [`bootstrap.sh`](bootstrap.sh) / [`bootstrap.ps1`](bootstrap.ps1) first to see exactly what they do.
> The one-liner is meant for the **first install** only: it trusts whatever the repository serves at
> that moment. Updates should go through the local updater below.

### Update to the latest version

Run the **local updater** that the first install set up (also after every Exodus update). Quit Exodus
first. It checks every release with the release key it already has, so a changed script or a
compromised account on GitHub can't slip anything past it.

| OS | Command |
|---|---|
| Windows (PowerShell) | `& "$env:LOCALAPPDATA\Exodus-Multi-Wallet\update.cmd"` |
| Windows (cmd) | `"%LOCALAPPDATA%\Exodus-Multi-Wallet\update.cmd"` |
| macOS | `sh ~/Library/Application\ Support/Exodus-Multi-Wallet/update.sh` |
| Linux | `sh ~/.local/share/exodus-multi-wallet/update.sh` |

It shows something like `Installed: v1.1.0 → Available: v1.1.1 (commit abc1234)` and asks before
installing. Options (after the command):

| Option | What it does |
|---|---|
| `update` *(default)* | install the latest release unless it is already installed |
| `install` | install / reinstall the release |
| `uninstall` | remove the sidebar |
| `status` | show what is installed and which release is available |
| `--version v1.2.3` | use that release instead of the latest |
| `--yes` | don't ask |
| `--allow-downgrade` | allow a release older than the installed one (refused otherwise) |
| `--app "<path>"` | use a specific Exodus install |

The one-liners still work for updates too (`$env:EMW_ACTION='update'; irm … | iex` on Windows,
`curl … | sh -s -- update` on macOS/Linux) – they simply hand over to the local updater if it exists.
Running the local updater directly is safer, because the one-liner script itself comes fresh from
GitHub each time.

### What gets verified

- Every release has a **manifest** (`release-manifest.json`: version, exact commit and the SHA-256 of
  every file the installer uses) with an **Ed25519 signature** (`release-manifest.sig`). The public key
  is pinned inside `update.js`; the private key is kept offline by the maintainer.
- The updater downloads the manifest and signature from GitHub Releases – https only, at most 5
  redirects and only to `github.com` / `githubusercontent.com` – and checks the signature with the pinned
  key.
- It then downloads each file from `raw.githubusercontent.com` **at exactly the signed commit** and
  checks its SHA-256. Any mismatch aborts, and nothing is installed.
- It refuses to install an older version than the one installed (unless `--allow-downgrade`).
- `install.js` from those verified files does the install, then replaces the local updater with the
  verified `update.js` of that release – so a new updater only lands on your computer after it passed
  the check with the old key.
- **First install (trust on first use):** the one-liner downloads `update.js` from the latest release.
  It verifies the release with the key it carries and checks that it is itself the `update.js` listed in
  that signed manifest. To check it by hand, compare the fingerprint it prints (`release key …`) with the
  one in the release notes and here – **release key fingerprint:** `f506 5a02 2274 b91b b9bc f8fc 2fb2 466c`.
- **Key rotation isn't supported yet.** If the release key ever had to change, you would have to delete
  the local updater folder and do a fresh first install with the one-liner.

---

## Manual installation

**Requirements:** [Node.js](https://nodejs.org/) and the Exodus desktop app. Works on **Windows,
macOS and Linux**. No `npm install` needed – the installer only uses Node's built-ins.

Get the files (clone the repo or download it), so `install.js` and the `payload/` folder sit together.
A manual install uses exactly the files you have – no signature check happens and no local updater is
set up (use the one-liner above for that):

```
exodus-multi-wallet/
├── install.js
└── payload/
    ├── main.js
    └── preload.js
```

Then **quit Exodus completely** (also the tray/menu-bar icon) and run one command:

### Windows

```bat
node install.js install
```

Or double-click **`install.cmd`**.

### macOS / Linux

```sh
node install.js install
```

Or run **`sh install.sh`**.

After it finishes, start Exodus – the wallet button is at the top left, before the logo.

### Uninstall

Restores the original Exodus from the automatic backup (on macOS including Exodus' original code
signature – see [Platform notes](#platform-notes)):

| Installed with | Command |
|---|---|
| the one-liner (local updater) | the local updater with `uninstall`, e.g. `& "$env:LOCALAPPDATA\Exodus-Multi-Wallet\update.cmd" uninstall` or `sh ~/.local/share/exodus-multi-wallet/update.sh uninstall` – or run the one-liner again (toggle) |
| a clone, Windows | `node install.js uninstall`, or double-click `uninstall.cmd` |
| a clone, macOS / Linux | `node install.js uninstall`, or `sh uninstall.sh` |

Your wallets are kept (in the Exodus-Wallets folder in your app-data directory). The local updater stays
in its folder so a later reinstall keeps the same release key; delete that folder
(`%LOCALAPPDATA%\Exodus-Multi-Wallet`, `~/Library/Application Support/Exodus-Multi-Wallet` or
`~/.local/share/exodus-multi-wallet`) to remove it too.

### Other commands

| Command | What it does |
|---|---|
| `node install.js status` | For each detected Exodus install, show whether the sidebar is active (on macOS also which signature the app carries) |
| `node install.js install --app "<path>"` | Use a specific Exodus install instead of auto-detecting |

Where Exodus is looked for automatically:

| OS | Path |
|---|---|
| Windows | `%LOCALAPPDATA%\exodus\app-x.y.z\resources\app.asar` |
| macOS | `/Applications/Exodus.app/Contents/Resources/app.asar` |
| Linux | `/opt/Exodus/resources/app.asar` (and other common paths, or `exodus` on `PATH`) |

> **After every Exodus update**, run the local updater (or `install`) again – the update replaces the
> `app.asar` that the add-on patches. Your wallets are not affected.

---

## Platform notes

The installer is fully cross-platform. The runtime add-on works on all three systems, with two
Windows-only conveniences that simply don't appear elsewhere:

- **Desktop shortcuts** (`.lnk`) are Windows-only; the menu entry is hidden on macOS/Linux.
- **macOS code signing:** Exodus is signed with Exodus' Developer ID and notarized, so changing
  `app.asar` makes macOS report *“Exodus is damaged and can’t be opened.”* The installer handles this:
  - Before the first change it **backs up Exodus' original signature** (the main executable and
    `Contents/_CodeSignature/CodeResources`) to `Contents/Resources/wallet-switcher-signature.orig/`,
    next to `app.asar.orig`.
  - It then **re-signs only the outer app bundle** locally (ad-hoc, no `--deep`): the frameworks and
    helpers inside keep Exodus' own signatures, Exodus' entitlements are kept, and the Hardened Runtime
    is kept when Exodus' entitlements allow it (otherwise the installer says so). It verifies the result
    and removes only the quarantine flag.
  - **Uninstall** puts back `app.asar`, the executable and `CodeResources`, removes the backup and checks
    with `codesign --verify --deep --strict` that Exodus' original signature is valid again. If it
    isn't (e.g. the sidebar was installed by an older version of this tool, which re-signed everything),
    reinstall Exodus from [exodus.com](https://www.exodus.com/download/) – your wallets are not affected.
  - `node install.js status` (or the local updater with `status`) shows whether the app currently carries
    **Exodus' original Developer ID signature** or the **local ad-hoc** one.

  If the automatic re-sign ever fails, quit Exodus and run once in Terminal (adjust the path if Exodus is
  not in `/Applications`; add `sudo` only if the app belongs to another user):
  ```sh
  xattr -dr com.apple.quarantine /Applications/Exodus.app
  codesign --force --sign - --preserve-metadata=entitlements /Applications/Exodus.app
  ```
- **Exodus updates on macOS:** while the sidebar is installed, Exodus' **built-in auto-update may not
  work** – the app is signed locally instead of with Exodus' Team ID, so the updater is likely to reject
  genuine updates. Update Exodus by downloading it from [exodus.com](https://www.exodus.com/download/)
  and installing it over the old one, then run the local updater (or the installer) again.
- **First launch after installing (macOS):** macOS may show a security prompt once. Open **System
  Settings → Privacy & Security**, click **“Open Anyway”**, then start Exodus again and click **“Open”**.
  **This is only expected right after you ran this installer.** Never click “Open Anyway” (or re-sign
  anything) for an Exodus you just downloaded – a genuine Exodus from exodus.com opens without it. If a
  fresh download is reported as damaged, delete it and download it again from exodus.com.
- **macOS background sync:** background wallets are hidden from the Dock. macOS may throttle apps
  without a visible window (App Nap), so on a Mac background wallets can update more slowly than on
  Windows.
- Everything else – switching, balances, background sync, notifications, addresses, rename, delete,
  start wallet, custom pictures – works on all platforms.

Tested with **Exodus 26.8.27 on Windows** and **26.8.26 on macOS** (the latest on each at the time).
**Linux** has not been tested against a specific version yet; the installer detects the version and
warns if it differs from a tested one, but does not block. On any untested version, keep an eye out and
please report issues.

---

## Moving to another computer

Wallets, names, pictures, the start wallet and cached addresses live in the Exodus-Wallets folder in
your app-data directory (and the main wallet under the Exodus folder). The installer does **not** copy
these.

- **Fresh start:** install the add-on and restore each wallet from its 12-word phrase.
- **Manually renamed folders:** if an old `exodus.wallet` folder (e.g. `exodus.wallet1`) sits directly
  in the Exodus data folder, the sidebar offers *“Adopt old folder …”* at the bottom. The original is
  left untouched; the copy is verified file by file with checksums.

---

## Security

- The add-on **never reads or decrypts seeds, passwords or private keys** and makes **no network
  connections**.
- Via Exodus' own selectors it only reads fiat balances and public receive addresses and caches them
  in each wallet's data folder.
- For notifications it reads each running wallet's coin amounts per portfolio (read-only) and passes
  detected payments between windows through small local files; nothing leaves the computer.
- Background sync starts the normal Exodus app for each wallet, just without showing its window – it
  never enters or stores passwords; a password-protected wallet stays locked until you unlock it.
- **Address Guard:** saved receive addresses are sealed with an HMAC whose key is protected by the
  operating system (Windows DPAPI for your user account / Keychain via Electron `safeStorage`) and checked
  before every copy and export; the main process refuses to copy or export addresses that aren't verified
  ("fail closed"). The protection switches can only be turned off in the sidebar's settings (signed with
  the same key). The clipboard is only read for ~2 s
  right after you copy, only to compare – its contents are never stored, logged or sent anywhere, and
  warnings never contain addresses. Limits: malware running as your user with full control could in
  principle also use the OS key store – the comparison with Exodus is the second line of defence, and
  the address shown in Exodus (Receive) is always the one to trust.
- “Show 12 words” only opens Exodus' own backup screen – Exodus handles the password prompt.
- Delete means **trash/recycle bin**, never a hard delete. If moving to the bin fails, nothing happens.
- Actions only accept calls from the real Exodus UI (verified origin and session).
- **Installs and updates are signed:** the updater only installs a release whose manifest verifies with
  the pinned Ed25519 release key and whose every file matches its SHA-256 (see
  [What gets verified](#what-gets-verified)).

> ⚠️ Still: always back up your 12 words. They are the only way to recover a wallet if a data folder
> is lost.

---

## How it works

Exodus is an Electron app. The installer unpacks `app.asar`, appends **one line** to
`src/app/main/index.js` (inline, as an IIFE) and adds the two payload files next to it. Everything else
stays byte for byte identical; the original is kept as `app.asar.orig`.

- **`payload/main.js`** – runs in the main process: manages the data folders, launches Exodus with the
  official `--datadir` flag, caches balances and addresses, detects incoming payments, sets window
  titles and answers the sidebar's IPC calls.
- **`payload/preload.js`** – runs as an extra preload script in the Exodus UI (its own isolated world)
  and builds the sidebar as DOM. All actions go through IPC to `main.js`.
- **`install.js`** – reads and writes the asar format itself (including integrity hashes), verifies the
  result before replacing anything, and can cleanly uninstall.

More detail in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## For maintainers: publishing a signed release

Releases are signed with an Ed25519 key. [`tools/release.js`](tools/release.js) (pure Node) does the
signing; it never publishes anything itself.

**Once – create the release key:**

```sh
node tools/release.js --keygen /path/outside/the/repo/exodus-multi-wallet-release.pem
```

It refuses paths inside the repository, never overwrites an existing key, and restricts the file's
permissions. Keep the private key **offline** (e.g. an encrypted USB stick) and backed up: anyone who
has it can publish updates that every updater accepts, and if it is lost no further update can be
signed. Paste the printed public key into `RELEASE_PUBLIC_KEY` in [`update.js`](update.js) (the
updater refuses to run while it holds the placeholder), put the printed fingerprint into
[What gets verified](#what-gets-verified), and commit.

**Every release:**

1. Bump `VERSION` in `payload/main.js`, commit and **push** (the updater downloads the files from
   `raw.githubusercontent.com` at exactly the release commit).
2. On a clean checkout of that commit:
   ```sh
   node tools/release.js --key /path/outside/the/repo/exodus-multi-wallet-release.pem
   ```
   It refuses a dirty working tree and a key that doesn't match the pinned public key, reads the version
   from `payload/main.js`, hashes the committed files (`install.js`, `update.js`, `payload/*`) and writes
   `dist/release-manifest.json`, `dist/release-manifest.sig` and `dist/update.js` (`dist/` is ignored by
   git).
3. Review and run the `gh release create v<version> dist/release-manifest.json dist/release-manifest.sig
   dist/update.js --target <commit> …` command it prints. Mark it as the latest release – the one-liners
   and the updater use `releases/latest`.

Notes:

- The one-liners on `main` only work once at least one signed release exists; publish the first release
  right after pushing the new `bootstrap.*` / `update.js`.
- **Key rotation is not supported yet.** A new key means every user has to delete the local updater
  folder and install again with the one-liner (trust on first use). Guard the key accordingly.

---

## Built with AI

This project was created **100% with AI** (Anthropic's Claude). All code, the installer and this
documentation were AI-generated. Review the source before running it, especially since it modifies a
crypto wallet app – and always keep your 12-word phrases backed up.

## Disclaimer

This is an unofficial community add-on and is **not affiliated with Exodus Movement, Inc.** “Exodus”
is a trademark of its respective owner. Use at your own risk; patching `app.asar` may be overwritten by
future Exodus versions.

## License

[MIT](LICENSE) – covers this add-on's code, not Exodus itself.
