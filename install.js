#!/usr/bin/env node
'use strict'
/*
 * Exodus wallet sidebar – installer (Windows, macOS, Linux)
 *
 *   node install.js install     Patch the sidebar into the installed Exodus (creates a backup first)
 *   node install.js uninstall   Restore the original Exodus from the backup
 *   node install.js status      Show whether the sidebar is installed
 *
 * Options:
 *   --app "<path to the Exodus app dir>"   use a specific Exodus install instead of auto-detecting
 *
 * What changes? Inside the app.asar, ONE line is appended to src/app/main/index.js that loads the
 * sidebar, and the two files from the "payload" folder are added. Everything else stays byte for byte
 * identical. The untouched original is kept next to it as app.asar.orig.
 *
 * Exodus locations checked automatically:
 *   Windows  %LOCALAPPDATA%\exodus\app-x.y.z\resources\app.asar
 *   macOS    /Applications/Exodus.app/Contents/Resources/app.asar
 *   Linux    /opt/Exodus/resources/app.asar (and other common paths, or `exodus` on PATH)
 *
 * Exodus updates ship a new build – just run "install" again afterwards. Your wallets are unaffected.
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execFileSync } = require('child_process')

const PAYLOAD_DIR = path.join(__dirname, 'payload')
const PAYLOAD_FILES = ['main.js', 'preload.js']
const MAIN_ENTRY = ['src', 'app', 'main', 'index.js']
const TARGET_DIR = ['src', 'app', 'wallet-switcher']
const MARKER = '/*exodus-wallets-sidebar*/'
const BLOCK_SIZE = 4 * 1024 * 1024

// The Exodus versions this add-on was built and tested against
// (Windows' latest is 26.8.27, macOS' latest is 26.8.26).
const TESTED_EXODUS = ['26.8.26', '26.8.27']
const TESTED_LABEL = TESTED_EXODUS.join(' / ')
const isTestedExodus = (v) => TESTED_EXODUS.includes(v)

const log = (...a) => console.log(...a)
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex')

// ---------------------------------------------------------------------------------------------
// asar lesen/schreiben
// ---------------------------------------------------------------------------------------------

function readAsar (file) {
  const fd = fs.openSync(file, 'r')
  try {
    const head = Buffer.alloc(16)
    fs.readSync(fd, head, 0, 16, 0)
    const headerPickleSize = head.readUInt32LE(4)
    const payloadSize = head.readUInt32LE(8)
    const strLen = head.readUInt32LE(12)
    if (head.readUInt32LE(0) !== 4 || payloadSize + 4 !== headerPickleSize || strLen > payloadSize) {
      throw new Error(`${file} hat kein bekanntes asar-Format.`)
    }
    const json = Buffer.alloc(strLen)
    fs.readSync(fd, json, 0, strLen, 16)
    const dataOffset = 8 + headerPickleSize
    return { file, header: JSON.parse(json.toString('utf8')), dataOffset, dataSize: fs.fstatSync(fd).size - dataOffset }
  } finally {
    fs.closeSync(fd)
  }
}

function getEntry (header, parts) {
  let node = header
  for (const p of parts) {
    if (!node || !node.files || !Object.prototype.hasOwnProperty.call(node.files, p)) return null
    node = node.files[p]
  }
  return node
}

function readEntry (asar, entry) {
  if (entry.unpacked) throw new Error('Ausgelagerte Datei (unpacked) wird nicht unterstützt.')
  const buf = Buffer.alloc(entry.size)
  const fd = fs.openSync(asar.file, 'r')
  try {
    fs.readSync(fd, buf, 0, entry.size, asar.dataOffset + Number(entry.offset))
  } finally {
    fs.closeSync(fd)
  }
  return buf
}

function integrity (buf) {
  const blocks = []
  for (let i = 0; i < buf.length; i += BLOCK_SIZE) blocks.push(sha256(buf.subarray(i, i + BLOCK_SIZE)))
  return { algorithm: 'SHA256', hash: sha256(buf), blockSize: BLOCK_SIZE, blocks }
}

