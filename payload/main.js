'use strict'
/*
 * Exodus Wallet-Seitenleiste – Hauptprozess
 * ------------------------------------------
 * Wird über eine einzige angehängte Zeile am Ende von src/app/main/index.js geladen (siehe install.js).
 *
 * Verwaltet mehrere getrennte Exodus-Wallets (jede mit eigener 12-Wörter-Phrase), jede in einem
 * eigenen Datenordner. Gestartet wird Exodus dafür mit seinem offiziellen Parameter --datadir.
 *
 *  - greift NICHT auf Seeds, Passwörter oder private Schlüssel zu
 *  - baut KEINE Netzwerkverbindungen auf
 *  - liest nur die Fiat-Kontostände über Exodus' eigene Selektoren und speichert sie als Cache
 *    im Datenordner der jeweiligen Wallet (wallet-switcher-cache.json)
 */

// BaseWindow gibt es erst ab Electron 30 – Exodus nutzt es für sein Hauptfenster
const { app, BaseWindow, BrowserWindow, clipboard, dialog, ipcMain, nativeImage, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const { spawn } = require('child_process')

const VERSION = '1.0.2'
const TAG = '[exodus-wallets]'
const PRELOAD = path.join(__dirname, 'preload.js')

// Debug-Log in Datei schreiben (da DevTools evtl. deaktiviert)
const DEBUG_LOG = path.join(app.getPath('desktop'), 'exodus-wallets-debug.log')
const debug = (msg) => {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  try { fs.appendFileSync(DEBUG_LOG, line) } catch (e) {}
  console.log(TAG, msg)
}
debug('=== main.js geladen ===')

// Debug-Nachrichten von preload.js empfangen
ipcMain.on('exodus-wallets:debug', (event, msg) => {
  debug(`[preload] ${msg}`)
})
const CACHE_FILE = 'wallet-switcher-cache.json'
const RESTORE_MARKER = 'wallet-switcher-restore' // unsere Merkhilfe: Wallet soll per 12 Wörtern eingerichtet werden
const RESTORE_FLAG = 'restore-mnemonic' // Exodus' eigene Markierung: startet direkt mit "12 Wörter eingeben"
const SETTINGS_FILE = 'einstellungen.json'
const IMPORT_LOG = 'importiert.log'
// Kurz genug, dass andere offene Fenster den Stand zeitnah sehen; der Snapshot selbst kostet < 1 ms
const SNAPSHOT_EVERY_MS = 20 * 1000

const norm = (p) => path.resolve(p).toLowerCase()
const exists = (p) => fs.existsSync(p)
const sha256File = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch (e) { return null } }

function writeJson (file, data) {
  const tmp = file + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
  fs.renameSync(tmp, file)
}

const defaultStandardDir = () => path.join(app.getPath('appData'), 'Exodus')
const standardDir = () => process.env.EXODUS_WALLETS_STANDARD_DIR || defaultStandardDir()
const profilesRoot = () => process.env.EXODUS_WALLETS_ROOT || path.join(app.getPath('appData'), 'Exodus-Wallets')
const currentDir = () => app.getPath('userData')
const isCurrent = (dir) => norm(dir) === norm(currentDir())
// Chromium legt "lockfile" im Datenordner an, solange eine Instanz läuft (wird beim Beenden gelöscht)
const isRunning = (dir) => isCurrent(dir) || exists(path.join(dir, 'lockfile'))
const hasWallet = (dir) => exists(path.join(dir, 'exodus.wallet', 'seed.seco'))

// ---------------------------------------------------------------------------------------------
// Sprache: folgt Exodus' eigener Einstellung (selectors.locale.language, Standard "en").
// Wird beim Kontostand-Snapshot aus der Oberfläche gelesen; unbekannte Sprachen fallen auf Englisch.
// ---------------------------------------------------------------------------------------------

const MESSAGES = {
  en: {
    standard: 'Default',
    notFound: 'This wallet could not be found.',
    nameEmpty: 'Please enter a name.',
    nameTooLong: 'The name is too long (40 characters max).',
    nameChars: 'These characters are not allowed: \\ / : * ? " < > |',
    nameTrailing: 'The name must not end with a dot or a space.',
    nameReserved: 'This name is reserved by Windows.',
    nameStandard: (name) => `The name “${name}” is reserved for the default wallet.`,
    nameExists: 'A wallet with this name already exists.',
    folderGone: 'This folder could not be found (anymore).',
    copyIncomplete: 'The copy is incomplete.',
    fileNotCopied: (rel) => `The file ${rel} was not copied correctly.`,
    cannotRename: 'This wallet cannot be renamed.',
    cannotRenameCurrent: 'The wallet in this window cannot be renamed – open a different wallet to do that.',
    renameRunning: 'This wallet is currently open. Please close its Exodus window first.',
    shortcutFailed: 'The shortcut could not be created.',
    shortcutWinOnly: 'Desktop shortcuts are only available on Windows.',
    shortcutDescription: (label) => `Exodus wallet: ${label}`,
    notAllowed: 'Not allowed.',
    cannotCloseCurrent: 'This is the wallet of this window – close the window itself instead.',
    closeTimeout: 'The wallet did not close within 30 seconds. Please close its Exodus window manually.',
    cannotStart: 'This wallet cannot be used as start wallet.',
    notReady: 'Exodus is not ready yet – try again in a moment.',
    addressGone: 'This address is no longer saved. Open the wallet once to refresh its addresses.',
    avatarPick: 'Choose a picture for this wallet',
    images: 'Images',
    avatarInvalid: 'This picture could not be read – please use a PNG or JPG file.',
    avatarTooLarge: 'The picture is too large (15 MB max).',
    cannotDelete: 'The default wallet cannot be deleted here.',
    deleteCurrent: 'This is the wallet of this window – switch to another wallet first and delete it from there.',
    deleteConfirm: 'The name does not match – please type it exactly.',
    deleteRunning: 'This wallet is open. It has to be closed first.',
    trashFailed: (msg) => `The wallet could not be moved to the Recycle Bin (${msg}). Nothing was deleted.`,
  },
  de: {
    standard: 'Standard',
    notFound: 'Diese Wallet wurde nicht gefunden.',
    nameEmpty: 'Bitte einen Namen eingeben.',
    nameTooLong: 'Der Name ist zu lang (höchstens 40 Zeichen).',
    nameChars: 'Diese Zeichen sind nicht erlaubt: \\ / : * ? " < > |',
    nameTrailing: 'Der Name darf nicht mit einem Punkt oder Leerzeichen enden.',
    nameReserved: 'Dieser Name ist unter Windows reserviert.',
    nameStandard: (name) => `Der Name „${name}“ ist für die Standard-Wallet reserviert.`,
    nameExists: 'Eine Wallet mit diesem Namen gibt es schon.',
    folderGone: 'Dieser Ordner wurde nicht (mehr) gefunden.',
    copyIncomplete: 'Die Kopie ist unvollständig.',
    fileNotCopied: (rel) => `Die Datei ${rel} wurde nicht korrekt kopiert.`,
    cannotRename: 'Diese Wallet kann nicht umbenannt werden.',
    cannotRenameCurrent: 'Die Wallet in diesem Fenster kann nicht umbenannt werden – öffne dafür eine andere Wallet.',
    renameRunning: 'Diese Wallet ist gerade geöffnet. Bitte zuerst ihr Exodus-Fenster schließen.',
    shortcutFailed: 'Die Verknüpfung konnte nicht erstellt werden.',
    shortcutWinOnly: 'Desktop-Verknüpfungen gibt es nur unter Windows.',
    shortcutDescription: (label) => `Exodus-Wallet: ${label}`,
    notAllowed: 'Nicht erlaubt.',
    cannotCloseCurrent: 'Das ist die Wallet dieses Fensters – schließe dafür einfach das Fenster.',
    closeTimeout: 'Die Wallet hat sich nicht innerhalb von 30 Sekunden geschlossen. Bitte ihr Exodus-Fenster von Hand schließen.',
    cannotStart: 'Diese Wallet kann nicht als Start-Wallet festgelegt werden.',
    notReady: 'Exodus ist noch nicht bereit – bitte gleich noch einmal versuchen.',
    addressGone: 'Diese Adresse ist nicht mehr gespeichert. Öffne die Wallet einmal, um ihre Adressen zu aktualisieren.',
    avatarPick: 'Bild für diese Wallet wählen',
    images: 'Bilder',
    avatarInvalid: 'Dieses Bild konnte nicht gelesen werden – bitte eine PNG- oder JPG-Datei verwenden.',
    avatarTooLarge: 'Das Bild ist zu groß (höchstens 15 MB).',
    cannotDelete: 'Die Standard-Wallet kann hier nicht gelöscht werden.',
    deleteCurrent: 'Das ist die Wallet dieses Fensters – wechsle zuerst zu einer anderen Wallet und lösche sie von dort.',
    deleteConfirm: 'Der Name stimmt nicht überein – bitte genau so eintippen.',
    deleteRunning: 'Diese Wallet ist geöffnet. Sie muss zuerst geschlossen werden.',
    trashFailed: (msg) => `Die Wallet konnte nicht in den Papierkorb verschoben werden (${msg}). Es wurde nichts gelöscht.`,
  },
}

