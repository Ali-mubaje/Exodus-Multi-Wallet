'use strict'
/*
 * Exodus wallet sidebar – main process
 * ------------------------------------------
 * Loaded via a single appended line at the end of src/app/main/index.js (see install.js).
 *
 * Manages several separate Exodus wallets (each with its own 12-word phrase), each in its
 * own data folder. Exodus is launched for this with its official --datadir parameter.
 *
 *  - does NOT access seeds, passwords or private keys
 *  - does NOT open any network connections
 *  - only reads the fiat balances via Exodus' own selectors and stores them as a cache
 *    in each wallet's data folder (wallet-switcher-cache.json)
 *  - detects incoming payments from rising coin amounts and reports them to the currently focused window
 */

// BaseWindow exists only from Electron 30 on – Exodus uses it for its main window
const { app, BaseWindow, BrowserWindow, clipboard, dialog, ipcMain, nativeImage, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const { spawn } = require('child_process')

const VERSION = '1.0.2'
const TAG = '[exodus-wallets]'
const PRELOAD = path.join(__dirname, 'preload.js')

// Write the debug log to a file (since DevTools may be disabled)
const DEBUG_LOG = path.join(app.getPath('desktop'), 'exodus-wallets-debug.log')
const debug = (msg) => {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  try { fs.appendFileSync(DEBUG_LOG, line) } catch (e) {}
  console.log(TAG, msg)
}
debug('=== main.js loaded ===')

// Receive debug messages from preload.js
ipcMain.on('exodus-wallets:debug', (event, msg) => {
  debug(`[preload] ${msg}`)
})
const CACHE_FILE = 'wallet-switcher-cache.json'
const RESTORE_MARKER = 'wallet-switcher-restore' // our reminder: wallet should be set up via 12 words
const RESTORE_FLAG = 'restore-mnemonic' // Exodus' own marker: starts directly with "enter 12 words"
const SETTINGS_FILE = 'settings.json'
const IMPORT_LOG = 'imported.log'
// Up to v1.0.2 these two files had German names – they are renamed automatically on first use
const OLD_FILE_NAMES = { [SETTINGS_FILE]: 'einstellungen.json', [IMPORT_LOG]: 'importiert.log' }
function globalFile (name) {
  const file = path.join(profilesRoot(), name)
  const old = OLD_FILE_NAMES[name] ? path.join(profilesRoot(), OLD_FILE_NAMES[name]) : null
  if (old && !exists(file) && exists(old)) {
    try { fs.renameSync(old, file) } catch (e) {}
  }
  return file
}
// Short enough that other open windows see the state promptly; the snapshot itself costs < 1 ms
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
// Is an Exodus currently running in this data folder? Windows: Chromium keeps a "lockfile" open there (deleted on
// exit). macOS/Linux: Exodus' single-instance lock is the symlink "SingletonLock" → "<machine>-<PID>";
// after a crash it can be left behind, so we check whether the process is still alive.
function lockAlive (dir) {
  if (exists(path.join(dir, 'lockfile'))) return true
  let target
  try { target = fs.readlinkSync(path.join(dir, 'SingletonLock')) } catch (e) { return false }
  const pid = Number(String(target).split('-').pop())
  if (!pid) return true
  try { process.kill(pid, 0); return true } catch (e) { return e.code === 'EPERM' }
}
const isRunning = (dir) => isCurrent(dir) || lockAlive(dir)
const hasWallet = (dir) => exists(path.join(dir, 'exodus.wallet', 'seed.seco'))

// ---------------------------------------------------------------------------------------------
// Language: follows Exodus' own setting (selectors.locale.language, default "en").
// Read from the UI during the balance snapshot; unknown languages fall back to English.
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
// The default wallet can be given its own display name (its folder stays %APPDATA%\Exodus)
const standardLabel = () => readSettings().standardName || t('standard')

// ---------------------------------------------------------------------------------------------
// List wallets
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
  // Started with a foreign --datadir? Then still show it as the "current wallet".
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
    try { fs.unlinkSync(path.join(w.dir, RESTORE_MARKER)) } catch (e) {} // restoration is done
  }
  const running = isRunning(w.dir)
  // Heartbeat of the running instance: hidden in the background? How far along is Exodus?
  const live = running ? (isCurrent(w.dir) ? { hidden: hiddenMode, ...liveStatus } : readLive(w.dir)) : null
  const setup = readJson(path.join(w.dir, SETUP_FILE))
  return {
    id: w.id,
    name: w.name,
    label: w.isStandard ? standardLabel() : w.name,
    isStandard: w.isStandard,
    external: !!w.external,
    isCurrent: isCurrent(w.dir),
    running,
    background: !!(live && live.hidden),
    status: live ? { state: live.state, left: live.left || 0 } : null,
    setup: setup ? { kind: setup.kind || null, since: setup.since || null } : null,
    hasWallet: walletExists,
    restorePending: !walletExists && exists(path.join(w.dir, RESTORE_MARKER)),
    lastUsed: lastUsed(w.dir),
    cache: summarizeCache(readJson(path.join(w.dir, CACHE_FILE))),
    avatar: avatarFor(w.dir),
  }
}

// Custom wallet picture: stored as a small PNG in the wallet's data folder (moves along on rename).
// The sidebar receives it as a data: URL – Exodus' CSP only allows images from 'self' and data:.
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

// The sidebar fetches the address list only on demand (api.addresses) – for the status the count is enough
function summarizeCache (cache) {
  if (!cache) return null
  const { addresses, ...rest } = cache
  return { ...rest, addressCount: Array.isArray(addresses) ? addresses.length : 0 }
}

function nextFreeName (wallets) {
  const taken = new Set(wallets.map((w) => w.name.toLowerCase()))
  for (let i = 2; ; i++) if (!taken.has(`wallet ${i}`)) return `Wallet ${i}`
}