function buildHeader (header) {
  const json = Buffer.from(JSON.stringify(header), 'utf8')
  const payloadSize = 4 + json.length + ((4 - (json.length % 4)) % 4)
  const pickle = Buffer.alloc(4 + payloadSize)
  pickle.writeUInt32LE(payloadSize, 0)
  pickle.writeUInt32LE(json.length, 4)
  json.copy(pickle, 8)
  const size = Buffer.alloc(8)
  size.writeUInt32LE(4, 0)
  size.writeUInt32LE(pickle.length, 4)
  return Buffer.concat([size, pickle])
}

function copyRange (srcFile, start, length, outFd) {
  const fd = fs.openSync(srcFile, 'r')
  const chunk = Buffer.alloc(4 * 1024 * 1024)
  try {
    let done = 0
    while (done < length) {
      const n = fs.readSync(fd, chunk, 0, Math.min(chunk.length, length - done), start + done)
      if (n <= 0) throw new Error('Unerwartetes Dateiende beim Kopieren.')
      fs.writeSync(outFd, chunk, 0, n)
      done += n
    }
  } finally {
    fs.closeSync(fd)
  }
}

const isPatched = (asar) => !!getEntry(asar.header, TARGET_DIR)

// ---------------------------------------------------------------------------------------------
// Exodus finden / prüfen
// ---------------------------------------------------------------------------------------------

function compareVersions (a, b) {
  const x = a.split('.').map(Number)
  const y = b.split('.').map(Number)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0)
    if (d) return d
  }
  return 0
}

// Windows keeps every version in its own folder (%LOCALAPPDATA%\exodus\app-x.y.z\resources\app.asar).
function winExodusBase () {
  return path.join(process.env.LOCALAPPDATA || '', 'exodus')
}

function winAppVersions () {
  let entries = []
  try { entries = fs.readdirSync(winExodusBase(), { withFileTypes: true }) } catch (e) {}
  return entries
    .filter((d) => d.isDirectory() && /^app-\d+(\.\d+)*$/.test(d.name))
    .map((d) => d.name)
    .sort((a, b) => compareVersions(a.slice(4), b.slice(4)))
}

// The app.asar sits under "resources" (Windows/Linux) or "Resources" (macOS).
function asarPathFor (appDir) {
  for (const res of ['resources', 'Resources']) {
    const p = path.join(appDir, res, 'app.asar')
    if (fs.existsSync(p) || fs.existsSync(p + '.orig')) return p
  }
  return path.join(appDir, 'resources', 'app.asar')
}

// Read Exodus' own version from package.json inside the asar (works on every platform). Prefers the
// untouched backup if present, so the version stays readable even after patching.
function exodusVersionFromAsar (asarPath) {
  const file = fs.existsSync(asarPath + '.orig') ? asarPath + '.orig' : asarPath
  try {
    const src = readAsar(file)
    const pkg = JSON.parse(readEntry(src, getEntry(src.header, ['package.json'])).toString('utf8'))
    return typeof pkg.version === 'string' ? pkg.version : null
  } catch (e) {
    return null
  }
}

// Every directory that could hold an Exodus app.asar, newest first, across all platforms.
function installedAppDirs () {
  const dirs = []
  const add = (d) => { if (d && !dirs.includes(d) && fs.existsSync(asarPathFor(d))) dirs.push(d) }
  if (process.platform === 'win32') {
    for (const name of winAppVersions().reverse()) add(path.join(winExodusBase(), name))
  } else if (process.platform === 'darwin') {
    for (const base of ['/Applications', path.join(process.env.HOME || '', 'Applications')]) {
      add(path.join(base, 'Exodus.app', 'Contents'))
    }
  } else {
    // Linux: common install locations plus whatever `exodus` on PATH resolves to
    const guesses = ['/opt/Exodus', '/opt/exodus', '/usr/lib/exodus', '/usr/share/exodus',
      path.join(process.env.HOME || '', '.local', 'share', 'exodus')]
    try {
      const p = execFileSync('sh', ['-c', 'readlink -f "$(command -v exodus 2>/dev/null)" 2>/dev/null'], { encoding: 'utf8' }).trim()
      if (p) guesses.unshift(path.dirname(p))
    } catch (e) {}
    for (const g of guesses) add(g)
  }
  return dirs
}