let uiLanguage = 'en'
const langKey = (lang) => {
  const base = String(lang || '').toLowerCase().split(/[-_]/)[0]
  return Object.prototype.hasOwnProperty.call(MESSAGES, base) ? base : 'en'
}
function t (key, ...args) {
  const msg = MESSAGES[langKey(uiLanguage)][key]
  return typeof msg === 'function' ? msg(...args) : msg
}
// Die Standard-Wallet kann einen eigenen Anzeigenamen bekommen (ihr Ordner bleibt %APPDATA%\Exodus)
const standardLabel = () => readSettings().standardName || t('standard')

// ---------------------------------------------------------------------------------------------
// Wallets auflisten
// ---------------------------------------------------------------------------------------------

function walletDirs () {
  const list = []
  let entries = []
  try { entries = fs.readdirSync(profilesRoot(), { withFileTypes: true }) } catch (e) {}
  for (const d of entries) {
    if (d.isDirectory() && !d.name.startsWith('.')) {
      list.push({ id: 'p:' + d.name, name: d.name, dir: path.join(profilesRoot(), d.name), isStandard: false })
    }
  }
  list.sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base', numeric: true }))
  list.unshift({ id: 'standard', name: 'Standard', dir: standardDir(), isStandard: true })
  // Mit einem fremden --datadir gestartet? Dann trotzdem als "aktuelle Wallet" anzeigen.
  if (!list.some((w) => isCurrent(w.dir))) {
    list.unshift({ id: 'current', name: path.basename(currentDir()), dir: currentDir(), isStandard: false, external: true })
  }
  return list
}

function findWallet (id) {
  const w = walletDirs().find((x) => x.id === id)
  if (!w) throw new Error(t('notFound'))
  return w
}

function lastUsed (dir) {
  let newest = 0
  try {
    const walletDir = path.join(dir, 'exodus.wallet')
    for (const f of fs.readdirSync(walletDir)) newest = Math.max(newest, fs.statSync(path.join(walletDir, f)).mtimeMs)
  } catch (e) {}
  return newest ? new Date(newest).toISOString() : null
}

function describe (w) {
  const walletExists = hasWallet(w.dir)
  if (walletExists && exists(path.join(w.dir, RESTORE_MARKER))) {
    try { fs.unlinkSync(path.join(w.dir, RESTORE_MARKER)) } catch (e) {} // Wiederherstellung ist erledigt
  }
  return {
    id: w.id,
    name: w.name,
    label: w.isStandard ? standardLabel() : w.name,
    isStandard: w.isStandard,
    external: !!w.external,
    isCurrent: isCurrent(w.dir),
    running: isRunning(w.dir),
    hasWallet: walletExists,
    restorePending: !walletExists && exists(path.join(w.dir, RESTORE_MARKER)),
    lastUsed: lastUsed(w.dir),
    cache: summarizeCache(readJson(path.join(w.dir, CACHE_FILE))),
    avatar: avatarFor(w.dir),
  }
}

// Eigenes Wallet-Bild: liegt als kleines PNG im Datenordner der Wallet (wandert beim Umbenennen mit).
// Die Seitenleiste bekommt es als data:-URL – Exodus' CSP erlaubt Bilder nur von 'self' und data:.
const AVATAR_FILE = 'wallet-switcher-avatar.png'
const AVATAR_SIZE = 128
const avatarCache = new Map()
function avatarFor (dir) {
  const file = path.join(dir, AVATAR_FILE)
  try {
    const mtime = fs.statSync(file).mtimeMs
    const hit = avatarCache.get(file)
    if (hit && hit.mtime === mtime) return hit.data
    const data = 'data:image/png;base64,' + fs.readFileSync(file).toString('base64')
    avatarCache.set(file, { mtime, data })
    return data
  } catch (e) {
    return null
  }
}

// Die Adressliste holt die Seitenleiste nur bei Bedarf (api.addresses) – im Status reicht die Anzahl
function summarizeCache (cache) {
  if (!cache) return null
  const { addresses, ...rest } = cache
  return { ...rest, addressCount: Array.isArray(addresses) ? addresses.length : 0 }
}

function nextFreeName (wallets) {
  const taken = new Set(wallets.map((w) => w.name.toLowerCase()))
  for (let i = 2; ; i++) if (!taken.has(`wallet ${i}`)) return `Wallet ${i}`
}

