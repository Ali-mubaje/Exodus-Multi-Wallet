#!/usr/bin/env node
'use strict'
/*
 * Exodus Wallet-Seitenleiste – Installer
 *
 *   node install.js install     Seitenleiste in die neueste Exodus-Version einbauen (legt vorher ein Backup an)
 *   node install.js uninstall   Original-Exodus aus dem Backup wiederherstellen
 *   node install.js status      Zeigt, ob die Seitenleiste installiert ist
 *
 * Optionen:
 *   --app "<Pfad zu ...\exodus\app-x.y.z>"   bestimmte Exodus-Version statt der neuesten
 *
 * Was wird geändert? In resources\app.asar wird am Ende von src/app/main/index.js EINE Zeile angehängt,
 * die src/app/wallet-switcher/main.js lädt, und die beiden Dateien aus dem Ordner "payload" werden
 * hinzugefügt. Sonst bleibt alles Byte für Byte gleich. Das Original liegt als app.asar.orig daneben.
 *
 * Exodus-Updates installieren eine neue Programmversion (neuer Ordner app-x.y.z) – danach einfach
 * erneut "install" ausführen. Die Wallets selbst sind davon nicht betroffen.
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

function exodusBase () {
  return path.join(process.env.LOCALAPPDATA || '', 'exodus')
}

function appVersions () {
  let entries = []
  try { entries = fs.readdirSync(exodusBase(), { withFileTypes: true }) } catch (e) {}
  return entries
    .filter((d) => d.isDirectory() && /^app-\d+(\.\d+)*$/.test(d.name))
    .map((d) => d.name)
    .sort((a, b) => compareVersions(a.slice(4), b.slice(4)))
}

function findAppDir (explicit) {
  if (explicit) return path.resolve(explicit)
  const versions = appVersions()
  if (!versions.length) throw new Error(`Keine Exodus-Installation gefunden (${exodusBase()}).`)
  return path.join(exodusBase(), versions[versions.length - 1])
}

function exodusRunningFrom (appDir) {
  let out = ''
  try {
    out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      'Get-Process -Name Exodus -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Path'],
    { encoding: 'utf8', windowsHide: true })
  } catch (e) {
    return false
  }
  const prefix = path.resolve(appDir).toLowerCase() + path.sep
  return out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    .some((p) => path.resolve(p).toLowerCase().startsWith(prefix))
}

// ---------------------------------------------------------------------------------------------
// Befehle
// ---------------------------------------------------------------------------------------------

function install (appDir, opts = {}) {
  const asarPath = path.join(appDir, 'resources', 'app.asar')
  const backupPath = asarPath + '.orig'
  if (!fs.existsSync(asarPath)) throw new Error(`Nicht gefunden: ${asarPath}`)
  if (exodusRunningFrom(appDir)) throw new Error('Exodus läuft noch. Bitte alle Exodus-Fenster schließen und erneut versuchen.')

  const payload = PAYLOAD_FILES.map((name) => ({ name, buf: fs.readFileSync(path.join(PAYLOAD_DIR, name)) }))
  if (opts.testHook) payload.push({ name: 'selftest.js', buf: fs.readFileSync(opts.testHook) })

  // Immer vom unveränderten Original ausgehen
  const current = readAsar(asarPath)
  let source
  if (fs.existsSync(backupPath)) {
    source = readAsar(backupPath)
    if (isPatched(source)) throw new Error(`Das Backup ${backupPath} ist selbst verändert. Bitte Exodus neu installieren.`)
  } else if (isPatched(current)) {
    throw new Error('Exodus ist bereits verändert, aber das Backup (app.asar.orig) fehlt. Bitte Exodus neu installieren.')
  } else {
    fs.copyFileSync(asarPath, backupPath)
    log(`Backup des Originals angelegt: ${backupPath}`)
    source = readAsar(backupPath)
  }

  const header = JSON.parse(JSON.stringify(source.header))
  const mainEntry = getEntry(header, MAIN_ENTRY)
  if (!mainEntry || mainEntry.files) throw new Error('src/app/main/index.js nicht gefunden – diese Exodus-Version wird nicht unterstützt.')
  const mainBuf = readEntry(source, mainEntry)
  if (mainBuf.includes(MARKER)) throw new Error('Das Original enthält bereits die Seitenleiste – bitte Exodus neu installieren.')

  // Plausibilitätsprüfung: nutzt diese Exodus-Version noch die erwarteten Bausteine?
  const mainText = mainBuf.toString('utf8')
  for (const needle of ['persist:main', 'setPath("userData"', 'datadir']) {
    if (!mainText.includes(needle)) log(`WARNUNG: "${needle}" nicht gefunden – die Seitenleiste funktioniert evtl. nicht mit dieser Exodus-Version.`)
  }

  // Exodus hat require() überschrieben und erlaubt nur bestimmte Module.
  // Daher wird main.js direkt inlined statt per require() geladen.
  // Die preload.js wird separat über registerPreloadScript/setPreloads geladen.
  const mainPayload = payload.find((f) => f.name === 'main.js')
  let inlineCode = mainPayload.buf.toString('utf8')
  // module.exports am Ende entfernen - wird beim Inlining nicht gebraucht
  inlineCode = inlineCode.replace(/\n*module\.exports\s*=\s*\{[^}]*\}\s*;?\s*$/, '')
  // __dirname zeigt beim Inlining auf src/app/main/ statt wallet-switcher/
  // Daher PRELOAD-Pfad korrigieren: von main/ nach wallet-switcher/preload.js
  inlineCode = inlineCode.replace(
    /const PRELOAD\s*=\s*path\.join\(__dirname,\s*['"]preload\.js['"]\)/,
    "const PRELOAD = path.join(__dirname, '..', 'wallet-switcher', 'preload.js')"
  )
  // In IIFE wrappen um globalen Scope sauber zu halten
  const wrappedCode = `\n;${MARKER}(function(){\n${inlineCode}\n})();\n`
  const newMain = Buffer.concat([mainBuf, Buffer.from(wrappedCode, 'utf8')])

  // Neue/geänderte Dateien werden hinter die unveränderten Originaldaten angehängt
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

  const tmpPath = asarPath + '.neu'
  const headerBuf = buildHeader(header)
  const out = fs.openSync(tmpPath, 'w')
  try {
    fs.writeSync(out, headerBuf)
    copyRange(source.file, source.dataOffset, source.dataSize, out)
    for (const buf of appended) fs.writeSync(out, buf)
  } finally {
    fs.closeSync(out)
  }

  // Ergebnis prüfen, bevor das Original ersetzt wird
  const check = readAsar(tmpPath)
  const same = (parts, expected) => readEntry(check, getEntry(check.header, parts)).equals(expected)
  if (!same(MAIN_ENTRY, newMain)) throw new Error('Prüfung fehlgeschlagen (main/index.js).')
  for (const f of payload) if (!same([...TARGET_DIR, f.name], f.buf)) throw new Error(`Prüfung fehlgeschlagen (${f.name}).`)
  for (const parts of [['package.json'], ['src', 'static', 'exodus-prod.html'], ['src', 'app', 'preload', 'index.js']]) {
    const orig = getEntry(source.header, parts)
    if (orig && !same(parts, readEntry(source, orig))) throw new Error(`Prüfung fehlgeschlagen (${parts.join('/')}).`)
  }

  fs.renameSync(tmpPath, asarPath)
  log(`Seitenleiste installiert in: ${appDir}`)
}

function uninstall (appDir) {
  const asarPath = path.join(appDir, 'resources', 'app.asar')
  const backupPath = asarPath + '.orig'
  if (!fs.existsSync(backupPath)) {
    if (fs.existsSync(asarPath) && isPatched(readAsar(asarPath))) throw new Error('Backup (app.asar.orig) fehlt. Bitte Exodus neu installieren.')
    log(`Die Seitenleiste ist in ${appDir} nicht installiert – nichts zu tun.`)
    return
  }
  if (exodusRunningFrom(appDir)) throw new Error('Exodus läuft noch. Bitte alle Exodus-Fenster schließen und erneut versuchen.')
  if (isPatched(readAsar(backupPath))) throw new Error('Das Backup ist selbst verändert. Bitte Exodus neu installieren.')
  fs.renameSync(backupPath, asarPath)
  log(`Original wiederhergestellt: ${asarPath}`)
}

function status (appDir) {
  for (const name of appVersions()) {
    const dir = path.join(exodusBase(), name)
    const asarPath = path.join(dir, 'resources', 'app.asar')
    let state = 'app.asar fehlt'
    if (fs.existsSync(asarPath)) {
      const asar = readAsar(asarPath)
      if (isPatched(asar)) {
        const main = readEntry(asar, getEntry(asar.header, [...TARGET_DIR, 'main.js'])).toString('utf8')
        const m = main.match(/const VERSION = '([^']+)'/)
        state = `Seitenleiste installiert (v${m ? m[1] : '?'})`
      } else {
        state = 'Original (ohne Seitenleiste)'
      }
      if (fs.existsSync(asarPath + '.orig')) state += ', Backup vorhanden'
    }
    const newest = path.resolve(dir) === path.resolve(appDir) ? '  <- wird gestartet' : ''
    log(`${name}: ${state}${newest}`)
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
    log('Fertig! Starte Exodus – links oben vor dem Logo ist jetzt der Wallet-Knopf.')
    log('Nach einem Exodus-Update diesen Installer einfach erneut ausführen.')
  } else if (command === 'uninstall') {
    uninstall(appDir)
    log('Die Seitenleiste ist entfernt. Deine Wallets bleiben erhalten (%APPDATA%\\Exodus-Wallets).')
  } else if (command === 'status') {
    status(appDir)
  } else {
    throw new Error(`Unbekannter Befehl "${command}". Erlaubt: install, uninstall, status`)
  }
}

try {
  main()
} catch (e) {
  console.error('')
  console.error('FEHLER: ' + e.message)
  process.exitCode = 1
}
