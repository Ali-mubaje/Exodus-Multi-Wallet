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
 *   --json                                 (status) print the state of the install that would be used,
 *                                          as JSON – update.js reads this
 *   --install-updater                      (install) also keep the update.js next to this file as the
 *                                          local updater. update.js passes this after it verified the
 *                                          signed release this file came from.
 *
 * What changes? Inside the app.asar, ONE line is appended to src/app/main/index.js that loads the
 * sidebar, and the two files from the "payload" folder are added. Everything else stays byte for byte
 * identical. The untouched original is kept next to it as app.asar.orig. On macOS the app bundle is
 * re-signed locally afterwards (see "macOS code signature" below).
 *
 * Exodus locations checked automatically:
 *   Windows  %LOCALAPPDATA%\exodus\app-x.y.z\resources\app.asar
 *   macOS    /Applications/Exodus.app/Contents/Resources/app.asar
 *   Linux    /opt/Exodus/resources/app.asar (and other common paths, or `exodus` on PATH)
 *
 * Exodus updates ship a new build – just run "install" again afterwards. Your wallets are unaffected.
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const zlib = require('zlib')
const crypto = require('crypto')
const { spawnSync } = require('child_process')

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

// Every external program runs through sys.run, and the platform is read from sys.platform, so the tests
// can swap both and check the macOS / Windows command sequences on any machine. No shell is involved.
const sys = {
  platform: process.platform,
  run (file, args) {
    const r = spawnSync(file, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 })
    return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error || null }
  }
}
const run = (file, args) => sys.run(file, args)
const succeeded = (r) => !r.error && r.status === 0
const firstLine = (r) => (r.error ? r.error.message : `${r.stderr}\n${r.stdout}`.trim().split(/\r?\n/)[0]) ||
  `exit code ${r.status}`

// Absolute tool paths, so nothing on PATH can stand in for them.
const MAC = {
  codesign: '/usr/bin/codesign',
  xattr: '/usr/bin/xattr',
  plistBuddy: '/usr/libexec/PlistBuddy',
  ps: '/bin/ps'
}
const winSystemTool = (exe) => path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', exe)
const linuxTool = (name) => [`/bin/${name}`, `/usr/bin/${name}`].find((p) => fs.existsSync(p)) || `/bin/${name}`

function rmrf (p) {
  if (fs.rmSync) return fs.rmSync(p, { recursive: true, force: true })
  if (!fs.existsSync(p)) return
  if (fs.statSync(p).isDirectory()) fs.rmdirSync(p, { recursive: true })
  else fs.unlinkSync(p)
}

// ---------------------------------------------------------------------------------------------
// Read / write asar
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
      throw new Error(`${file} is not in a known asar format.`)
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
  if (entry.unpacked) throw new Error('Unpacked files (app.asar.unpacked) are not supported.')
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
      if (n <= 0) throw new Error('Unexpected end of file while copying.')
      fs.writeSync(outFd, chunk, 0, n)
      done += n
    }
  } finally {
    fs.closeSync(fd)
  }
}

const isPatched = (asar) => !!getEntry(asar.header, TARGET_DIR)

// ---------------------------------------------------------------------------------------------
// Find / check Exodus
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
  if (sys.platform === 'win32') {
    for (const name of winAppVersions().reverse()) add(path.join(winExodusBase(), name))
  } else if (sys.platform === 'darwin') {
    for (const base of ['/Applications', path.join(process.env.HOME || '', 'Applications')]) {
      add(path.join(base, 'Exodus.app', 'Contents'))
    }
  } else {
    // Linux: common install locations plus whatever `exodus` on PATH resolves to
    const guesses = ['/opt/Exodus', '/opt/exodus', '/usr/lib/exodus', '/usr/share/exodus',
      path.join(process.env.HOME || '', '.local', 'share', 'exodus')]
    const r = run('/bin/sh', ['-c', 'readlink -f "$(command -v exodus 2>/dev/null)" 2>/dev/null'])
    const p = succeeded(r) ? r.stdout.trim() : ''
    if (p) guesses.unshift(path.dirname(p))
    for (const g of guesses) add(g)
  }
  return dirs
}