// displayOnly: display name only (default wallet) – no folder, so no folder rules
function validateName (raw, { allowSameAs, displayOnly } = {}) {
  const name = String(raw == null ? '' : raw).trim()
  if (!name) throw new Error(t('nameEmpty'))
  if (name.length > 40) throw new Error(t('nameTooLong'))
  if (/[\\/:*?"<>|\x00-\x1f]/.test(name)) throw new Error(t('nameChars'))
  if (displayOnly) return name
  if (/[. ]$/.test(name)) throw new Error(t('nameTrailing'))
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i.test(name)) throw new Error(t('nameReserved'))
  // "Standard" (de) and "Default" (en) are the display name of the main wallet – keep both free, otherwise confusion
  if (/^(standard|default)$/i.test(name)) throw new Error(t('nameStandard', name))
  const sameFolder = allowSameAs && allowSameAs.toLowerCase() === name.toLowerCase()
  if (!sameFolder && exists(path.join(profilesRoot(), name))) throw new Error(t('nameExists'))
  return name
}

// ---------------------------------------------------------------------------------------------
// Old wallet folders "parked" by renaming (e.g. %APPDATA%\Exodus\exodus.wallet1)
// ---------------------------------------------------------------------------------------------

function knownSeedHashes () {
  const known = new Set()
  for (const w of walletDirs()) {
    const seed = path.join(w.dir, 'exodus.wallet', 'seed.seco')
    try { if (exists(seed)) known.add(sha256File(seed)) } catch (e) {}
  }
  try {
    for (const line of fs.readFileSync(globalFile(IMPORT_LOG), 'utf8').split(/\r?\n/)) {
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
    // Verify the copy file by file
    const files = listFiles(candidate.path)
    if (!files.length || files.length !== listFiles(targetWallet).length) throw new Error(t('copyIncomplete'))
    for (const rel of files) {
      if (sha256File(path.join(candidate.path, rel)) !== sha256File(path.join(targetWallet, rel))) {
        throw new Error(t('fileNotCopied', rel))
      }
    }
  } catch (err) {
    // only remove the incomplete copy just created – the original stays untouched
    try { fs.rmSync(target, { recursive: true, force: true }) } catch (e) {}
    throw err
  }
  fs.appendFileSync(globalFile(IMPORT_LOG), `${candidate.hash}\t${candidate.path}\t${name}\t${new Date().toISOString()}\n`)
  markSetup(target, 'import')
  return { id: 'p:' + name, name }
}

// ---------------------------------------------------------------------------------------------
// Launch Exodus
// ---------------------------------------------------------------------------------------------

// The Squirrel launcher (%LOCALAPPDATA%\exodus\Exodus.exe) always starts the latest installed version
function launcherPath () {
  const stub = path.resolve(path.dirname(process.execPath), '..', 'Exodus.exe')
  return exists(stub) ? stub : process.execPath
}

function launchArgs (dir) {
  return norm(dir) === norm(defaultStandardDir()) ? [] : ['--datadir', dir]
}

// Marks launches that we trigger ourselves: the redirect to the start wallet (see below) only kicks
// in when someone starts Exodus "just like that" – not when the sidebar deliberately opens Default.
const DIRECT_ENV = 'EXODUS_WALLETS_DIRECT'
// Start as an invisible background instance (see "background sync"). Remove it from the
// environment right away so launches from within this process (e.g. Exodus update) don't inherit it.
const HIDDEN_ENV = 'EXODUS_WALLETS_HIDDEN'
const startedHidden = process.env[HIDDEN_ENV] === '1'
delete process.env[HIDDEN_ENV]

function launch (dir, { hidden = false } = {}) {
  const env = {}
  for (const [k, v] of Object.entries(process.env)) if (!/^(ELECTRON_|CHROME_)/i.test(k)) env[k] = v
  env[DIRECT_ENV] = '1'
  if (hidden) env[HIDDEN_ENV] = '1'
  const child = spawn(launcherPath(), launchArgs(dir), { detached: true, stdio: 'ignore', env })
  child.on('error', (err) => console.error(TAG, 'Launch failed:', err.message))
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
// Start wallet: Exodus started without --datadir (desktop icon, start menu) → hand off to the
// configured wallet. Runs while index.js is loading, i.e. before Exodus opens a window.
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
    debug(`Start wallet ${startId} not found – opening Default`)
    return false
  }
  debug(`Start wallet: redirecting to ${target.name}`)
  launch(target.dir)
  app.exit(0)
  return true
}

// ---------------------------------------------------------------------------------------------
// Commands between the Exodus windows. Each wallet runs in its own process; we drop a
// small JSON file into its data folder that the process there picks up ("close", "12 words").
// ---------------------------------------------------------------------------------------------

const COMMAND_FILE = 'wallet-switcher-command.json'
const COMMAND_MAX_AGE_MS = 10 * 60 * 1000 // e.g. while the password is still being entered at startup

function sendCommand (dir, cmd) {
  writeJson(path.join(dir, COMMAND_FILE), { cmd, at: Date.now() })
}

function focusWindows () {
  if (hiddenMode) return revealWindows()
  const Win = BaseWindow || BrowserWindow
  for (const win of Win.getAllWindows()) {
    if (win.isDestroyed() || !win.isVisible()) continue
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  }
  if (process.platform === 'darwin') app.focus({ steal: true })
}

// Exodus' own "Backup" screen – there Exodus shows the 12 words only after the password is entered.
// We deliberately don't decrypt anything ourselves.
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
      debug('Command: close')
      app.quit()
    } else if (cmd.cmd === 'focus') {
      done()
      focusWindows()
    } else if (cmd.cmd === 'hide') {
      done()
      hideToBackground()
    } else if (cmd.cmd === 'showBackup') {
      // leave the file until the UI is ready (entering the password can take a while)
      if (await showBackupHere()) done()
    } else {
      done()
    }
  } finally {
    commandBusy = false
  }
}

// ---------------------------------------------------------------------------------------------
// Background sync: as long as any Exodus window is open, all other wallets run along
// as invisible Exodus instances. Exodus syncs there quite normally (in its own, already
// hidden "Wallet Process"), and we detect incoming payments and store balances – without a window.
// Whoever opens a background wallet simply gets to see its window.
// ---------------------------------------------------------------------------------------------

const LIVE_FILE = 'wallet-switcher-live.json' // heartbeat: visible/hidden, sync progress
const LIVE_FRESH_MS = 25 * 1000
const PAUSE_FILE = 'wallet-switcher-pause' // just closed/renamed/deleted: don't restart
const PAUSE_MS = 2 * 60 * 1000
const BG_CLAIM_FILE = 'wallet-switcher-bgstart' // who last started the wallet in the background
const BG_EVERY_MS = 20 * 1000
const BG_RETRY_MS = 90 * 1000

let hiddenMode = false
let booting = false // hidden start: Exodus' UI has not finished starting yet
let bypass = false // our own window calls pass straight through the wrappers below
const suppressed = new Map() // windows Exodus wanted to show while we're hidden → {maximize, fullScreen}
const ghosts = new Set() // windows shown fully transparent while Exodus' UI starts (see below)
let ghostSince = 0
const GHOST_MAX_MS = 2 * 60 * 1000
const SHOW_METHODS = ['show', 'showInactive', 'focus', 'restore', 'maximize', 'setFullScreen']

// Exodus shows its windows itself (show()/maximize() after loading). In hidden mode we intercept exactly
// these calls and remember them – on opening we replay them.
// Chromium does not render a hidden window at all (no animation frames, document "hidden"), and Exodus'
// UI only finishes starting once it has rendered – a window that is simply never shown stays stuck on an
// empty page. So while the UI starts, the main window is shown as a "ghost": fully transparent,
// click-through, not in the taskbar and on top (so no other window covers it). Once Exodus has loaded,
// it is hidden for real (endGhosts, from tick()). Other windows (e.g. Exodus' unlock window) stay hidden.
const isMainWindow = (win) => !(BrowserWindow && BaseWindow && BrowserWindow !== BaseWindow && win instanceof BrowserWindow)
function patchShowMethods () {
  for (const Cls of [BaseWindow, BrowserWindow]) {
    if (!Cls || !Cls.prototype) continue
    for (const m of [...SHOW_METHODS, 'hide']) {
      const orig = Cls.prototype[m]
      if (typeof orig !== 'function' || orig.__xw) continue
      const wrapped = function (...args) {
        if (!hiddenMode || bypass) return orig.apply(this, args)
        // Exodus hides a window itself (e.g. the unlock window after unlocking): forget the show intent
        if (m === 'hide') { suppressed.delete(this); return orig.apply(this, args) }
        if (m === 'setFullScreen' && !args[0]) return orig.apply(this, args)
        const intent = suppressed.get(this) || {}
        if (m === 'maximize') intent.maximize = true
        if (m === 'setFullScreen') intent.fullScreen = true
        suppressed.set(this, intent)
        if (booting && isMainWindow(this)) ghostShow(this)
        return undefined
      }
      wrapped.__xw = true
      Cls.prototype[m] = wrapped
    }
  }
}