// displayOnly: nur Anzeigename (Standard-Wallet) – kein Ordner, also keine Ordner-Regeln
function validateName (raw, { allowSameAs, displayOnly } = {}) {
  const name = String(raw == null ? '' : raw).trim()
  if (!name) throw new Error(t('nameEmpty'))
  if (name.length > 40) throw new Error(t('nameTooLong'))
  if (/[\\/:*?"<>|\x00-\x1f]/.test(name)) throw new Error(t('nameChars'))
  if (displayOnly) return name
  if (/[. ]$/.test(name)) throw new Error(t('nameTrailing'))
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i.test(name)) throw new Error(t('nameReserved'))
  // "Standard" (de) bzw. "Default" (en) ist die Anzeige der Haupt-Wallet – beides freihalten, sonst Verwechslung
  if (/^(standard|default)$/i.test(name)) throw new Error(t('nameStandard', name))
  const sameFolder = allowSameAs && allowSameAs.toLowerCase() === name.toLowerCase()
  if (!sameFolder && exists(path.join(profilesRoot(), name))) throw new Error(t('nameExists'))
  return name
}

// ---------------------------------------------------------------------------------------------
// Alte, per Umbenennen "geparkte" Wallet-Ordner (z. B. %APPDATA%\Exodus\exodus.wallet1)
// ---------------------------------------------------------------------------------------------

function knownSeedHashes () {
  const known = new Set()
  for (const w of walletDirs()) {
    const seed = path.join(w.dir, 'exodus.wallet', 'seed.seco')
    try { if (exists(seed)) known.add(sha256File(seed)) } catch (e) {}
  }
  try {
    for (const line of fs.readFileSync(path.join(profilesRoot(), IMPORT_LOG), 'utf8').split(/\r?\n/)) {
      const hash = line.split('\t')[0]
      if (/^[0-9a-f]{64}$/.test(hash)) known.add(hash)
    }
  } catch (e) {}
  return known
}

function findOldFolders () {
  let entries = []
  try { entries = fs.readdirSync(standardDir(), { withFileTypes: true }) } catch (e) { return [] }
  const known = knownSeedHashes()
  const result = []
  for (const d of entries) {
    if (!d.isDirectory() || d.name.toLowerCase() === 'exodus.wallet') continue
    const dir = path.join(standardDir(), d.name)
    const seed = path.join(dir, 'seed.seco')
    if (!exists(seed)) continue
    try {
      const hash = sha256File(seed)
      if (!known.has(hash)) result.push({ path: dir, name: d.name, hash, modified: fs.statSync(seed).mtime.toISOString() })
    } catch (e) {}
  }
  return result
}

function listFiles (dir, base = dir) {
  const out = []
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name)
    if (d.isDirectory()) out.push(...listFiles(p, base))
    else out.push(path.relative(base, p))
  }
  return out
}

function importOldFolder (folderPath, rawName) {
  const candidate = findOldFolders().find((c) => norm(c.path) === norm(String(folderPath)))
  if (!candidate) throw new Error(t('folderGone'))
  const name = validateName(rawName)
  const target = path.join(profilesRoot(), name)
  const targetWallet = path.join(target, 'exodus.wallet')
  fs.mkdirSync(profilesRoot(), { recursive: true })
  fs.mkdirSync(target)
  try {
    fs.cpSync(candidate.path, targetWallet, { recursive: true, errorOnExist: true, force: false })
    // Kopie Datei für Datei prüfen
    const files = listFiles(candidate.path)
    if (!files.length || files.length !== listFiles(targetWallet).length) throw new Error(t('copyIncomplete'))
    for (const rel of files) {
      if (sha256File(path.join(candidate.path, rel)) !== sha256File(path.join(targetWallet, rel))) {
        throw new Error(t('fileNotCopied', rel))
      }
    }
  } catch (err) {
    // nur die eben angelegte, unvollständige Kopie entfernen – das Original bleibt unberührt
    try { fs.rmSync(target, { recursive: true, force: true }) } catch (e) {}
    throw err
  }
  fs.appendFileSync(path.join(profilesRoot(), IMPORT_LOG), `${candidate.hash}\t${candidate.path}\t${name}\t${new Date().toISOString()}\n`)
  return { id: 'p:' + name, name }
}

// ---------------------------------------------------------------------------------------------
// Exodus starten
// ---------------------------------------------------------------------------------------------

// Der Squirrel-Starter (%LOCALAPPDATA%\exodus\Exodus.exe) startet immer die neueste installierte Version
function launcherPath () {
  const stub = path.resolve(path.dirname(process.execPath), '..', 'Exodus.exe')
  return exists(stub) ? stub : process.execPath
}

function launchArgs (dir) {
  return norm(dir) === norm(defaultStandardDir()) ? [] : ['--datadir', dir]
}

// Markiert Starts, die wir selbst auslösen: die Weiterleitung zur Start-Wallet (siehe unten) greift
// nur, wenn jemand Exodus "einfach so" startet – nicht, wenn die Seitenleiste gezielt Standard öffnet.
const DIRECT_ENV = 'EXODUS_WALLETS_DIRECT'

function launch (dir) {
  const env = {}
  for (const [k, v] of Object.entries(process.env)) if (!/^(ELECTRON_|CHROME_)/i.test(k)) env[k] = v
  env[DIRECT_ENV] = '1'
  const child = spawn(launcherPath(), launchArgs(dir), { detached: true, stdio: 'ignore', env })
  child.on('error', (err) => console.error(TAG, 'Start fehlgeschlagen:', err.message))
  child.unref()
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function waitUntil (check, timeoutMs) {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    if (check()) return true
    await sleep(400)
  }
  return check()
}

// ---------------------------------------------------------------------------------------------
// Start-Wallet: Exodus ohne --datadir gestartet (Desktop-Symbol, Startmenü) → an die festgelegte
// Wallet weiterreichen. Läuft beim Laden von index.js, also bevor Exodus ein Fenster öffnet.
// ---------------------------------------------------------------------------------------------