function findAppDir (explicit) {
  if (explicit) return path.resolve(explicit)
  const dirs = installedAppDirs()
  if (!dirs.length) {
    const where = sys.platform === 'win32' ? winExodusBase()
      : sys.platform === 'darwin' ? '/Applications/Exodus.app'
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

// Is an Exodus process currently running? If the check itself fails we stop instead of guessing "no":
// patching or restoring app.asar underneath a running Exodus could leave it half-updated.
function exodusRunning () {
  const win = sys.platform === 'win32'
  const tool = win ? winSystemTool('tasklist.exe') : sys.platform === 'darwin' ? MAC.ps : linuxTool('ps')
  const r = win
    ? run(tool, ['/FI', 'IMAGENAME eq Exodus.exe', '/FO', 'CSV', '/NH'])
    : run(tool, ['ax', '-o', 'comm,args'])
  if (!succeeded(r)) {
    throw new Error(`Could not check whether Exodus is running (${tool}: ${firstLine(r)}), so nothing was changed. ` +
      'Make sure Exodus is closed and that this check can run, then try again.')
  }
  if (win) return /^"Exodus\.exe"/im.test(r.stdout)
  return r.stdout.split(/\r?\n/).some((l) => /(^|\/|\s)[Ee]xodus(\s|$)/.test(l) && !/(install|update)\.js/.test(l))
}

// ---------------------------------------------------------------------------------------------
// macOS code signature
// ---------------------------------------------------------------------------------------------
//
// Exodus is signed with Exodus' Developer ID and notarized. Changing app.asar breaks the seal of the
// outer app bundle and macOS refuses to open it ("Exodus is damaged"). So around patching we:
//   1. back up the original signature once – the main executable and Contents/_CodeSignature/
//      CodeResources, the only two files codesign rewrites when it signs the outer bundle – into
//      Contents/Resources/wallet-switcher-signature.orig/ (next to app.asar.orig),
//   2. re-sign ONLY the outer bundle, ad-hoc. No --deep: the frameworks and helpers inside keep Exodus'
//      own signatures. The entitlements are kept. The Hardened Runtime is kept only if the entitlements
//      disable library validation – otherwise an ad-hoc main executable (no Team ID) could not load the
//      Team-signed Electron framework. The designated requirement is NOT kept: it names Exodus' Team ID,
//      which an ad-hoc signature can't satisfy. That is also why Exodus' own auto-updater may reject
//      updates while the sidebar is installed,
//   3. remove only the quarantine flag, so Gatekeeper doesn't block the now locally signed app,
//   4. verify the result.
// Uninstall puts app.asar, the executable and CodeResources back, removes the backup and verifies that
// Exodus' original signature is valid again.

const SIGNATURE_BACKUP = 'wallet-switcher-signature.orig'
const NO_LIBRARY_VALIDATION = 'com.apple.security.cs.disable-library-validation'
const EXODUS_DOWNLOAD = 'https://www.exodus.com/download/'

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

const isPlainName = (n) => typeof n === 'string' && /^[^/\\\0]+$/.test(n) && n !== '.' && n !== '..'

// The files of the bundle that signing touches, plus where their backup lives.
function macBundle (asarPath) {
  const app = macAppBundle(asarPath)
  if (!app) return null
  const contents = path.join(app, 'Contents')
  const r = run(MAC.plistBuddy, ['-c', 'Print :CFBundleExecutable', path.join(contents, 'Info.plist')])
  let exeName = succeeded(r) ? r.stdout.trim() : ''
  if (!isPlainName(exeName)) exeName = path.basename(app).replace(/\.app$/i, '')
  return {
    app,
    exeName,
    exe: path.join(contents, 'MacOS', exeName),
    codeResources: path.join(contents, '_CodeSignature', 'CodeResources'),
    backupDir: path.join(path.dirname(asarPath), SIGNATURE_BACKUP)
  }
}

// Who signed the bundle right now: Exodus' Developer ID, an ad-hoc signature, nobody, or unknown.
function macSignature (app) {
  const r = run(MAC.codesign, ['-d', '--verbose=2', app])
  const text = `${r.stdout}\n${r.stderr}` // codesign -d reports on stderr
  if (/not signed at all/i.test(text)) return { kind: 'unsigned' }
  if (!succeeded(r)) return { kind: 'unknown', detail: firstLine(r) }
  if (/^Signature=adhoc\s*$/m.test(text)) return { kind: 'ad-hoc' }
  const team = ((text.match(/^TeamIdentifier=(.+)$/m) || [])[1] || '').trim()
  if (/^Authority=Developer ID Application:/m.test(text) && team && team !== 'not set') return { kind: 'developer-id', team }
  return { kind: 'unknown' }
}

function describeSignature (sig) {
  if (sig.kind === 'developer-id') return `original Exodus Developer ID signature (team ${sig.team})`
  if (sig.kind === 'ad-hoc') return 'ad-hoc signature (re-signed locally by this installer)'
  if (sig.kind === 'unsigned') return 'not signed'
  return 'signature unknown'
}

function macVerify (app, deep) {
  const r = run(MAC.codesign, ['--verify', ...(deep ? ['--deep'] : []), '--strict', app])
  return { valid: succeeded(r), detail: succeeded(r) ? '' : firstLine(r) }
}

// The entitlements of the current signature as plist XML ('' = none), or null if they can't be read.
function macEntitlements (app) {
  for (const args of [['-d', '--entitlements', '-', '--xml', app], ['-d', '--entitlements', ':-', app]]) {
    const r = run(MAC.codesign, args)
    if (succeeded(r)) return r.stdout
  }
  return null
}

const hasEntitlement = (xml, key) =>
  new RegExp(`<key>\\s*${key.replace(/\./g, '\\.')}\\s*</key>\\s*<true\\s*/>`).test(xml || '')

function readSignatureBackup (b) {
  try {
    const info = JSON.parse(fs.readFileSync(path.join(b.backupDir, 'info.json'), 'utf8'))
    return info && isPlainName(info.executable) ? info : null
  } catch (e) {
    return null
  }
}

// Save the two files re-signing rewrites. The executable is stored gzip-compressed: a raw Mach-O file in
// Contents/Resources would be treated as nested code by codesign and break signing and verification.
function backupMacSignature (b, sig) {
  const exe = fs.readFileSync(b.exe)
  const codeResources = fs.readFileSync(b.codeResources)
  const tmp = b.backupDir + '.tmp'
  rmrf(tmp)
  try {
    fs.mkdirSync(tmp)
    fs.writeFileSync(path.join(tmp, b.exeName + '.gz'), zlib.gzipSync(exe))
    fs.writeFileSync(path.join(tmp, 'CodeResources'), codeResources)
    fs.writeFileSync(path.join(tmp, 'info.json'), JSON.stringify({
      executable: b.exeName,
      team: sig.team,
      executableSha256: sha256(exe),
      codeResourcesSha256: sha256(codeResources)
    }, null, 2))
    rmrf(b.backupDir)
    fs.renameSync(tmp, b.backupDir)
  } catch (e) {
    rmrf(tmp)
    throw e
  }
}

// Put a file back as a NEW file with the old mode: macOS caches code signatures per file, so rewriting a
// signed binary in place can get it killed on the next launch.
function replaceFile (file, buf, defaultMode) {
  let mode = defaultMode
  try { mode = fs.statSync(file).mode & 0o7777 } catch (e) {}
  const tmp = file + '.wallet-switcher-tmp'
  fs.writeFileSync(tmp, buf, { mode })
  fs.chmodSync(tmp, mode)
  fs.renameSync(tmp, file)
}

// Before app.asar is replaced: back up the original signature (first time only) and read what the
// re-sign has to keep. Throws if the backup fails, so nothing is patched without it.
function prepareMacSignature (asarPath) {
  if (sys.platform !== 'darwin') return null
  const b = macBundle(asarPath)
  if (!b) { log('WARNING: could not locate the .app bundle. macOS may block the patched app.'); return null }
  const sig = macSignature(b.app)
  const backup = readSignatureBackup(b)
  if (sig.kind === 'developer-id') {
    // The app carries Exodus' own signature right now: that is what uninstall must be able to restore.
    if (!backup || backup.executableSha256 !== sha256(fs.readFileSync(b.exe))) {
      backupMacSignature(b, sig)
      log(`Backed up Exodus' original signature (team ${sig.team}) to ${b.backupDir}`)
    }
  } else if (!backup) {
    log(`Note: Exodus does not carry its original signature right now (${describeSignature(sig)}),`)
    log('      so there is nothing to back up – uninstalling can\'t bring the official signature back.')
    log(`      For that, reinstall Exodus from ${EXODUS_DOWNLOAD} (and then run this installer again).`)
  }
  const entitlements = macEntitlements(b.app)
  return { ...b, entitlementsRead: entitlements !== null, runtime: hasEntitlement(entitlements, NO_LIBRARY_VALIDATION) }
}

// Re-sign the outer bundle ad-hoc (see above) and verify it. Returns true if the result verified.
function signMac (plan) {
  if (!plan) return false
  // Only the quarantine flag goes – not every extended attribute.
  run(MAC.xattr, ['-dr', 'com.apple.quarantine', plan.app])
  const quarantined = succeeded(run(MAC.xattr, ['-p', 'com.apple.quarantine', plan.app]))

  if (!plan.runtime) {
    log(plan.entitlementsRead
      ? `Note: Exodus' entitlements don't include ${NO_LIBRARY_VALIDATION},`
      : 'WARNING: could not read Exodus\' entitlements,')
    log('      so Exodus is re-signed WITHOUT the Hardened Runtime (with it, the locally signed app could')
    log('      not load Exodus\' own Team-signed frameworks). Exodus\' entitlements are kept.')
  }
  const args = ['--force', '--sign', '-', '--preserve-metadata=entitlements']
  if (plan.runtime) args.push('--options', 'runtime')
  args.push(plan.app)
  const s = run(MAC.codesign, args)
  const v = succeeded(s) ? macVerify(plan.app, false) : { valid: false, detail: firstLine(s) }

  if (v.valid) {
    log(`Re-signed Exodus locally (outer app bundle only, entitlements kept${plan.runtime ? ', Hardened Runtime kept' : ''}) – signature verified.`)
  } else {
    log(`WARNING: re-signing Exodus did not verify (${v.detail}). macOS may refuse to open it.`)
    log('Quit Exodus and run this once in Terminal, then open Exodus:')
    log(`  codesign --force --sign - --preserve-metadata=entitlements "${plan.app}"`)
    log('Or reinstall Exodus from ' + EXODUS_DOWNLOAD + ' to get the original back.')
  }
  if (quarantined) {
    log('WARNING: could not remove the quarantine flag. If macOS blocks Exodus, run once in Terminal:')
    log(`  xattr -dr com.apple.quarantine "${plan.app}"`)
  }
  return v.valid
}

// After app.asar.orig is back in place: restore the original signature files and check the result.
function restoreMacSignature (asarPath) {
  if (sys.platform !== 'darwin') return
  const b = macBundle(asarPath)
  if (!b) { log('WARNING: could not locate the .app bundle to restore its signature.'); return }
  const backup = readSignatureBackup(b)
  if (backup) {
    let exe, codeResources
    try {
      exe = zlib.gunzipSync(fs.readFileSync(path.join(b.backupDir, backup.executable + '.gz')))
      codeResources = fs.readFileSync(path.join(b.backupDir, 'CodeResources'))
    } catch (e) {
      exe = null
    }
    if (!exe || sha256(exe) !== backup.executableSha256 || sha256(codeResources) !== backup.codeResourcesSha256) {
      throw new Error(`app.asar is restored, but the signature backup in ${b.backupDir} is damaged. ` +
        `Please reinstall Exodus from ${EXODUS_DOWNLOAD} to get its original signature back.`)
    }
    replaceFile(path.join(path.dirname(b.exe), backup.executable), exe, 0o755)
    replaceFile(b.codeResources, codeResources, 0o644)
    rmrf(b.backupDir)
    log('Restored Exodus\' original signature files.')
  } else {
    log('Note: no backup of the original signature (the sidebar was installed by an older version of this tool).')
  }

  const v = macVerify(b.app, true)
  const sig = macSignature(b.app)
  if (v.valid && sig.kind === 'developer-id') {
    log(`Checked: Exodus' original signature is valid again (Developer ID, team ${sig.team}).`)
    return
  }
  if (v.valid) {
    log(`Checked: the signature is valid (${describeSignature(sig)}). For the official signature, reinstall Exodus from ${EXODUS_DOWNLOAD}.`)
    return
  }
  if (!backup && sig.kind === 'ad-hoc') {
    // Installed by an older version: the ad-hoc seal still covers the patched app.asar. Re-sign so
    // Exodus keeps opening; the official signature only comes back with a reinstall.
    log('Exodus is still signed ad-hoc from the old install – re-signing it so it keeps opening.')
    const entitlements = macEntitlements(b.app)
    signMac({ ...b, entitlementsRead: entitlements !== null, runtime: hasEntitlement(entitlements, NO_LIBRARY_VALIDATION) })
    log(`To get the official Exodus signature back, reinstall Exodus from ${EXODUS_DOWNLOAD}.`)
    return
  }
  log(`WARNING: Exodus' original signature is NOT valid (${v.detail}).`)
  log(`Please reinstall Exodus from ${EXODUS_DOWNLOAD} – your wallets are not affected.`)
}

function printMacNotes () {
  log('')
  log('macOS notes:')
  log('- While the sidebar is installed, Exodus\' built-in auto-update may not work (the app is now')
  log(`  signed locally, not with Exodus' Team ID). To update Exodus, download it from ${EXODUS_DOWNLOAD},`)
  log('  install it, then run this installer (or the updater) again.')
  log('- First launch: if macOS shows a security prompt, open System Settings -> Privacy & Security and click')
  log('  "Open Anyway". This is only expected right after running this installer – never for an Exodus you')
  log('  just downloaded.')
}

// ---------------------------------------------------------------------------------------------
// Local updater
// ---------------------------------------------------------------------------------------------
//
// A copy of the verified update.js in a fixed per-user folder. Later updates run this copy, so its pinned
// release key is the trust anchor: a newer update.js only lands here after update.js verified the signed
// release it belongs to with the key of the copy that was here before.

function localUpdaterDir () {
  if (sys.platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Exodus-Multi-Wallet')
  }
  if (sys.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'Exodus-Multi-Wallet')
  return path.join(os.homedir(), '.local', 'share', 'exodus-multi-wallet')
}

const WIN_WRAPPER = [
  '@echo off',
  'REM Exodus Multi Wallet - local updater. Verifies signed releases with the key pinned in update.js.',
  'REM Usage: update.cmd [update, install, uninstall or status] [--version vX.Y.Z] [--yes]',
  'node "%~dp0update.js" %*',
  ''
].join('\r\n')

const SH_WRAPPER = [
  '#!/bin/sh',
  '# Exodus Multi Wallet - local updater. Verifies signed releases with the key pinned in update.js.',
  '# Usage: sh update.sh [update|install|uninstall|status] [--version vX.Y.Z] [--yes]',
  'exec node "$(dirname "$0")/update.js" "$@"',
  ''
].join('\n')

// Replace a file atomically, and only if its content changes (cmd.exe reads a running .cmd file line by
// line, so rewriting update.cmd while it runs must be avoided).
function writeIfChanged (file, buf, mode) {
  let same = false
  try { same = fs.readFileSync(file).equals(buf) } catch (e) {}
  if (!same) {
    const tmp = `${file}.${process.pid}.tmp`
    fs.writeFileSync(tmp, buf, { mode })
    fs.renameSync(tmp, file)
  }
  fs.chmodSync(file, mode)
}

// Returns the command to run the local updater, or null if it could not be set up.
function installLocalUpdater () {
  try {
    const buf = fs.readFileSync(path.join(__dirname, 'update.js'))
    const dir = localUpdaterDir()
    fs.mkdirSync(dir, { recursive: true })
    writeIfChanged(path.join(dir, 'update.js'), buf, 0o644)
    const win = sys.platform === 'win32'
    const wrapper = path.join(dir, win ? 'update.cmd' : 'update.sh')
    writeIfChanged(wrapper, Buffer.from(win ? WIN_WRAPPER : SH_WRAPPER, 'utf8'), win ? 0o644 : 0o755)
    log(`Local updater set up in ${dir}`)
    return win ? `"${wrapper}"` : `sh "${wrapper}"`
  } catch (e) {
    log(`WARNING: could not set up the local updater (${e.message}).`)
    log('         The sidebar is installed; for updates use the one-line installer from the README.')
    return null
  }
}

// ---------------------------------------------------------------------------------------------
// Commands
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
  let createdBackup = false
  if (fs.existsSync(backupPath)) {
    source = readAsar(backupPath)
    if (isPatched(source)) throw new Error(`The backup ${backupPath} is itself modified. Please reinstall Exodus.`)
  } else if (isPatched(readAsar(asarPath))) {
    throw new Error('Exodus is already modified, but the backup (app.asar.orig) is missing. Please reinstall Exodus.')
  } else {
    fs.copyFileSync(asarPath, backupPath)
    createdBackup = true
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

  // macOS: back up the original signature before anything in the bundle changes
  let macPlan
  try {
    macPlan = prepareMacSignature(asarPath)
  } catch (e) {
    rmrf(tmpPath)
    if (createdBackup) rmrf(backupPath) // an extra file would break Exodus' original seal
    throw new Error(`Could not back up Exodus' signature (${e.message}). Nothing was changed.`)
  }
  fs.renameSync(tmpPath, asarPath)
  log(`Sidebar installed in: ${appDir}`)
  signMac(macPlan)
}

// Returns true if the sidebar was removed, false if there was nothing to remove.
function uninstall (appDir) {
  const asarPath = asarPathFor(appDir)
  const backupPath = asarPath + '.orig'
  if (!fs.existsSync(backupPath)) {
    if (fs.existsSync(asarPath) && isPatched(readAsar(asarPath))) throw new Error('Backup (app.asar.orig) is missing. Please reinstall Exodus.')
    log(`The sidebar is not installed in ${appDir} – nothing to do.`)
    return false
  }
  if (exodusRunning()) throw new Error('Exodus is still running. Please quit Exodus completely and try again.')
  if (isPatched(readAsar(backupPath))) throw new Error('The backup is itself modified. Please reinstall Exodus.')
  fs.renameSync(backupPath, asarPath)
  log(`Original restored: ${asarPath}`)
  // macOS: put Exodus' original signature back (backed up at install) and verify it
  restoreMacSignature(asarPath)
  return true
}

function sidebarVersion (asar) {
  const entry = getEntry(asar.header, [...TARGET_DIR, 'main.js'])
  if (!entry || entry.files) return null
  const m = readEntry(asar, entry).toString('utf8').match(/const VERSION = '([^']+)'/)
  return m ? m[1] : null
}

// The state of one Exodus install (used by `status` and by update.js via `status --json`).
function appState (appDir) {
  const asarPath = asarPathFor(appDir)
  const state = {
    appDir,
    asar: asarPath,
    exists: fs.existsSync(asarPath),
    exodusVersion: exodusVersionFromAsar(asarPath),
    installed: false,
    sidebar: null,
    backup: fs.existsSync(asarPath + '.orig')
  }
  if (state.exists) {
    const asar = readAsar(asarPath)
    if (isPatched(asar)) { state.installed = true; state.sidebar = sidebarVersion(asar) }
  }
  if (sys.platform === 'darwin') {
    const b = macBundle(asarPath)
    if (b) {
      const sig = macSignature(b.app)
      state.signature = sig.kind
      if (sig.team) state.team = sig.team
      state.signatureBackup = fs.existsSync(b.backupDir)
    }
  }
  return state
}

function status (appDir) {
  const dirs = installedAppDirs()
  const listed = dirs.some((d) => path.resolve(d) === path.resolve(appDir))
  if (!listed && fs.existsSync(asarPathFor(appDir))) dirs.unshift(appDir) // an explicit --app elsewhere
  if (!dirs.length) { log('No Exodus installation found.'); return }
  for (const dir of dirs) {
    const s = appState(dir)
    let state = 'app.asar missing'
    if (s.exists) {
      state = s.installed ? `sidebar installed (v${s.sidebar || '?'})` : 'original (no sidebar)'
      if (s.backup) state += ', backup present'
    }
    if (s.signature) {
      state += `; ${describeSignature({ kind: s.signature, team: s.team })}`
      if (s.signatureBackup) state += ', original signature backed up'
    }
    const ver = s.exodusVersion
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
    else if (argv[i] === '--json') opts.json = true
    else if (argv[i] === '--install-updater') opts.installUpdater = true
    else positional.push(argv[i])
  }
  return {
    command: (positional[0] || 'status').toLowerCase(),
    app: opts.app,
    testHook: opts['test-hook'],
    json: !!opts.json,
    installUpdater: !!opts.installUpdater
  }
}

function main (argv = process.argv.slice(2)) {
  const { command, app, testHook, json, installUpdater } = parseArgs(argv)
  const appDir = findAppDir(app)

  if (command === 'install') {
    install(appDir, { testHook })
    const updater = installUpdater ? installLocalUpdater() : null
    log('')
    log('Done! Start Exodus – the wallet button is now at the top left, before the logo.')
    if (updater) {
      log('To update the sidebar later (and after every Exodus update), run the local updater:')
      log(`  ${updater}`)
    } else {
      log('After an Exodus update, just run this installer again.')
    }
    if (sys.platform === 'darwin') printMacNotes()
  } else if (command === 'uninstall') {
    if (uninstall(appDir)) {
      log('The sidebar has been removed. Your wallets are kept (Exodus-Wallets in your app-data folder).')
    }
  } else if (command === 'status') {
    if (json) console.log(JSON.stringify(appState(appDir)))
    else status(appDir)
  } else {
    throw new Error(`Unknown command "${command}". Allowed: install, uninstall, status`)
  }
}

module.exports = {
  sys,
  PAYLOAD_FILES,
  SIGNATURE_BACKUP,
  main,
  install,
  uninstall,
  status,
  appState,
  findAppDir,
  exodusRunning,
  macSignature,
  prepareMacSignature,
  signMac,
  restoreMacSignature,
  localUpdaterDir,
  installLocalUpdater
}

if (require.main === module) {
  try {
    main()
  } catch (e) {
    console.error('')
    console.error('ERROR: ' + e.message)
    process.exitCode = 1
  }
}