// Window calls of our own, past the wrappers
function own (fn) {
  bypass = true
  try { return fn() } finally { bypass = false }
}

function setGhostLook (win, on) {
  const tryIt = (f) => { try { f() } catch (e) {} }
  tryIt(() => win.setOpacity(on ? 0 : 1))
  tryIt(() => win.setIgnoreMouseEvents(on))
  tryIt(() => win.setSkipTaskbar(on))
  tryIt(() => (on ? win.setAlwaysOnTop(true, 'screen-saver') : win.setAlwaysOnTop(false)))
}

function ghostShow (win) {
  if (ghosts.has(win) || win.isDestroyed()) return
  ghosts.add(win)
  if (!ghostSince) ghostSince = Date.now()
  own(() => {
    setGhostLook(win, true)
    win.showInactive()
  })
}

// Exodus has started (or it takes too long / waits for a password): hide the ghost windows for real
function endGhosts (why) {
  booting = false
  if (!ghosts.size) return
  own(() => {
    for (const win of ghosts) {
      if (win.isDestroyed()) continue
      try { win.setAlwaysOnTop(false) } catch (e) {}
      if (hiddenMode) win.hide()
    }
  })
  ghosts.clear()
  debug(`Background: ${currentWalletLabel()} started (${why}), window hidden`)
}

function enterHiddenMode () {
  patchShowMethods()
  hiddenMode = true
  if (process.platform === 'darwin' && app.dock) app.dock.hide()
}

// safety net: if a window becomes visible some other way, hide it again right away
function keepHidden () {
  if (!hiddenMode) return
  if (booting && ghostSince && Date.now() - ghostSince > GHOST_MAX_MS) endGhosts('timeout')
  const Win = BaseWindow || BrowserWindow
  for (const win of Win.getAllWindows()) {
    if (win.isDestroyed() || !win.isVisible() || ghosts.has(win)) continue
    if (!suppressed.has(win)) suppressed.set(win, { maximize: win.isMaximized() })
    own(() => win.hide())
  }
}

function revealWindows () {
  if (!hiddenMode) return focusWindows()
  hiddenMode = false
  booting = false
  if (process.platform === 'darwin' && app.dock) app.dock.show()
  for (const win of ghosts) if (!win.isDestroyed()) setGhostLook(win, false)
  ghosts.clear()
  for (const [win, intent] of suppressed) {
    if (win.isDestroyed()) continue
    setGhostLook(win, false)
    win.show()
    if (intent.maximize) win.maximize()
    if (intent.fullScreen) win.setFullScreen(true)
  }
  suppressed.clear()
  debug(`Background: showing ${currentWalletLabel()}`)
  writeLive(true)
  focusWindows()
}

// "To the background": hide the window, Exodus keeps running (and syncing)
function hideToBackground () {
  if (hiddenMode) return
  const Win = BaseWindow || BrowserWindow
  const visible = Win.getAllWindows().filter((w) => !w.isDestroyed() && w.isVisible())
  enterHiddenMode()
  own(() => {
    for (const win of visible) {
      suppressed.set(win, { maximize: win.isMaximized() })
      win.hide()
    }
  })
  debug(`Background: ${currentWalletLabel()} now keeps running invisibly`)
  writeLive(true)
}

// Does Exodus want to show its unlock window (password needed)? That window is a separate page
// (unlock.html); Exodus' own lock flag in the UI state is not reliable for this.
function unlockWanted () {
  const Win = BaseWindow || BrowserWindow
  for (const win of Win.getAllWindows()) {
    if (win.isDestroyed() || !win.webContents) continue
    let url = ''
    try { url = win.webContents.getURL() } catch (e) {}
    if (!/\/unlock\.html/i.test(url)) continue
    if (win.isVisible() || suppressed.has(win)) return true
  }
  return false
}

function readLive (dir) {
  const live = readJson(path.join(dir, LIVE_FILE))
  if (!live || typeof live.at !== 'number' || Date.now() - live.at > LIVE_FRESH_MS) return null
  return live
}

let liveStatus = { state: 'starting' }
let liveWritten = ''
let liveWrittenAt = 0
function writeLive (force) {
  const data = { pid: process.pid, hidden: hiddenMode, ...liveStatus }
  const key = JSON.stringify(data)
  if (!force && key === liveWritten && Date.now() - liveWrittenAt < 10 * 1000) return
  liveWritten = key
  liveWrittenAt = Date.now()
  try { writeJson(path.join(currentDir(), LIVE_FILE), { ...data, at: Date.now() }) } catch (e) {}
}

// file contents: until when not to start in the background (ms since 1970)
function pauseBackground (dir, ms = PAUSE_MS) {
  try { fs.writeFileSync(path.join(dir, PAUSE_FILE), String(Date.now() + ms)) } catch (e) {}
}
function resumeBackground (dir) {
  try { fs.unlinkSync(path.join(dir, PAUSE_FILE)) } catch (e) {}
}
function isPaused (dir) {
  try { return Number(fs.readFileSync(path.join(dir, PAUSE_FILE), 'utf8')) > Date.now() } catch (e) { return false }
}

// runs only in visible windows: starts every not-yet-running wallet invisibly alongside
function ensureBackground () {
  if (hiddenMode || !uiContents || uiContents.isDestroyed()) return
  if (readSettings().backgroundSync === false) return
  for (const w of walletDirs()) {
    if (w.external || isRunning(w.dir) || !hasWallet(w.dir) || exists(path.join(w.dir, RESTORE_MARKER)) || isPaused(w.dir)) continue
    // several visible windows check at the same time – whoever starts first records it in the wallet
    const claim = path.join(w.dir, BG_CLAIM_FILE)
    try { if (Date.now() - fs.statSync(claim).mtimeMs < BG_RETRY_MS) continue } catch (e) {}
    try { fs.writeFileSync(claim, String(process.pid)) } catch (e) { continue }
    debug(`Background: starting ${w.isStandard ? standardLabel() : w.name} invisibly`)
    launch(w.dir, { hidden: true })
  }
}

// runs only in hidden instances: quit when there's no visible Exodus window (or when switched off)
let lonelySince = 0
function backgroundWatchdog () {
  if (!hiddenMode) { lonelySince = 0; return }
  if (readSettings().backgroundSync === false) {
    debug('Background: switched off – quitting')
    return app.quit()
  }
  const visible = walletDirs().some((w) => {
    if (isCurrent(w.dir) || !lockAlive(w.dir)) return false
    const live = readLive(w.dir)
    return live && !live.hidden
  })
  if (visible) { lonelySince = 0; return }
  if (!lonelySince) { lonelySince = Date.now(); return }
  if (Date.now() - lonelySince > 30 * 1000) {
    debug('Background: no Exodus window open anymore – quitting')
    app.quit()
  }
}

// ---------------------------------------------------------------------------------------------
// Renaming the wallet in its own window: the folder is in use as long as this process
// runs. A small PowerShell script waits until Exodus has quit, renames, and reopens.
// ---------------------------------------------------------------------------------------------