function findAppDir (explicit) {
  if (explicit) return path.resolve(explicit)
  const dirs = installedAppDirs()
  if (!dirs.length) {
    const where = process.platform === 'win32' ? winExodusBase()
      : process.platform === 'darwin' ? '/Applications/Exodus.app'
      : '/opt/Exodus'
    throw new Error(`No Exodus installation found (looked near ${where}). Pass --app "<path>" to point at it.`)
  }
  return dirs[0]
}

// On macOS, from …/Exodus.app/Contents/Resources/app.asar find the …/Exodus.app bundle.
function macAppBundle (asarPath) {
  let d = path.dirname(asarPath)
  for (let i = 0; i < 6; i++) {
    if (d.toLowerCase().endsWith('.app')) return d
    const up = path.dirname(d)
    if (up === d) break
    d = up
  }
  return null
}

// macOS refuses to launch a signed app once app.asar changed ("Exodus is damaged"). Re-sign the bundle
// ad-hoc so it opens again. This replaces Apple's notarized signature with a local one – reinstalling
// Exodus from the official DMG restores the original signature. No-op on Windows/Linux.
function resignMac (asarPath) {
  if (process.platform !== 'darwin') return
  const appBundle = macAppBundle(asarPath)
  if (!appBundle) { log('WARNING: could not locate the .app bundle. macOS may block the patched app.'); return }

  // 1) Clear quarantine – this is what causes "Exodus was downloaded on an unknown date".
  let unquarantined = false
  for (const args of [['-cr', appBundle], ['-rd', 'com.apple.quarantine', appBundle]]) {
    try { execFileSync('xattr', args, { stdio: 'ignore' }); unquarantined = true; break } catch (e) {}
  }

  // 2) Ad-hoc re-sign – required on Apple Silicon so the app runs at all after app.asar changed.
  let signed = false
  for (const args of [['--force', '--deep', '--sign', '-', appBundle], ['--force', '--sign', '-', appBundle]]) {
    try { execFileSync('codesign', args, { stdio: 'ignore' }); signed = true; break } catch (e) {}
  }

  if (signed && unquarantined) {
    log('Cleared quarantine and re-signed Exodus (ad-hoc) so macOS will open it.')
  } else {
    log('WARNING: could not fully prepare Exodus for macOS automatically.')
    log('Run these once in Terminal, then open Exodus:')
    log(`  sudo xattr -cr "${appBundle}"`)
    log(`  sudo codesign --force --deep --sign - "${appBundle}"`)
    log('If macOS still blocks it: in Finder, right-click Exodus -> Open, then confirm once')
    log('(or System Settings -> Privacy & Security -> "Open Anyway").')
  }
}

// Is an Exodus process currently running? Best-effort and cross-platform.
function exodusRunning () {
  try {
    if (process.platform === 'win32') {
      const out = execFileSync('tasklist', ['/FI', 'IMAGENAME eq Exodus.exe', '/NH'], { encoding: 'utf8', windowsHide: true })
      return /Exodus\.exe/i.test(out)
    }
    const out = execFileSync('ps', ['ax', '-o', 'comm,args'], { encoding: 'utf8' })
    return out.split(/\r?\n/).some((l) => /(^|\/|\s)[Ee]xodus(\s|$)/.test(l) && !/install\.js/.test(l))
  } catch (e) {
    return false // if we cannot tell, don't block the user
  }
}

// ---------------------------------------------------------------------------------------------
// Befehle
// ---------------------------------------------------------------------------------------------