function redirectToStartWallet () {
  const args = process.argv.slice(1)
  if (process.env[DIRECT_ENV]) return false
  if (args.some((a) => /^--datadir/i.test(a) || /^--squirrel/i.test(a) || /:\/\//.test(a))) return false
  if (!isCurrent(defaultStandardDir())) return false
  const startId = readSettings().startWallet
  if (!startId || startId === 'standard') return false
  const target = walletDirs().find((w) => w.id === startId)
  if (!target || !exists(target.dir)) {
    debug(`Start-Wallet ${startId} nicht gefunden – öffne Standard`)
    return false
  }
  debug(`Start-Wallet: leite weiter zu ${target.name}`)
  launch(target.dir)
  app.exit(0)
  return true
}

// ---------------------------------------------------------------------------------------------
// Befehle zwischen den Exodus-Fenstern. Jede Wallet läuft in einem eigenen Prozess; wir legen eine
// kleine JSON-Datei in ihren Datenordner, die der dortige Prozess abholt ("schließen", "12 Wörter").
// ---------------------------------------------------------------------------------------------

const COMMAND_FILE = 'wallet-switcher-command.json'
const COMMAND_MAX_AGE_MS = 10 * 60 * 1000 // z. B. solange man beim Start noch das Passwort eingibt

function sendCommand (dir, cmd) {
  writeJson(path.join(dir, COMMAND_FILE), { cmd, at: Date.now() })
}

function focusWindows () {
  const Win = BaseWindow || BrowserWindow
  for (const win of Win.getAllWindows()) {
    if (win.isDestroyed() || !win.isVisible()) continue
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  }
}

// Exodus' eigener Bildschirm "Backup" – dort zeigt Exodus die 12 Wörter erst nach Passwort-Eingabe.
// Wir entschlüsseln bewusst nichts selbst.
const SHOW_BACKUP_JS = `(() => {
  if (!globalThis.navUtil || !globalThis.store) return false
  globalThis.navUtil.navigateTo('/settings/backup')
  return true
})()`

async function showBackupHere () {
  if (!uiContents || uiContents.isDestroyed()) return false
  try {
    const ok = await uiContents.executeJavaScript(SHOW_BACKUP_JS)
    if (ok) focusWindows()
    return !!ok
  } catch (e) {
    return false
  }
}

let commandBusy = false
async function checkCommands () {
  if (commandBusy) return
  const file = path.join(currentDir(), COMMAND_FILE)
  if (!exists(file)) return
  commandBusy = true
  try {
    const cmd = readJson(file)
    const done = () => { try { fs.unlinkSync(file) } catch (e) {} }
    if (!cmd || typeof cmd.at !== 'number' || Date.now() - cmd.at > COMMAND_MAX_AGE_MS) return done()
    if (cmd.cmd === 'quit') {
      done()
      debug('Befehl: schließen')
      app.quit()
    } else if (cmd.cmd === 'focus') {
      done()
      focusWindows()
    } else if (cmd.cmd === 'showBackup') {
      // Datei liegen lassen, bis die Oberfläche bereit ist (Passwort-Eingabe kann dauern)
      if (await showBackupHere()) done()
    } else {
      done()
    }
  } finally {
    commandBusy = false
  }
}

// ---------------------------------------------------------------------------------------------
// Umbenennen der Wallet im eigenen Fenster: der Ordner ist in Benutzung, solange dieser Prozess
// läuft. Ein kleines PowerShell-Skript wartet, bis Exodus beendet ist, benennt um und öffnet neu.
// ---------------------------------------------------------------------------------------------

const RENAME_HELPER_PS = `
$from = $env:XW_FROM; $to = $env:XW_TO; $ok = $false
try { Wait-Process -Id ([int]$env:XW_PID) -Timeout 60 -ErrorAction SilentlyContinue } catch {}
for ($i = 0; $i -lt 60; $i++) {
  try {
    if ($from.ToLower() -eq $to.ToLower()) {
      $tmp = $to + '.umbenennen'
      Move-Item -LiteralPath $from -Destination $tmp -ErrorAction Stop
      Move-Item -LiteralPath $tmp -Destination $to -ErrorAction Stop
    } else {
      Move-Item -LiteralPath $from -Destination $to -ErrorAction Stop
    }
    $ok = $true; break
  } catch { Start-Sleep -Milliseconds 500 }
}
if ($env:XW_REOPEN -eq '1') {
  $dir = if ($ok) { $to } else { $from }
  Start-Process -FilePath $env:XW_LAUNCHER -ArgumentList @('--datadir', ('"{0}"' -f $dir))
}
`

// macOS/Linux: same idea as the PowerShell helper, but as a detached shell script
const RENAME_HELPER_SH = `
i=0
while [ $i -lt 60 ]; do
  if [ ! -e "$XW_LOCK" ]; then break; fi
  i=$((i+1)); sleep 0.5
done
ok=0
i=0
while [ $i -lt 60 ]; do
  if mv "$XW_FROM" "$XW_TO" 2>/dev/null; then ok=1; break; fi
  i=$((i+1)); sleep 0.5
done
if [ "$XW_REOPEN" = "1" ]; then
  dir="$XW_FROM"; [ "$ok" = "1" ] && dir="$XW_TO"
  "$XW_LAUNCHER" --datadir "$dir" >/dev/null 2>&1 &
fi
`

function renameCurrentAfterExit (from, to, reopen) {
  const env = { ...process.env, XW_PID: String(process.pid), XW_FROM: from, XW_TO: to, XW_REOPEN: reopen ? '1' : '0', XW_LAUNCHER: launcherPath() }
  env[DIRECT_ENV] = '1'
  let child
  if (process.platform === 'win32') {
    child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', RENAME_HELPER_PS],
      { detached: true, stdio: 'ignore', env, windowsHide: true })
  } else {
    // No lockfile-wait id on posix; wait for the folder's Chromium lockfile to disappear instead
    env.XW_LOCK = path.join(from, 'lockfile')
    child = spawn('sh', ['-c', RENAME_HELPER_SH], { detached: true, stdio: 'ignore', env })
  }
  child.unref()
}

function renameFolder (from, to) {
  if (norm(from) === norm(to)) {
    const tmp = to + '.umbenennen'
    fs.renameSync(from, tmp) // nur Groß-/Kleinschreibung geändert
    fs.renameSync(tmp, to)
  } else {
    fs.renameSync(from, to)
  }
}

// ---------------------------------------------------------------------------------------------
// Kontostand- und Adress-Cache (liest über Exodus' eigene Selektoren/API in der Oberfläche)
// ---------------------------------------------------------------------------------------------

const SNAPSHOT_JS = `(() => {
  try {
    const s = globalThis.selectors, store = globalThis.store
    if (!s || !store || !s.fiatBalances) return { error: 'no-globals' }
    const st = store.getState()
    // Sprache/Währung zuerst: stehen schon fest, bevor die Kontostände geladen sind
    let language = null, currency = null
    try { language = s.locale.language(st) } catch (e) {}
    try { currency = s.locale.currency(st) } catch (e) {}
    if (language != null && typeof language !== 'string') language = String(language)
    if (currency != null && typeof currency !== 'string') currency = String(currency)
    if (typeof s.fiatBalances.loaded === 'function' && !s.fiatBalances.loaded(st)) return { error: 'not-loaded', language, currency }
    const num = (v) => {
      if (v == null) return null
      if (typeof v === 'number') return v
      for (const m of ['toDefaultNumber', 'toNumber']) {
        if (typeof v[m] === 'function') { const n = Number(v[m]()); if (isFinite(n)) return n }
      }
      const n = parseFloat(String(v.toDefaultString ? v.toDefaultString() : v).replace(/[^0-9.-]/g, ''))
      return isFinite(n) ? n : null
    }
    const byAccount = (typeof s.fiatBalances.byWalletAccount === 'function' && s.fiatBalances.byWalletAccount(st)) || {}
    let properName = null
    try { properName = s.walletAccounts.getProperName(st) } catch (e) {}
    const portfolios = Object.keys(byAccount).map((wa) => ({
      name: properName ? String(properName(wa, { maxLength: 40 })) : wa,
      value: num(byAccount[wa]),
    }))
    let total = portfolios.length ? portfolios.reduce((sum, p) => sum + (p.value || 0), 0) : null
    if (total == null) {
      const data = typeof s.fiatBalances.data === 'function' ? s.fiatBalances.data(st) : null
      total = num(data && data.totals && data.totals.balance)
    }
    // Frisch angelegte Wallet ohne Guthaben: Exodus liefert dann gar keine Portfolios – das ist 0, nicht "unbekannt"
    if (total == null && typeof s.fiatBalances.loaded === 'function') total = 0
    return { total, currency, language, portfolios }
  } catch (e) {
    return { error: String((e && e.message) || e) }
  }
})()`

// Empfangsadressen sind öffentlich; wir merken sie uns, damit man sie später kopieren kann, ohne die
// Wallet zu öffnen. Exodus' Adress-API steckt nicht in einer globalen Variable, sondern wird per
// React-Provider ("exodus"-Prop) an die Oberfläche gereicht – dort holen wir sie ab.
// Hardware-Wallet-Portfolios (Trezor/Ledger) lassen wir aus, damit kein Gerät angesprochen wird.
const ADDRESSES_JS = `(async () => {
  try {
    const s = globalThis.selectors, store = globalThis.store
    if (!s || !store) return { error: 'no-globals' }
    let ex = globalThis.__xwExodusApi
    if (!ex) {
      for (const id of ['app-container', 'exmo-container']) {
        const host = document.getElementById(id)
        if (!host) continue
        const key = Object.keys(host).find((k) => k.startsWith('__reactContainer$'))
        let start = key ? host[key] : (host._reactRootContainer && host._reactRootContainer._internalRoot && host._reactRootContainer._internalRoot.current)
        const stack = start ? [start] : []
        let seen = 0
        while (stack.length && seen < 60000 && !ex) {
          const f = stack.pop(); seen++
          const p = f && f.memoizedProps
          if (p && p.exodus && p.exodus.addressProvider && typeof p.exodus.addressProvider.getReceiveAddress === 'function') ex = p.exodus
          if (f && f.sibling) stack.push(f.sibling)
          if (f && f.child) stack.push(f.child)
        }
        if (ex) break
      }
      if (!ex) return { error: 'no-exodus-api' }
      globalThis.__xwExodusApi = ex
    }
    const st = store.getState()
    const enabled = (s.enabledAssets && typeof s.enabledAssets.data === 'function' && s.enabledAssets.data(st)) || {}
    const all = (s.assets && typeof s.assets.all === 'function' && s.assets.all(st)) || {}
    let accounts = {}
    try { accounts = (s.walletAccounts.getEnabled && s.walletAccounts.getEnabled(st)) || {} } catch (e) {}
    let names = Array.isArray(accounts) ? accounts.map(String) : Object.keys(accounts)
    // Zusätzlich alle Portfolios, für die Exodus Kontostände führt – falls getEnabled nicht alle liefert
    try {
      const byAccount = (s.fiatBalances && typeof s.fiatBalances.byWalletAccount === 'function' && s.fiatBalances.byWalletAccount(st)) || {}
      for (const n of Object.keys(byAccount)) if (!names.includes(n)) names.push(n)
    } catch (e) {}
    const lookup = (n) => { try { return Array.isArray(accounts) ? null : (accounts[n] || (s.walletAccounts.get && s.walletAccounts.get(st)[n])) } catch (e) { return null } }
    names = names.filter((n) => { const a = lookup(n); return !(a && (a.isHardware || a.source === 'ledger' || a.source === 'trezor')) })
    if (!names.length) names = ['exodus_0']
    // Reihenfolge wie in Exodus: exodus_0, exodus_1, …
    names.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
    let properName = null
    try { properName = s.walletAccounts.getProperName(st) } catch (e) {}
    const withTimeout = (p) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), 3000))])
    const out = []
    // Portfolio außen, Coin innen – so bleiben die Adressen eines Portfolios in der Liste beieinander
    for (const wa of names) {
      for (const assetName of Object.keys(enabled).filter((n) => enabled[n])) {
        const asset = all[assetName]
        if (!asset) continue
        if (out.length >= 600) break
        try {
          // Erst Exodus' Zwischenspeicher; für Portfolios, die man in Exodus noch nicht geöffnet hat, ist der
          // leer – dann die Adresse direkt ableiten lassen (öffentlicher Schlüssel, kein Gerät bei Software-Wallets)
          let addr = await withTimeout(ex.addressProvider.getReceiveAddress({ assetName, walletAccount: wa, useCache: true }))
          if (addr == null) addr = await withTimeout(ex.addressProvider.getReceiveAddress({ assetName, walletAccount: wa }))
          let text = addr == null ? null : (typeof addr === 'string' ? addr : (addr.address || (typeof addr.toString === 'function' ? addr.toString() : null)))
          if (!text || /^\\[object/.test(text)) continue
          out.push({
            asset: assetName,
            ticker: String(asset.displayTicker || asset.ticker || assetName),
            label: String(asset.displayName || asset.name || assetName),
            account: wa,
            portfolio: properName ? String(properName(wa, { maxLength: 40 })) : wa,
            address: String(text),
          })
        } catch (e) {}
      }
    }
    return { addresses: out }
  } catch (e) {
    return { error: String((e && e.message) || e) }
  }
})()`

const ADDRESSES_EVERY_MS = 5 * 60 * 1000

// Coin-Icons liefert Exodus selbst mit: src/res/deps/img/<asset>-<hash>.svg (z. B. bitcoin-c53be7.svg,
// ach_ethereum_fbad19a6-02bb85.svg). Manche Coins haben zusätzlich ein kleines 18×18-Symbol unter
// demselben Namen – wir nehmen das große 40×40-Sechseck, das Exodus in Listen zeigt.
const ICON_DIR = ['src', 'res', 'deps', 'img']
let iconIndex = null
function loadIconIndex () {
  iconIndex = new Map()
  const dir = path.join(app.getAppPath(), ...ICON_DIR)
  let files = []
  try { files = fs.readdirSync(dir) } catch (e) { debug('Coin-Icons nicht gefunden: ' + e.message); return iconIndex }
  for (const file of files) {
    const m = file.match(/^(.+)-[0-9a-f]{6}\.svg$/i)
    if (!m || /-sign$/i.test(m[1])) continue
    const name = m[1].toLowerCase()
    const prev = iconIndex.get(name)
    if (!prev) { iconIndex.set(name, file); continue }
    try {
      if (/viewBox="0 0 40 40"/.test(fs.readFileSync(path.join(dir, file), 'utf8').slice(0, 300))) iconIndex.set(name, file)
    } catch (e) {}
  }
  return iconIndex
}

// Relativ zu src/static/exodus-prod.html – so lädt die Seitenleiste das Bild direkt aus Exodus
function iconFor (assetName) {
  const index = iconIndex || loadIconIndex()
  const name = String(assetName || '').toLowerCase()
  const file = index.get(name) || index.get(name.split('_')[0]) // Token auf anderer Chain → Icon des Coins
  return file ? '../res/deps/img/' + file : null
}

function updateCache (patch) {
  const file = path.join(currentDir(), CACHE_FILE)
  const next = { ...(readJson(file) || {}), ...patch }
  try { writeJson(file, next) } catch (e) { console.error(TAG, 'Cache nicht gespeichert:', e.message) }
  return next
}

// Exodus-Einstellungen dieses Fensters; gehen mit jedem state() an die Seitenleiste
let uiCurrency = null
function rememberLocale (res) {
  if (!res) return
  if (typeof res.language === 'string' && res.language && res.language !== uiLanguage) {
    uiLanguage = res.language
    debug(`Exodus-Sprache: ${uiLanguage}`)
  }
  if (typeof res.currency === 'string' && res.currency) uiCurrency = res.currency
}

// Ergebnis nur loggen, wenn es sich ändert – sonst schreibt jedes Fenster alle 20 s eine Zeile
const lastStatus = {}
function logStatus (kind, status) {
  if (lastStatus[kind] === status) return
  lastStatus[kind] = status
  debug(`${kind} (${currentWalletLabel()}): ${status}`)
}

async function runInUi (wc, code, timeoutMs) {
  const timeout = new Promise((resolve) => setTimeout(() => resolve({ error: 'timeout' }), timeoutMs))
  try {
    return await Promise.race([wc.executeJavaScript(code), timeout])
  } catch (e) {
    return { error: 'executeJavaScript fehlgeschlagen: ' + e.message }
  }
}

async function snapshotBalance (wc) {
  if (!wc || wc.isDestroyed()) return null
  const res = await runInUi(wc, SNAPSHOT_JS, 4000)
  rememberLocale(res)
  if (!res || res.error || typeof res.total !== 'number' || !isFinite(res.total)) {
    logStatus('Kontostand-Snapshot', 'kein Wert – ' + ((res && res.error) || 'total fehlt'))
    return null
  }
  logStatus('Kontostand-Snapshot', 'ok')
  return updateCache({
    total: res.total,
    currency: res.currency || null,
    portfolios: Array.isArray(res.portfolios) ? res.portfolios.slice(0, 50) : [],
    updatedAt: new Date().toISOString(),
  })
}

let lastAddressesAt = 0
async function snapshotAddresses (wc, force) {
  if (!wc || wc.isDestroyed()) return
  if (!force && Date.now() - lastAddressesAt < ADDRESSES_EVERY_MS) return
  const res = await runInUi(wc, ADDRESSES_JS, 90000)
  if (!res || res.error || !Array.isArray(res.addresses)) {
    logStatus('Adressen', 'keine – ' + ((res && res.error) || 'leer'))
    return
  }
  lastAddressesAt = Date.now()
  const perPortfolio = {}
  for (const a of res.addresses) perPortfolio[a.portfolio || a.account] = (perPortfolio[a.portfolio || a.account] || 0) + 1
  logStatus('Adressen', `ok (${res.addresses.length}) – ` + (Object.entries(perPortfolio).map(([p, n]) => `${p}: ${n}`).join(', ') || 'keine Portfolios'))
  if (res.addresses.length) updateCache({ addresses: res.addresses, addressesAt: new Date().toISOString() })
}

let uiContents = null
let snapshotTimer = null
function rememberUi (wc) {
  if (uiContents === wc) return
  uiContents = wc
  debug(`Exodus-Oberfläche erkannt – Kontostand wird alle ${SNAPSHOT_EVERY_MS / 1000} s gespeichert`)
  wc.once('destroyed', () => { if (uiContents === wc) uiContents = null })
  if (!snapshotTimer) {
    snapshotTimer = setInterval(async () => {
      if (!uiContents || uiContents.isDestroyed()) return
      const ok = await snapshotBalance(uiContents)
      if (ok) snapshotAddresses(uiContents, false)
    }, SNAPSHOT_EVERY_MS)
  }
  snapshotBalance(wc)
}

// ---------------------------------------------------------------------------------------------
// Einstellungen (gelten für alle Wallets)
// ---------------------------------------------------------------------------------------------

function readSettings () {
  return { hideBalances: false, startWallet: 'standard', standardName: null, ...(readJson(path.join(profilesRoot(), SETTINGS_FILE)) || {}) }
}

function writeSettings (patch) {
  const next = { ...readSettings(), ...patch }
  fs.mkdirSync(profilesRoot(), { recursive: true })
  writeJson(path.join(profilesRoot(), SETTINGS_FILE), next)
  return next
}

function buildState () {
  const settings = readSettings()
  const wallets = walletDirs().map(describe)
  const startExists = wallets.some((w) => w.id === settings.startWallet)
  for (const w of wallets) w.isStart = startExists ? w.id === settings.startWallet : w.isStandard
  return {
    version: VERSION,
    wallets,
    oldFolders: findOldFolders().map(({ path: p, name, modified }) => ({ path: p, name, modified })),
    settings,
    nextName: nextFreeName(wallets),
    locale: { language: uiLanguage, currency: uiCurrency },
    platform: process.platform,
  }
}

// ---------------------------------------------------------------------------------------------
// Aktionen der Seitenleiste
// ---------------------------------------------------------------------------------------------

async function closeOtherWallet (w) {
  if (isCurrent(w.dir)) throw new Error(t('cannotCloseCurrent'))
  if (!isRunning(w.dir)) return
  sendCommand(w.dir, 'quit')
  const lock = path.join(w.dir, 'lockfile')
  if (!(await waitUntil(() => !exists(lock), 30000))) throw new Error(t('closeTimeout'))
  await sleep(800) // Nebenprozesse (GPU, Renderer) geben ihre Dateien kurz nach dem Hauptprozess frei
}

const api = {
  async state (event) {
    await snapshotBalance(event.sender)
    return buildState()
  },

  async open (event, id, options) {
    const switchTo = !!(options && options.switchTo)
    const w = findWallet(id)
    if (isCurrent(w.dir)) return { alreadyHere: true }
    // Wiederherstellung wurde abgebrochen? Dann wieder direkt mit der 12-Wörter-Eingabe starten.
    if (!hasWallet(w.dir) && exists(path.join(w.dir, RESTORE_MARKER))) fs.writeFileSync(path.join(w.dir, RESTORE_FLAG), '')
    const wasRunning = isRunning(w.dir)
    launch(w.dir)
    if (switchTo) setTimeout(() => app.quit(), 1500)
    return { launched: true, wasRunning }
  },

  async close (event, id) {
    await closeOtherWallet(findWallet(id))
    return true
  },

  async create (event, rawName, options) {
    const restore = !!(options && options.restore)
    const name = validateName(rawName)
    const dir = path.join(profilesRoot(), name)
    fs.mkdirSync(profilesRoot(), { recursive: true })
    fs.mkdirSync(dir)
    if (restore) {
      fs.writeFileSync(path.join(dir, RESTORE_MARKER), '')
      fs.writeFileSync(path.join(dir, RESTORE_FLAG), '')
    }
    launch(dir)
    return { id: 'p:' + name, name }
  },

  // options.close: offene Wallet dafür schließen; options.reopen: danach wieder öffnen
  async rename (event, id, rawName, options) {
    const close = !!(options && options.close)
    const reopen = !!(options && options.reopen)
    const w = findWallet(id)
    if (w.external) throw new Error(t('cannotRename'))

    // Der Standard-Ordner (%APPDATA%\Exodus) bleibt, wo er ist – umbenannt wird nur die Anzeige
    if (w.isStandard) {
      const raw = String(rawName == null ? '' : rawName).trim()
      const name = raw ? validateName(raw, { displayOnly: true }) : null
      writeSettings({ standardName: name })
      return { id: w.id, name: standardLabel() }
    }

    const name = validateName(rawName, { allowSameAs: w.name })
    if (name === w.name) return { id: w.id, name }
    const target = path.join(profilesRoot(), name)
    const newId = 'p:' + name
    const settings = readSettings()
    const keepStart = () => { if (settings.startWallet === w.id) writeSettings({ startWallet: newId }) }

    if (isCurrent(w.dir)) {
      if (!close) throw new Error(t('renameRunning'))
      keepStart()
      renameCurrentAfterExit(w.dir, target, reopen)
      setTimeout(() => app.quit(), 300)
      return { id: newId, name, closing: true }
    }
    if (isRunning(w.dir)) {
      if (!close) throw new Error(t('renameRunning'))
      await closeOtherWallet(w)
    }
    renameFolder(w.dir, target)
    keepStart()
    if (reopen) launch(target)
    return { id: newId, name }
  },

  // Nur in den Papierkorb – ein endgültiges Löschen gibt es bewusst nicht. Ohne 12 Wörter wäre das Geld weg.
  async remove (event, id, confirmName, options) {
    const close = !!(options && options.close)
    const w = findWallet(id)
    if (w.isStandard || w.external) throw new Error(t('cannotDelete'))
    if (isCurrent(w.dir)) throw new Error(t('deleteCurrent'))
    if (String(confirmName == null ? '' : confirmName).trim() !== w.name) throw new Error(t('deleteConfirm'))
    if (isRunning(w.dir)) {
      if (!close) throw new Error(t('deleteRunning'))
      await closeOtherWallet(w)
    }
    try {
      await shell.trashItem(w.dir)
    } catch (e) {
      throw new Error(t('trashFailed', (e && e.message) || String(e)))
    }
    debug(`Wallet in den Papierkorb verschoben: ${w.name}`)
    if (readSettings().startWallet === w.id) writeSettings({ startWallet: 'standard' })
    return { name: w.name }
  },

  async setStart (event, id) {
    const w = findWallet(id)
    if (w.external) throw new Error(t('cannotStart'))
    writeSettings({ startWallet: w.id })
    return true
  },

  async showBackup (event, id) {
    const w = findWallet(id)
    if (isCurrent(w.dir)) {
      if (!(await showBackupHere())) throw new Error(t('notReady'))
      return { here: true }
    }
    const running = isRunning(w.dir)
    sendCommand(w.dir, 'showBackup')
    if (!running) launch(w.dir)
    return { launched: !running }
  },

  async addresses (event, id) {
    const w = findWallet(id)
    // Für das eigene Fenster frisch holen – z. B. direkt nachdem ein Coin aktiviert wurde
    if (isCurrent(w.dir) && uiContents) await snapshotAddresses(uiContents, true)
    const cache = readJson(path.join(w.dir, CACHE_FILE)) || {}
    const addresses = (Array.isArray(cache.addresses) ? cache.addresses : []).map((a) => ({ ...a, icon: iconFor(a.asset) }))
    // Alle Portfolios, die Exodus für diese Wallet kennt (aus dem Kontostand) – auch die ohne gespeicherte Adressen
    const portfolioNames = (Array.isArray(cache.portfolios) ? cache.portfolios : []).map((p) => String(p.name))
    return { addresses, portfolioNames, updatedAt: cache.addressesAt || null }
  },

  async copyAddress (event, id, asset, account) {
    const w = findWallet(id)
    const cache = readJson(path.join(w.dir, CACHE_FILE)) || {}
    const hit = (Array.isArray(cache.addresses) ? cache.addresses : []).find((a) => a.asset === asset && a.account === account)
    if (!hit) throw new Error(t('addressGone'))
    clipboard.writeText(hit.address)
    return { ticker: hit.ticker, address: hit.address }
  },

  async pickAvatar (event, id) {
    const w = findWallet(id)
    const options = {
      title: t('avatarPick'),
      properties: ['openFile'],
      filters: [{ name: t('images'), extensions: ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp'] }],
    }
    const parent = BaseWindow && typeof BaseWindow.getFocusedWindow === 'function' ? BaseWindow.getFocusedWindow() : null
    const res = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
    if (res.canceled || !res.filePaths.length) return { canceled: true }
    const file = res.filePaths[0]
    if (fs.statSync(file).size > 15 * 1024 * 1024) throw new Error(t('avatarTooLarge'))
    let img = nativeImage.createFromPath(file)
    if (img.isEmpty()) throw new Error(t('avatarInvalid'))
    // Mittig quadratisch zuschneiden, dann verkleinern – rund dargestellt wird es in der Seitenleiste
    const { width, height } = img.getSize()
    const side = Math.min(width, height)
    img = img.crop({ x: Math.floor((width - side) / 2), y: Math.floor((height - side) / 2), width: side, height: side })
    if (side > AVATAR_SIZE) img = img.resize({ width: AVATAR_SIZE, height: AVATAR_SIZE, quality: 'best' })
    fs.writeFileSync(path.join(w.dir, AVATAR_FILE), img.toPNG())
    return { canceled: false }
  },

  async resetAvatar (event, id) {
    const w = findWallet(id)
    try { fs.unlinkSync(path.join(w.dir, AVATAR_FILE)) } catch (e) {}
    return true
  },

  async showFolder (event, id) {
    const w = findWallet(id)
    const err = await shell.openPath(w.dir)
    if (err) throw new Error(err)
    return true
  },

  async shortcut (event, id) {
    // Desktop shortcuts use the Windows .lnk API; on macOS/Linux this is not available
    if (process.platform !== 'win32' || typeof shell.writeShortcutLink !== 'function') throw new Error(t('shortcutWinOnly'))
    const w = findWallet(id)
    const label = w.isStandard ? standardLabel() : w.name
    const file = path.join(app.getPath('desktop'), `Exodus - ${label.replace(/[\\/:*?"<>|]/g, '_')}.lnk`)
    const target = launcherPath()
    const icon = path.join(path.dirname(target), 'app.ico')
    // Auch für Standard ausdrücklich --datadir: sonst würde die Verknüpfung zur Start-Wallet umgeleitet
    const ok = shell.writeShortcutLink(file, 'create', {
      target,
      args: ['--datadir', w.dir].map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' '),
      cwd: path.dirname(target),
      description: t('shortcutDescription', label),
      icon: exists(icon) ? icon : target,
      iconIndex: 0,
    })
    if (!ok) throw new Error(t('shortcutFailed'))
    return { file: path.basename(file) }
  },

  async importOld (event, folderPath, rawName) {
    return importOldFolder(folderPath, rawName)
  },

  async settings (event, patch) {
    const next = {}
    if (patch && typeof patch.hideBalances === 'boolean') next.hideBalances = patch.hideBalances
    return writeSettings(next)
  },
}

// ---------------------------------------------------------------------------------------------
// Fenstertitel: "Exodus 26.8.27 – <Wallet-Name>", damit man die Fenster in Taskleiste und Alt+Tab
// unterscheidet. Das Exodus-Hauptfenster ist ein BaseWindow (kein BrowserWindow), daher gibt es kein
// "browser-window-created" – wir prüfen die Titel regelmäßig und hängen den Namen an.
// ---------------------------------------------------------------------------------------------

// Die Wallet dieses Fensters ändert sich nicht, solange es läuft – einmal ermitteln genügt.
let currentWallet
function currentWalletLabel () {
  if (currentWallet === undefined) currentWallet = walletDirs().find((x) => isCurrent(x.dir)) || null
  if (!currentWallet) return path.basename(currentDir())
  return currentWallet.isStandard ? standardLabel() : currentWallet.name
}

const appliedSuffix = new WeakMap()
function refreshWindowTitles () {
  const Win = BaseWindow || BrowserWindow
  const suffix = ' – ' + currentWalletLabel()
  for (const win of Win.getAllWindows()) {
    if (win.isDestroyed()) continue
    const title = win.getTitle()
    if (appliedSuffix.get(win) === suffix && title.endsWith(suffix)) continue
    const old = appliedSuffix.get(win)
    const base = old && title.endsWith(old) ? title.slice(0, -old.length) : title
    win.setTitle((base.trim() || 'Exodus') + suffix)
    appliedSuffix.set(win, suffix)
  }
}

// ---------------------------------------------------------------------------------------------
// Anbindung an Exodus
// ---------------------------------------------------------------------------------------------

// Die Exodus-Oberfläche läuft in der Session "persist:main" (Ordner <Datenordner>\Partitions\main)
function isMainSession (ses) {
  try {
    const p = ses && ses.storagePath
    return !!p && path.basename(p).toLowerCase() === 'main' && path.basename(path.dirname(p)).toLowerCase() === 'partitions'
  } catch (e) {
    return false
  }
}

// Nur die Exodus-Oberfläche selbst (Hauptframe von exodus-prod.html) darf die Aktionen aufrufen
function isUiUrl (href) {
  try {
    const url = new URL(href)
    return url.protocol === 'file:' && /\/src\/static\/exodus-prod\.html$/i.test(decodeURIComponent(url.pathname))
  } catch (e) {
    return false
  }
}

function isTrustedSender (event) {
  try {
    const frame = event.senderFrame
    if (!frame || frame.parent) return false
    return isUiUrl(frame.url) && isMainSession(event.sender.session)
  } catch (e) {
    return false
  }
}

// Kontostand speichern, sobald die Exodus-Oberfläche geladen ist – unabhängig davon, ob jemand die
// Seitenleiste öffnet. Sonst sehen andere Fenster diese Wallet nie mit aktuellem Stand.
function watchUi (wc) {
  if (!wc || !isMainSession(wc.session)) return
  wc.on('did-finish-load', () => {
    try { if (isUiUrl(wc.getURL())) rememberUi(wc) } catch (e) { debug('watchUi-Fehler: ' + e.message) }
  })
}

const registered = new WeakSet()
function registerPreload (ses) {
  debug(`registerPreload aufgerufen, ses=${!!ses}, isMainSession=${isMainSession(ses)}`)
  if (!ses || registered.has(ses) || !isMainSession(ses)) {
    debug(`registerPreload abgebrochen: ses=${!!ses}, already=${registered.has(ses)}, isMain=${isMainSession(ses)}`)
    return
  }
  registered.add(ses)
  debug(`PRELOAD Pfad: ${PRELOAD}`)
  debug(`PRELOAD existiert: ${fs.existsSync(PRELOAD)}`)
  if (typeof ses.registerPreloadScript === 'function') {
    ses.registerPreloadScript({ type: 'frame', filePath: PRELOAD })
    debug('registerPreloadScript() verwendet')
  } else {
    ses.setPreloads([...ses.getPreloads(), PRELOAD])
    debug('setPreloads() verwendet')
  }
  debug(`Wallet-Seitenleiste aktiv (v${VERSION})`)
}

try {
  if (!redirectToStartWallet()) {
    debug('Event-Handler werden registriert...')
    app.on('session-created', (ses) => {
      debug('session-created Event')
      try { registerPreload(ses) } catch (e) { debug('Fehler: ' + e.message) }
    })
    app.on('web-contents-created', (_event, wc) => {
      debug('web-contents-created Event')
      try { registerPreload(wc.session) } catch (e) { debug('Fehler: ' + e.message) }
      try { watchUi(wc) } catch (e) { debug('Fehler: ' + e.message) }
    })
    app.whenReady().then(() => {
      setInterval(() => { try { refreshWindowTitles() } catch (e) { debug('Fenstertitel-Fehler: ' + e.message) } }, 1500)
      setInterval(() => { checkCommands().catch((e) => debug('Befehl-Fehler: ' + e.message)) }, 1000)
    })
    debug('Event-Handler registriert')

    for (const [name, fn] of Object.entries(api)) {
      ipcMain.handle('exodus-wallets:' + name, async (event, ...args) => {
        if (!isTrustedSender(event)) return { ok: false, error: t('notAllowed') }
        rememberUi(event.sender)
        try {
          return { ok: true, result: await fn(event, ...args) }
        } catch (err) {
          return { ok: false, error: String((err && err.message) || err) }
        }
      })
    }
  }
} catch (e) {
  console.error(TAG, 'Seitenleiste konnte nicht geladen werden:', e)
}

module.exports = { VERSION, _test: { api, buildState, snapshotBalance } }