const RENAME_HELPER_PS = `
$from = $env:XW_FROM; $to = $env:XW_TO; $ok = $false
try { Wait-Process -Id ([int]$env:XW_PID) -Timeout 60 -ErrorAction SilentlyContinue } catch {}
for ($i = 0; $i -lt 60; $i++) {
  try {
    if ($from.ToLower() -eq $to.ToLower()) {
      $tmp = $to + '.renaming'
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
  if [ ! -L "$XW_LOCK" ] && [ ! -e "$XW_LOCK" ]; then break; fi
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
    // No wait-by-pid on posix; wait for Exodus' single-instance lock (a symlink) to disappear instead
    env.XW_LOCK = path.join(from, 'SingletonLock')
    child = spawn('sh', ['-c', RENAME_HELPER_SH], { detached: true, stdio: 'ignore', env })
  }
  child.unref()
}

function renameFolder (from, to) {
  if (norm(from) === norm(to)) {
    const tmp = to + '.renaming'
    fs.renameSync(from, tmp) // only case changed
    fs.renameSync(tmp, to)
  } else {
    fs.renameSync(from, to)
  }
}

// ---------------------------------------------------------------------------------------------
// Balance and address cache (reads via Exodus' own selectors/API in the UI)
// ---------------------------------------------------------------------------------------------

const SNAPSHOT_JS = `(() => {
  try {
    const s = globalThis.selectors, store = globalThis.store
    if (!s || !store || !s.fiatBalances) return { error: 'no-globals' }
    const st = store.getState()
    // Language/currency first: they're already set before the balances have loaded
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
    // Freshly created wallet with no funds: Exodus then returns no portfolios at all – that's 0, not "unknown"
    if (total == null && typeof s.fiatBalances.loaded === 'function') total = 0
    return { total, currency, language, portfolios }
  } catch (e) {
    return { error: String((e && e.message) || e) }
  }
})()`

// Receive addresses are public; we remember them so they can be copied later without opening the
// wallet. Exodus' address API isn't held in a global variable but is passed to the UI via a
// React provider ("exodus" prop) – that's where we pick it up.
// We skip hardware-wallet portfolios (Trezor/Ledger) so that no device is contacted.
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
    // Additionally all portfolios for which Exodus keeps balances – in case getEnabled doesn't return them all
    try {
      const byAccount = (s.fiatBalances && typeof s.fiatBalances.byWalletAccount === 'function' && s.fiatBalances.byWalletAccount(st)) || {}
      for (const n of Object.keys(byAccount)) if (!names.includes(n)) names.push(n)
    } catch (e) {}
    const lookup = (n) => { try { return Array.isArray(accounts) ? null : (accounts[n] || (s.walletAccounts.get && s.walletAccounts.get(st)[n])) } catch (e) { return null } }
    names = names.filter((n) => { const a = lookup(n); return !(a && (a.isHardware || a.source === 'ledger' || a.source === 'trezor')) })
    if (!names.length) names = ['exodus_0']
    // Same order as in Exodus: exodus_0, exodus_1, …
    names.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
    let properName = null
    try { properName = s.walletAccounts.getProperName(st) } catch (e) {}
    const withTimeout = (p) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), 3000))])
    const out = []
    // Portfolio outer, coin inner – this keeps a portfolio's addresses together in the list
    for (const wa of names) {
      for (const assetName of Object.keys(enabled).filter((n) => enabled[n])) {
        const asset = all[assetName]
        if (!asset) continue
        if (out.length >= 600) break
        try {
          // First Exodus' cache; for portfolios not yet opened in Exodus it's
          // empty – then derive the address directly (public key, no device for software wallets)
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

// Coin amounts per portfolio and asset – incoming payments are detected from these (amount rose = incoming).
// The fiat value comes from Exodus' own conversion (fiatBalances.byAssetSource), i.e. exactly the
// value Exodus itself shows. Read only – no seeds, no keys, no network.
const HOLDINGS_JS = `(() => {
  try {
    const s = globalThis.selectors, store = globalThis.store
    if (!s || !store || !s.fiatBalances || !s.balances) return { error: 'no-globals' }
    const st = store.getState()
    if (typeof s.fiatBalances.loaded === 'function' && !s.fiatBalances.loaded(st)) return { error: 'not-loaded' }
    const num = (v) => {
      if (v == null) return null
      if (typeof v === 'number') return v
      for (const m of ['toDefaultNumber', 'toNumber']) {
        if (typeof v[m] === 'function') { const n = Number(v[m]()); if (isFinite(n)) return n }
      }
      const n = parseFloat(String(v.toDefaultString ? v.toDefaultString() : v).replace(/[^0-9.-]/g, ''))
      return isFinite(n) ? n : null
    }
    const bySource = typeof s.fiatBalances.byAssetSource === 'function' ? s.fiatBalances.byAssetSource(st) : null
    if (!bySource) return { error: 'no-byAssetSource' }
    const getB = typeof s.balances.getBalances === 'function' ? s.balances.getBalances(st) : null
    if (!getB) return { error: 'no-getBalances' }
    const all = (s.assets && typeof s.assets.all === 'function' && s.assets.all(st)) || {}
    let currency = null
    try { currency = String(s.locale.currency(st)) } catch (e) {}
    let properName = null
    try { properName = s.walletAccounts.getProperName(st) } catch (e) {}
    const accounts = Object.keys(bySource)
    const holdings = []
    for (const wa of accounts) {
      const fiatByAsset = bySource[wa] || {}
      for (const assetName of Object.keys(fiatByAsset)) {
        const asset = all[assetName]
        if (!asset) continue
        let b = null
        try { b = getB({ assetName, walletAccount: wa }) } catch (e) {}
        const amount = num(b && (b.balance != null ? b.balance : b.total))
        if (!amount || amount <= 0) continue
        holdings.push({
          asset: assetName,
          ticker: String(asset.displayTicker || asset.ticker || assetName),
          label: String(asset.displayName || asset.name || assetName),
          account: wa,
          portfolio: properName ? String(properName(wa, { maxLength: 40 })) : wa,
          amount,
          fiat: num(fiatByAsset[assetName]),
        })
      }
    }
    return { holdings, currency, portfolioCount: accounts.length }
  } catch (e) {
    return { error: String((e && e.message) || e) }
  }
})()`

// Exodus ships the coin icons itself: src/res/deps/img/<asset>-<hash>.svg (e.g. bitcoin-c53be7.svg,
// ach_ethereum_fbad19a6-02bb85.svg). Some coins additionally have a small 18×18 symbol under
// the same name – we take the large 40×40 hexagon that Exodus shows in lists.
const ICON_DIR = ['src', 'res', 'deps', 'img']
let iconIndex = null
function loadIconIndex () {
  iconIndex = new Map()
  const dir = path.join(app.getAppPath(), ...ICON_DIR)
  let files = []
  try { files = fs.readdirSync(dir) } catch (e) { debug('Coin icons not found: ' + e.message); return iconIndex }
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

// Tokens that Exodus only picks up at runtime (e.g. XO Cash on Solana) have no icon in the app.
// Exodus stores their icon as <data folder>/images/<asset>.svg and shows exactly that – so do we
// (as a data: URL, because the file lies outside the app). Read only, no network.
const CUSTOM_ICON_DIR = 'images'
const customIcons = new Map()
function customIconFor (dir, assetName) {
  if (!dir || !/^[\w.-]+$/.test(String(assetName || ''))) return null
  const file = path.join(dir, CUSTOM_ICON_DIR, assetName + '.svg')
  try {
    const mtime = fs.statSync(file).mtimeMs
    const hit = customIcons.get(file)
    if (hit && hit.mtime === mtime) return hit.data
    const buf = fs.readFileSync(file)
    const data = buf.length < 256 * 1024 && /<svg/i.test(buf.slice(0, 512).toString('utf8'))
      ? 'data:image/svg+xml;base64,' + buf.toString('base64')
      : null
    customIcons.set(file, { mtime, data })
    return data
  } catch (e) {
    return null
  }
}

// Relative to src/static/exodus-prod.html – this way the sidebar loads the image directly from Exodus.
// Same order as in Exodus: the asset's own icon, then the wallet's stored token icon
// (dir, else this window), lastly the base coin's icon (token on another chain).
function iconFor (assetName, dir) {
  const index = iconIndex || loadIconIndex()
  const name = String(assetName || '').toLowerCase()
  const own = index.get(name)
  if (own) return '../res/deps/img/' + own
  const custom = customIconFor(dir, assetName) || customIconFor(currentDir(), assetName)
  if (custom) return custom
  const base = index.get(name.split('_')[0])
  return base ? '../res/deps/img/' + base : null
}

// The same icon as a data: URL – for the incoming-payment notification, which doesn't load from the page
const iconData = new Map()
function iconDataFor (assetName, dir) {
  const rel = iconFor(assetName, dir)
  if (!rel) return null
  if (rel.startsWith('data:')) return rel
  if (iconData.has(rel)) return iconData.get(rel)
  let data = null
  try {
    data = 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(app.getAppPath(), ...ICON_DIR, path.basename(rel))).toString('base64')
  } catch (e) {}
  iconData.set(rel, data)
  return data
}

function updateCache (patch) {
  const file = path.join(currentDir(), CACHE_FILE)
  const next = { ...(readJson(file) || {}), ...patch }
  try { writeJson(file, next) } catch (e) { console.error(TAG, 'Cache not saved:', e.message) }
  return next
}

// This window's Exodus settings; sent to the sidebar with every state()
let uiCurrency = null
function rememberLocale (res) {
  if (!res) return
  if (typeof res.language === 'string' && res.language && res.language !== uiLanguage) {
    uiLanguage = res.language
    debug(`Exodus language: ${uiLanguage}`)
  }
  if (typeof res.currency === 'string' && res.currency) uiCurrency = res.currency
}

// Only log the result when it changes – otherwise every window writes a line every 20 s
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
    return { error: 'executeJavaScript failed: ' + e.message }
  }
}

async function snapshotBalance (wc) {
  if (!wc || wc.isDestroyed()) return null
  const res = await runInUi(wc, SNAPSHOT_JS, 4000)
  rememberLocale(res)
  if (!res || res.error || typeof res.total !== 'number' || !isFinite(res.total)) {
    logStatus('Balance snapshot', 'no value – ' + ((res && res.error) || 'total missing'))
    return null
  }
  logStatus('Balance snapshot', 'ok')
  return updateCache({
    total: res.total,
    currency: res.currency || null,
    portfolios: Array.isArray(res.portfolios) ? res.portfolios.slice(0, 50) : [],
    updatedAt: new Date().toISOString(),
  })
}

let lastAddressesAt = 0
let addressesRun = null // query in progress – a second call simply waits alongside
function snapshotAddresses (wc, force) {
  if (!wc || wc.isDestroyed()) return Promise.resolve()
  if (addressesRun) return addressesRun
  if (!force && Date.now() - lastAddressesAt < ADDRESSES_EVERY_MS) return Promise.resolve()
  addressesRun = fetchAddresses(wc).finally(() => { addressesRun = null })
  return addressesRun
}
async function fetchAddresses (wc) {
  const res = await runInUi(wc, ADDRESSES_JS, 90000)
  if (!res || res.error || !Array.isArray(res.addresses)) {
    logStatus('Addresses', 'none – ' + ((res && res.error) || 'empty'))
    return
  }
  lastAddressesAt = Date.now()
  const perPortfolio = {}
  for (const a of res.addresses) perPortfolio[a.portfolio || a.account] = (perPortfolio[a.portfolio || a.account] || 0) + 1
  logStatus('Addresses', `ok (${res.addresses.length}) – ` + (Object.entries(perPortfolio).map(([p, n]) => `${p}: ${n}`).join(', ') || 'no portfolios'))
  if (res.addresses.length) updateCache({ addresses: res.addresses, addressesAt: new Date().toISOString() })
}

// ---------------------------------------------------------------------------------------------
// Incoming payments ("money received"): each window watches the coin amounts of its own wallet. When one
// rises, it drops an event into Exodus-Wallets\.incoming. It's shown only by the currently focused
// window and never by that of the receiving wallet itself – there Exodus shows the incoming payment anyway.
// ---------------------------------------------------------------------------------------------

// Wallet state from Exodus' own state: locked (password), onboarding (no wallet yet),
// restoring (restoringAssets = coins still being loaded), balances loaded.
// It also counts how often Exodus itself plays receive.wav in this window: Exodus plays the
// sound on every incoming payment in every window, even hidden – then our card stays silent (no double sound).
const STATUS_JS = `(() => {
  try {
    const store = globalThis.store, s = globalThis.selectors
    if (!store) return { error: 'no-store' }
    if (!globalThis.__xwReceiveSounds) {
      globalThis.__xwReceiveSounds = { n: 0 }
      const play = HTMLMediaElement.prototype.play
      HTMLMediaElement.prototype.play = function () {
        try { if (/receive\\.wav$/i.test(String(this.src || ''))) globalThis.__xwReceiveSounds.n++ } catch (e) {}
        return play.apply(this, arguments)
      }
    }
    const st = store.getState()
    const a = st.application || {}
    const r = st.restoringAssets || {}
    let fiatLoaded = null
    try { if (s && s.fiatBalances && typeof s.fiatBalances.loaded === 'function') fiatLoaded = !!s.fiatBalances.loaded(st) } catch (e) {}
    return {
      loading: !!a.isLoading,
      locked: !!a.isLocked,
      walletExists: a.walletExists !== false,
      restoring: !!a.isRestoring,
      restoringLeft: r.loaded && r.data ? Object.keys(r.data).length : 0,
      fiatLoaded,
      sounds: globalThis.__xwReceiveSounds.n,
    }
  } catch (e) {
    return { error: String((e && e.message) || e) }
  }
})()`
const SOUNDS_JS = '(globalThis.__xwReceiveSounds && globalThis.__xwReceiveSounds.n) || 0'

// starting → onboarding (Exodus asks: new or restore) → locked (password: Exodus shows its unlock
// window) → restoring (coins are being loaded) → syncing (balances still missing) → ready.
// Exodus' own isLocked/isLoading flags in the UI state are not kept up to date there, so they are
// not used (an unlocked, working wallet still reports isLocked: true).
function statusFrom (res, locked) {
  if (locked) return { state: 'locked' }
  if (!res || res.error) return { state: 'starting' }
  if (!res.walletExists) return { state: 'onboarding' }
  if (res.restoring || res.restoringLeft > 0) return { state: 'restoring', left: res.restoringLeft }
  if (res.fiatLoaded === false) return { state: 'syncing' }
  return { state: 'ready' }
}

const HOLDINGS_EVERY_MS = 3000
const RECEIVED_WARMUP_MS = 30 * 1000 // right after unlocking Exodus is still loading and syncing
const RECEIVED_DROP_MS = 20 * 1000 // a dropped amount only counts once it stays that way this long (not a loading interim state)
const RECEIVED_KEEP_MS = 10 * 60 * 1000
const eventsDir = () => path.join(profilesRoot(), '.incoming') // leading dot: doesn't show up as a wallet

// Last amounts per "asset|portfolio" – in memory only: the first read is the baseline
let holdingsBase = null
let holdingsSince = 0
let holdingsBusy = false
const holdingsLow = new Map()
let soundsSeen = null // how often Exodus has played receive.wav here, as far as already assigned to an incoming payment

const focusedHere = () => !!(BaseWindow && typeof BaseWindow.getFocusedWindow === 'function' && BaseWindow.getFocusedWindow())

async function checkHoldings (wc) {
  if (!wc || wc.isDestroyed() || holdingsBusy) return
  holdingsBusy = true
  try {
    const res = await runInUi(wc, HOLDINGS_JS, 3000)
    if (!res || res.error || !Array.isArray(res.holdings)) {
      logStatus('Incoming', 'no value – ' + ((res && res.error) || 'empty'))
      return
    }
    logStatus('Incoming', 'ok')
    const now = Date.now()
    const cur = new Map(res.holdings.map((h) => [h.asset + '|' + h.account, h]))
    const amounts = () => new Map([...cur].map(([k, h]) => [k, h.amount]))
    if (!holdingsBase) holdingsSince = now
    // First read and warmup phase: only remember the state, don't report anything
    if (!holdingsBase || now - holdingsSince < RECEIVED_WARMUP_MS) {
      holdingsBase = amounts()
      return
    }
    const tiny = (n) => Math.max(1e-12, n * 1e-9)
    const received = []
    for (const [k, h] of cur) {
      const base = holdingsBase.get(k) || 0
      if (h.amount > base + tiny(base)) {
        holdingsBase.set(k, h.amount)
        holdingsLow.delete(k)
        received.push({ h, diff: h.amount - base })
      }
    }
    for (const [k, base] of holdingsBase) {
      const amount = cur.has(k) ? cur.get(k).amount : 0
      if (amount >= base - tiny(base)) { holdingsLow.delete(k); continue }
      const since = holdingsLow.get(k)
      if (!since) { holdingsLow.set(k, now); continue }
      if (now - since < RECEIVED_DROP_MS) continue
      holdingsLow.delete(k)
      if (amount > 0) holdingsBase.set(k, amount)
      else holdingsBase.delete(k)
    }
    if (!received.length) return
    // Save the balance immediately: the other windows read it as soon as they show the card, and roll the balance
    await snapshotBalance(wc)
    // Has Exodus already played receive.wav here itself (even in a hidden window)? Wait briefly –
    // Exodus' sound and the new balance don't always arrive at the same moment. Then the card stays silent.
    await sleep(1500)
    const n = await runInUi(wc, SOUNDS_JS, 1000)
    const exodusSound = typeof n === 'number' && soundsSeen != null && n > soundsSeen
    if (typeof n === 'number') soundsSeen = n
    // This window is in front? Then Exodus shows the incoming payment itself – no second window should report it too
    if (focusedHere()) { debug(`Incoming payment detected (${currentWalletLabel()}), window is in front – Exodus shows it itself`); return }
    const me = walletDirs().find((x) => isCurrent(x.dir))
    fs.mkdirSync(eventsDir(), { recursive: true })
    for (const { h, diff } of received) {
      const price = h.fiat != null && h.amount > 0 ? h.fiat / h.amount : null
      const ev = {
        type: 'received',
        id: now.toString(36) + '-' + crypto.randomBytes(4).toString('hex'),
        at: now,
        dir: currentDir(),
        exodusSound, // Exodus has already played the sound → card without sound
        walletId: me && !me.external ? me.id : null,
        wallet: currentWalletLabel(),
        asset: h.asset,
        ticker: h.ticker,
        coin: h.label,
        amount: diff,
        value: price != null ? diff * price : null, // fiat value at the time of the incoming payment
        currency: res.currency || uiCurrency || null,
        portfolio: res.portfolioCount > 1 ? h.portfolio : null,
      }
      writeJson(path.join(eventsDir(), ev.id + '.json'), ev)
      debug(`Incoming payment detected: ${ev.wallet} – ${ev.ticker}`)
    }
  } catch (e) {
    debug('Incoming-payment error: ' + e.message)
  } finally {
    holdingsBusy = false
  }
}

// Exodus' own sound setting for this window (Settings → Sounds): Exodus plays receive.wav only
// when "sounds.all.enabled" is on, and at the volume "sounds.all.volume" – we do exactly the same
const SOUND_JS = `(() => {
  try {
    const c = globalThis.store && globalThis.store.getState().config
    if (!c || typeof c.get !== 'function') return { on: true, volume: 1 }
    const v = Number(c.get('sounds.all.volume'))
    return { on: !!c.get('sounds.all.enabled'), volume: isFinite(v) ? Math.min(1, Math.max(0, v)) : 1 }
  } catch (e) {
    return { on: true, volume: 1 }
  }
})()`

// Runs in every window every second, but only does something while this window is in front
let lastPrune = 0
let delivering = false
async function deliverReceived () {
  const wc = uiContents
  if (delivering || !wc || wc.isDestroyed() || !focusedHere()) return
  let files = []
  try { files = fs.readdirSync(eventsDir()) } catch (e) { return }
  delivering = true
  try {
    const now = Date.now()
    const open = []
    for (const f of files) {
      if (!f.endsWith('.json')) continue
      const file = path.join(eventsDir(), f)
      const done = file.slice(0, -5) + '.done'
      if (exists(done)) continue
      const ev = readJson(file)
      if (!ev || typeof ev.at !== 'number' || !ev.dir || now - ev.at > RECEIVED_KEEP_MS) continue
      open.push({ ev, done })
    }
    // Oldest first – the newest then ends up on top of the stack
    open.sort((a, b) => a.ev.at - b.ev.at)
    let sound = null
    for (const { ev, done } of open) {
      // Whoever creates the .done file shows the incoming payment: card and sound thus come in only one window
      try { fs.closeSync(fs.openSync(done, 'wx')) } catch (e) { continue }
      // The own wallet: Exodus has already shown the incoming payment in this window itself – just mark
      // it as done. "Setup finished", on the other hand, is shown by the own window too (that's what you're waiting for there).
      if (isCurrent(ev.dir) && ev.type !== 'ready') continue
      if (!sound && ev.type !== 'ready') sound = await runInUi(wc, SOUND_JS, 1000)
      if (!sound || sound.error) sound = { on: true, volume: 1 }
      const w = walletDirs().find((x) => norm(x.dir) === norm(ev.dir))
      if (wc.isDestroyed()) return
      wc.send('exodus-wallets:received', {
        ...ev,
        walletId: w && !w.external ? w.id : ev.walletId,
        wallet: w ? (w.isStandard ? standardLabel() : w.name) : ev.wallet,
        avatar: avatarFor(ev.dir),
        icon: ev.asset ? iconDataFor(ev.asset, ev.dir) : null,
        hidden: !!readSettings().hideBalances,
        language: uiLanguage,
        sound,
      })
    }
  } finally {
    delivering = false
  }
  if (Date.now() - lastPrune > 60 * 1000) {
    const now = Date.now()
    lastPrune = now
    for (const f of files) {
      const file = path.join(eventsDir(), f)
      try { if (now - fs.statSync(file).mtimeMs > RECEIVED_KEEP_MS + 60 * 1000) fs.unlinkSync(file) } catch (e) {}
    }
  }
}

function writeEvent (ev) {
  fs.mkdirSync(eventsDir(), { recursive: true })
  writeJson(path.join(eventsDir(), ev.id + '.json'), ev)
}

// ---------------------------------------------------------------------------------------------
// Setting up new wallets: After "Create", "Restore with 12 words" or "Import old
// folder" the wallet has to stay open for a while until Exodus has loaded everything. The SETUP_FILE
// marker stays in the data folder that whole time; it's done when Exodus is no longer restoring, the
// balances are loaded, and we've saved balance and addresses once. Then a
// card reports "ready" – in the focused window, also in the wallet's own window.
// ---------------------------------------------------------------------------------------------

const SETUP_FILE = 'wallet-switcher-setup.json'
let readySince = 0
let settingUp = false
function markSetup (dir, kind) {
  try { writeJson(path.join(dir, SETUP_FILE), { kind, since: new Date().toISOString() }) } catch (e) {}
}

async function trackSetup (wc) {
  const file = path.join(currentDir(), SETUP_FILE)
  if (settingUp || !exists(file)) return
  if (liveStatus.state !== 'ready') { readySince = 0; return }
  if (!readySince) readySince = Date.now()
  if (Date.now() - readySince < 6000) return // stable at "ready" for a few seconds
  settingUp = true
  try {
    // Save addresses and balance once, completely – only then is everything really there
    if (!lastAddressesAt) {
      writeLive(true)
      await snapshotAddresses(wc, true)
      if (!lastAddressesAt) return
    }
    if (!(await snapshotBalance(wc))) return
    const setup = readJson(file) || {}
    try { fs.unlinkSync(file) } catch (e) {}
    updateCache({ setupDoneAt: new Date().toISOString() })
    const me = walletDirs().find((x) => isCurrent(x.dir))
    const now = Date.now()
    writeEvent({
      type: 'ready',
      id: now.toString(36) + '-' + crypto.randomBytes(4).toString('hex'),
      at: now,
      dir: currentDir(),
      walletId: me && !me.external ? me.id : null,
      wallet: currentWalletLabel(),
      kind: setup.kind || null,
    })
    debug(`Setup finished: ${currentWalletLabel()}`)
  } catch (e) {
    debug('Setup error: ' + e.message)
  } finally {
    settingUp = false
    writeLive(true)
  }
}

// Every 3 s: wallet state (for the heartbeat and sidebar), then check for incoming payments
let ticking = false
let ghostDoneSince = 0
async function tick (wc) {
  if (!wc || wc.isDestroyed() || ticking) return
  ticking = true
  try {
    const res = await runInUi(wc, STATUS_JS, 2000)
    if (res && typeof res.sounds === 'number' && soundsSeen == null) soundsSeen = res.sounds
    const next = statusFrom(res, unlockWanted())
    // During a new wallet's first address query: "saving addresses"
    liveStatus = settingUp && next.state === 'ready' ? { state: 'addresses' } : next
    writeLive()
    // Hidden start: once Exodus is ready (or waits for a password) for a few seconds, hide the ghost window
    if (booting) {
      if (next.state === 'ready' || next.state === 'locked') {
        if (!ghostDoneSince) ghostDoneSince = Date.now()
        else if (Date.now() - ghostDoneSince >= 3000) endGhosts(next.state)
      } else ghostDoneSince = 0
    }
    if (next.state === 'ready' || next.state === 'starting') await checkHoldings(wc)
    // Locked or reloading: forget the state – otherwise its reappearance would look like an incoming payment
    else holdingsBase = null
    trackSetup(wc).catch((e) => debug('Setup error: ' + e.message))
  } finally {
    ticking = false
  }
}

let uiContents = null
let snapshotTimer = null
let tickTimer = null
function rememberUi (wc) {
  if (uiContents === wc) return
  uiContents = wc
  debug(`Exodus UI detected – balance saved every ${SNAPSHOT_EVERY_MS / 1000} s` + (hiddenMode ? ' (background)' : ''))
  wc.once('destroyed', () => { if (uiContents === wc) uiContents = null })
  if (!snapshotTimer) {
    snapshotTimer = setInterval(async () => {
      if (!uiContents || uiContents.isDestroyed()) return
      const ok = await snapshotBalance(uiContents)
      if (ok) snapshotAddresses(uiContents, false)
    }, SNAPSHOT_EVERY_MS)
  }
  if (!tickTimer) tickTimer = setInterval(() => tick(uiContents), HOLDINGS_EVERY_MS)
  // New UI (e.g. after a reload): re-read the baseline
  holdingsBase = null
  snapshotBalance(wc)
}

// ---------------------------------------------------------------------------------------------
// Settings (apply to all wallets)
// ---------------------------------------------------------------------------------------------

function readSettings () {
  return { hideBalances: false, startWallet: 'standard', standardName: null, backgroundSync: true, ...(readJson(globalFile(SETTINGS_FILE)) || {}) }
}

function writeSettings (patch) {
  const next = { ...readSettings(), ...patch }
  fs.mkdirSync(profilesRoot(), { recursive: true })
  writeJson(globalFile(SETTINGS_FILE), next)
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
// Sidebar actions
// ---------------------------------------------------------------------------------------------

async function closeOtherWallet (w) {
  if (isCurrent(w.dir)) throw new Error(t('cannotCloseCurrent'))
  if (!isRunning(w.dir)) return
  pauseBackground(w.dir) // otherwise background sync would restart it right away
  sendCommand(w.dir, 'quit')
  if (!(await waitUntil(() => !lockAlive(w.dir), 30000))) throw new Error(t('closeTimeout'))
  await sleep(800) // subprocesses (GPU, renderer) release their files shortly after the main process
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
    // Restoration was aborted? Then start directly with the 12-word entry again.
    if (!hasWallet(w.dir) && exists(path.join(w.dir, RESTORE_MARKER))) fs.writeFileSync(path.join(w.dir, RESTORE_FLAG), '')
    resumeBackground(w.dir) // opened again → may run along in the background again too
    const wasRunning = isRunning(w.dir)
    // If it's running invisibly in the background, the restart (Exodus' "second-instance") brings its window to the front
    launch(w.dir)
    if (switchTo) setTimeout(() => app.quit(), 1500)
    return { launched: true, wasRunning }
  },

  // Explicitly closed: stays closed (not even in the background) until it's opened again
  async close (event, id) {
    const w = findWallet(id)
    await closeOtherWallet(w)
    pauseBackground(w.dir, 365 * 24 * 60 * 60 * 1000)
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
    markSetup(dir, restore ? 'restore' : 'create')
    launch(dir)
    return { id: 'p:' + name, name }
  },

  // options.close: close an open wallet for this; options.reopen: reopen it afterward
  async rename (event, id, rawName, options) {
    const close = !!(options && options.close)
    const reopen = !!(options && options.reopen)
    const w = findWallet(id)
    if (w.external) throw new Error(t('cannotRename'))

    // The default folder (%APPDATA%\Exodus) stays where it is – only the display name is renamed
    if (w.isStandard) {
      const raw = String(rawName == null ? '' : rawName).trim()
      const name = raw ? validateName(raw, { displayOnly: true }) : null
      writeSettings({ standardName: name })
      return { id: w.id, name: standardLabel() }
    }

    const name = validateName(rawName, { allowSameAs: w.name })
    if (name === w.name) return { id: w.id, name }
    pauseBackground(w.dir) // don't start in the background in the middle of renaming
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

  // Only to the Recycle Bin – there's deliberately no permanent delete. Without the 12 words the money would be gone.
  async remove (event, id, confirmName, options) {
    const close = !!(options && options.close)
    const w = findWallet(id)
    if (w.isStandard || w.external) throw new Error(t('cannotDelete'))
    if (isCurrent(w.dir)) throw new Error(t('deleteCurrent'))
    if (String(confirmName == null ? '' : confirmName).trim() !== w.name) throw new Error(t('deleteConfirm'))
    pauseBackground(w.dir)
    if (isRunning(w.dir)) {
      if (!close) throw new Error(t('deleteRunning'))
      await closeOtherWallet(w)
    }
    try {
      await shell.trashItem(w.dir)
    } catch (e) {
      throw new Error(t('trashFailed', (e && e.message) || String(e)))
    }
    debug(`Wallet moved to the Recycle Bin: ${w.name}`)
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
    // Fetch fresh for the own window – e.g. right after a coin was enabled
    if (isCurrent(w.dir) && uiContents) await snapshotAddresses(uiContents, true)
    const cache = readJson(path.join(w.dir, CACHE_FILE)) || {}
    const addresses = (Array.isArray(cache.addresses) ? cache.addresses : []).map((a) => ({ ...a, icon: iconFor(a.asset, w.dir) }))
    // All portfolios Exodus knows for this wallet (from the balance) – including those without saved addresses
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

  // Plain text to the clipboard (used by the multi-address export – one address per line)
  async copyText (event, text) {
    clipboard.writeText(String(text == null ? '' : text))
    return true
  },

  // Cached addresses across ALL wallets, each tagged with its wallet, for the cross-wallet export
  async allAddresses (event) {
    const out = []
    for (const w of walletDirs()) {
      const label = w.isStandard ? standardLabel() : w.name
      const cache = readJson(path.join(w.dir, CACHE_FILE)) || {}
      for (const a of (Array.isArray(cache.addresses) ? cache.addresses : [])) {
        out.push({ ...a, icon: iconFor(a.asset, w.dir), walletId: w.id, wallet: label })
      }
    }
    return { addresses: out }
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
    // Crop to a centered square, then shrink – it's shown round in the sidebar
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
    // Explicitly --datadir even for Default: otherwise the shortcut would be redirected to the start wallet
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
    if (patch && typeof patch.backgroundSync === 'boolean') next.backgroundSync = patch.backgroundSync
    const res = writeSettings(next)
    if (next.backgroundSync === true) setTimeout(ensureBackground, 500)
    return res
  },

  // Hide the window of another open wallet – it keeps running and syncing
  async hide (event, id) {
    const w = findWallet(id)
    if (isCurrent(w.dir)) throw new Error(t('notAllowed'))
    if (!isRunning(w.dir)) throw new Error(t('notFound'))
    sendCommand(w.dir, 'hide')
    return true
  },
}

// ---------------------------------------------------------------------------------------------
// Window title: "Exodus 26.8.27 – <wallet name>", so the windows can be told apart in the taskbar and Alt+Tab.
// The Exodus main window is a BaseWindow (not a BrowserWindow), so there's no
// "browser-window-created" – we check the titles regularly and append the name.
// ---------------------------------------------------------------------------------------------

// This window's wallet doesn't change while it's running – determining it once is enough.
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
// Hooking into Exodus
// ---------------------------------------------------------------------------------------------

// The Exodus UI runs in the "persist:main" session (folder <data folder>\Partitions\main)
function isMainSession (ses) {
  try {
    const p = ses && ses.storagePath
    return !!p && path.basename(p).toLowerCase() === 'main' && path.basename(path.dirname(p)).toLowerCase() === 'partitions'
  } catch (e) {
    return false
  }
}

// Only the Exodus UI itself (main frame of exodus-prod.html) may call the actions
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

// Save the balance as soon as the Exodus UI has loaded – regardless of whether anyone opens the
// sidebar. Otherwise other windows would never see this wallet with a current balance.
function watchUi (wc) {
  if (!wc || !isMainSession(wc.session)) return
  wc.on('did-finish-load', () => {
    try { if (isUiUrl(wc.getURL())) rememberUi(wc) } catch (e) { debug('watchUi error: ' + e.message) }
  })
}

const registered = new WeakSet()
function registerPreload (ses) {
  debug(`registerPreload called, ses=${!!ses}, isMainSession=${isMainSession(ses)}`)
  if (!ses || registered.has(ses) || !isMainSession(ses)) {
    debug(`registerPreload aborted: ses=${!!ses}, already=${registered.has(ses)}, isMain=${isMainSession(ses)}`)
    return
  }
  registered.add(ses)
  debug(`PRELOAD path: ${PRELOAD}`)
  debug(`PRELOAD exists: ${fs.existsSync(PRELOAD)}`)
  if (typeof ses.registerPreloadScript === 'function') {
    ses.registerPreloadScript({ type: 'frame', filePath: PRELOAD })
    debug('using registerPreloadScript()')
  } else {
    ses.setPreloads([...ses.getPreloads(), PRELOAD])
    debug('using setPreloads()')
  }
  debug(`Wallet sidebar active (v${VERSION})`)
}

try {
  if (!redirectToStartWallet()) {
    // Started invisibly (background sync): don't even show Exodus' window
    if (startedHidden) {
      booting = true // the main window is shown as a transparent "ghost" until Exodus has started
      enterHiddenMode()
      debug('Started in the background (no window)')
    }
    // Whoever opens a background wallet starts Exodus for its folder again – Exodus reports this to the
    // running instance as "second-instance". Our handler runs before Exodus' own (which focuses the window).
    app.on('second-instance', () => {
      try { if (hiddenMode) revealWindows() } catch (e) { debug('Showing failed: ' + e.message) }
    })
    debug('Registering event handlers...')
    app.on('session-created', (ses) => {
      debug('session-created event')
      try { registerPreload(ses) } catch (e) { debug('Error: ' + e.message) }
    })
    app.on('web-contents-created', (_event, wc) => {
      debug('web-contents-created event')
      try { registerPreload(wc.session) } catch (e) { debug('Error: ' + e.message) }
      try { watchUi(wc) } catch (e) { debug('Error: ' + e.message) }
    })
    app.whenReady().then(() => {
      setInterval(() => { try { refreshWindowTitles() } catch (e) { debug('Window-title error: ' + e.message) } }, 1500)
      setInterval(() => { checkCommands().catch((e) => debug('Command error: ' + e.message)) }, 1000)
      setInterval(() => { deliverReceived().catch((e) => debug('Incoming-payment error: ' + e.message)) }, 1000)
      // Background sync
      if (hiddenMode && process.platform === 'darwin' && app.dock) app.dock.hide()
      setInterval(() => { try { keepHidden() } catch (e) {} }, 400)
      setInterval(() => { try { if (uiContents) writeLive() } catch (e) {} }, 5000)
      setInterval(() => { try { ensureBackground() } catch (e) { debug('Background error: ' + e.message) } }, BG_EVERY_MS)
      setInterval(() => { try { backgroundWatchdog() } catch (e) { debug('Background error: ' + e.message) } }, 10 * 1000)
    })
    debug('Event handlers registered')

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
  console.error(TAG, 'Sidebar could not be loaded:', e)
}

module.exports = {
  VERSION,
  _test: {
    api, buildState, snapshotBalance, checkHoldings, deliverReceived, rememberUi, tick, trackSetup, markSetup,
    lockAlive, iconFor, ensureBackground, backgroundWatchdog, enterHiddenMode, revealWindows, hideToBackground, keepHidden,
    isHidden: () => hiddenMode, live: () => liveStatus, setBooting: (on) => { booting = on },
  },
}