function install (appDir, opts = {}) {
  const asarPath = asarPathFor(appDir)
  const backupPath = asarPath + '.orig'
  if (!fs.existsSync(asarPath) && !fs.existsSync(backupPath)) throw new Error(`Not found: ${asarPath}`)
  if (exodusRunning()) throw new Error('Exodus is still running. Please quit Exodus completely and try again.')

  // Is a suitable Exodus version installed? Warn on a mismatch, but don't block – newer versions may
  // work, and we don't want to lock people out. This is the "is a suitable Exodus here?" check.
  const exodusVer = exodusVersionFromAsar(asarPath)
  if (!exodusVer) {
    log(`Note: could not read the Exodus version. This add-on was built and tested for Exodus ${TESTED_LABEL}.`)
  } else if (!isTestedExodus(exodusVer)) {
    log(`Note: found Exodus ${exodusVer}, but this add-on was built and tested for ${TESTED_LABEL}.`)
    log('      It may still work. If the sidebar misbehaves, this version difference is the first thing to check.')
  } else {
    log(`Found Exodus ${exodusVer} (a tested version).`)
  }

  const payload = PAYLOAD_FILES.map((name) => ({ name, buf: fs.readFileSync(path.join(PAYLOAD_DIR, name)) }))
  if (opts.testHook) payload.push({ name: 'selftest.js', buf: fs.readFileSync(opts.testHook) })

  // Always build from the untouched original
  let source
  if (fs.existsSync(backupPath)) {
    source = readAsar(backupPath)
    if (isPatched(source)) throw new Error(`The backup ${backupPath} is itself modified. Please reinstall Exodus.`)
  } else if (isPatched(readAsar(asarPath))) {
    throw new Error('Exodus is already modified, but the backup (app.asar.orig) is missing. Please reinstall Exodus.')
  } else {
    fs.copyFileSync(asarPath, backupPath)
    log(`Backup of the original created: ${backupPath}`)
    source = readAsar(backupPath)
  }

  const header = JSON.parse(JSON.stringify(source.header))
  const mainEntry = getEntry(header, MAIN_ENTRY)
  if (!mainEntry || mainEntry.files) throw new Error('src/app/main/index.js not found – this Exodus version is not supported.')
  const mainBuf = readEntry(source, mainEntry)
  if (mainBuf.includes(MARKER)) throw new Error('The original already contains the sidebar – please reinstall Exodus.')

  // Sanity check: does this Exodus version still use the building blocks we rely on?
  const mainText = mainBuf.toString('utf8')
  for (const needle of ['persist:main', 'setPath("userData"', 'datadir']) {
    if (!mainText.includes(needle)) log(`WARNING: "${needle}" not found – the sidebar may not work with this Exodus version.`)
  }

  // Exodus overrides require() and only allows certain modules, so main.js is inlined instead of
  // required. preload.js is loaded separately via registerPreloadScript/setPreloads.
  const mainPayload = payload.find((f) => f.name === 'main.js')
  let inlineCode = mainPayload.buf.toString('utf8')
  // Drop the trailing module.exports – not needed when inlined
  inlineCode = inlineCode.replace(/\n*module\.exports\s*=\s*\{[^}]*\}\s*;?\s*$/, '')
  // When inlined, __dirname points at src/app/main/ instead of wallet-switcher/, so fix the PRELOAD path
  inlineCode = inlineCode.replace(
    /const PRELOAD\s*=\s*path\.join\(__dirname,\s*['"]preload\.js['"]\)/,
    "const PRELOAD = path.join(__dirname, '..', 'wallet-switcher', 'preload.js')"
  )
  // Wrap in an IIFE to keep the global scope clean
  const wrappedCode = `\n;${MARKER}(function(){\n${inlineCode}\n})();\n`
  const newMain = Buffer.concat([mainBuf, Buffer.from(wrappedCode, 'utf8')])

  // New/changed files are appended after the untouched original data
  const appended = []
  let offset = source.dataSize
  const place = (entry, buf) => {
    entry.size = buf.length
    entry.offset = String(offset)
    entry.integrity = integrity(buf)
    delete entry.unpacked
    appended.push(buf)
    offset += buf.length
  }
  place(mainEntry, newMain)
  const appNode = getEntry(header, TARGET_DIR.slice(0, -1))
  appNode.files[TARGET_DIR[TARGET_DIR.length - 1]] = { files: {} }
  const targetNode = getEntry(header, TARGET_DIR)
  for (const f of payload) {
    targetNode.files[f.name] = {}
    place(targetNode.files[f.name], f.buf)
  }

  const tmpPath = asarPath + '.new'
  const headerBuf = buildHeader(header)
  const out = fs.openSync(tmpPath, 'w')
  try {
    fs.writeSync(out, headerBuf)
    copyRange(source.file, source.dataOffset, source.dataSize, out)
    for (const buf of appended) fs.writeSync(out, buf)
  } finally {
    fs.closeSync(out)
  }

  // Verify the result before replacing the original
  const check = readAsar(tmpPath)
  const same = (parts, expected) => readEntry(check, getEntry(check.header, parts)).equals(expected)
  if (!same(MAIN_ENTRY, newMain)) throw new Error('Verification failed (main/index.js).')
  for (const f of payload) if (!same([...TARGET_DIR, f.name], f.buf)) throw new Error(`Verification failed (${f.name}).`)
  for (const parts of [['package.json'], ['src', 'static', 'exodus-prod.html'], ['src', 'app', 'preload', 'index.js']]) {
    const orig = getEntry(source.header, parts)
    if (orig && !same(parts, readEntry(source, orig))) throw new Error(`Verification failed (${parts.join('/')}).`)
  }

  fs.renameSync(tmpPath, asarPath)
  log(`Sidebar installed in: ${appDir}`)
  resignMac(asarPath)
}

function uninstall (appDir) {
  const asarPath = asarPathFor(appDir)
  const backupPath = asarPath + '.orig'
  if (!fs.existsSync(backupPath)) {
    if (fs.existsSync(asarPath) && isPatched(readAsar(asarPath))) throw new Error('Backup (app.asar.orig) is missing. Please reinstall Exodus.')
    log(`The sidebar is not installed in ${appDir} – nothing to do.`)
    return
  }
  if (exodusRunning()) throw new Error('Exodus is still running. Please quit Exodus completely and try again.')
  if (isPatched(readAsar(backupPath))) throw new Error('The backup is itself modified. Please reinstall Exodus.')
  fs.renameSync(backupPath, asarPath)
  log(`Original restored: ${asarPath}`)
  // Restoring the original app.asar again breaks the ad-hoc seal, so re-sign once more. To get Apple's
  // notarized signature back, reinstall Exodus from the official DMG.
  resignMac(asarPath)
}

function status (appDir) {
  const dirs = installedAppDirs()
  if (!dirs.length) { log('No Exodus installation found.'); return }
  for (const dir of dirs) {
    const asarPath = asarPathFor(dir)
    let state = 'app.asar missing'
    if (fs.existsSync(asarPath)) {
      const asar = readAsar(asarPath)
      if (isPatched(asar)) {
        const main = readEntry(asar, getEntry(asar.header, [...TARGET_DIR, 'main.js'])).toString('utf8')
        const m = main.match(/const VERSION = '([^']+)'/)
        state = `sidebar installed (v${m ? m[1] : '?'})`
      } else {
        state = 'original (no sidebar)'
      }
      if (fs.existsSync(asarPath + '.orig')) state += ', backup present'
    }
    const ver = exodusVersionFromAsar(asarPath)
    const verNote = ver ? `Exodus ${ver}${isTestedExodus(ver) ? '' : ` (tested: ${TESTED_LABEL})`} – ` : ''
    const active = path.resolve(dir) === path.resolve(appDir) ? '  <- will be used' : ''
    log(`${dir}: ${verNote}${state}${active}`)
  }
}

function parseArgs (argv) {
  const opts = {}
  const positional = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--app' || argv[i] === '--test-hook') opts[argv[i].slice(2)] = argv[++i]
    else positional.push(argv[i])
  }
  return { command: (positional[0] || 'status').toLowerCase(), app: opts.app, testHook: opts['test-hook'] }
}

function main () {
  const { command, app, testHook } = parseArgs(process.argv.slice(2))
  const appDir = findAppDir(app)

  if (command === 'install') {
    install(appDir, { testHook })
    log('')
    log('Done! Start Exodus – the wallet button is now at the top left, before the logo.')
    log('After an Exodus update, just run this installer again.')
  } else if (command === 'uninstall') {
    uninstall(appDir)
    log('The sidebar has been removed. Your wallets are kept (Exodus-Wallets in your app-data folder).')
  } else if (command === 'status') {
    status(appDir)
  } else {
    throw new Error(`Unknown command "${command}". Allowed: install, uninstall, status`)
  }
}

try {
  main()
} catch (e) {
  console.error('')
  console.error('ERROR: ' + e.message)
  process.exitCode = 1
}
