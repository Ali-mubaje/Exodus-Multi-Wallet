#!/usr/bin/env node
'use strict'
/*
 * Exodus Multi Wallet – updater (Windows, macOS, Linux). Pure Node.js, no dependencies.
 *
 *   node update.js [update|install|uninstall|toggle|status] [options]
 *
 *   update      install the release unless that version is already installed (default)
 *   install     install (or reinstall) the release
 *   uninstall   remove the sidebar again (with the uninstaller of the verified release)
 *   toggle      uninstall if the sidebar is installed in the Exodus that would be used, else install
 *   status      show what is installed and which release is available
 *
 * Options:
 *   --version vX.Y.Z    use this release instead of the latest one
 *   --yes               don't ask before changing anything
 *   --allow-downgrade   allow a release older than the installed sidebar
 *   --app "<path>"      use a specific Exodus install (passed on to install.js)
 *
 * How a release is trusted:
 *   1. release-manifest.json and release-manifest.sig are downloaded from the GitHub release – https only,
 *      at most 5 redirects, and only to github.com / githubusercontent.com hosts.
 *   2. The Ed25519 signature over the manifest must verify with RELEASE_PUBLIC_KEY below, the key pinned
 *      in this file. The manifest names the version, the commit and the SHA-256 of every file.
 *   3. Every listed file is downloaded from raw.githubusercontent.com at exactly that commit and must
 *      match its SHA-256. Any mismatch aborts – nothing is installed.
 *   4. You see what is installed and what would be installed, and confirm.
 *   5. install.js from those verified files runs (no shell). After installing it keeps a copy of the
 *      verified update.js as the local updater in a per-user folder – the trust anchor for later updates:
 *      a newer update.js only replaces it after passing this check with the old key.
 *
 * The first install (the one-line installer, update.js downloaded from the latest release) is trust on
 * first use: this file checks that it is itself the update.js listed in the release it verified.
 * Key rotation is not supported yet – a new key needs a fresh install of the updater.
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const https = require('https')
const crypto = require('crypto')
const readline = require('readline')
const { spawnSync } = require('child_process')

const REPO = 'Ali-mubaje/Exodus-Multi-Wallet'
const MANIFEST_NAME = 'exodus-multi-wallet'

// The release signing key (Ed25519, base64 SPKI DER) printed by `node tools/release.js --keygen`.
// Fingerprint: f506 5a02 2274 b91b b9bc f8fc 2fb2 466c
const RELEASE_PUBLIC_KEY = 'MCowBQYDK2VwAyEAQZPBhl2oDdMhTSGeCWbJkkeJViz4rbuUFPvNyelAE50='

const ACTIONS = ['update', 'install', 'uninstall', 'toggle', 'status']
const VERSION_RE = /^\d{1,6}(\.\d{1,6}){1,3}$/
const MAX_REDIRECTS = 5
const LIMITS = {
  manifest: 64 * 1024,
  signature: 4 * 1024,
  file: 8 * 1024 * 1024,
  total: 32 * 1024 * 1024,
  files: 64
}
const IDLE_TIMEOUT_MS = 30 * 1000 // no data for this long -> abort
const DOWNLOAD_DEADLINE_MS = 3 * 60 * 1000 // one download may take at most this long

const log = (...a) => console.log(...a)
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex')
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k)

function rmrf (p) {
  if (fs.rmSync) return fs.rmSync(p, { recursive: true, force: true })
  if (fs.existsSync(p)) fs.rmdirSync(p, { recursive: true })
}

function compareVersions (a, b) {
  const x = a.split('.').map(Number)
  const y = b.split('.').map(Number)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0)
    if (d) return d
  }
  return 0
}

// ---------------------------------------------------------------------------------------------
// Release key
// ---------------------------------------------------------------------------------------------

function loadPinnedKey (b64 = RELEASE_PUBLIC_KEY) {
  if (/PLACEHOLDER/.test(b64)) {
    throw new Error('This update.js has no release key yet (it still holds the placeholder), so it cannot ' +
      'verify releases and refuses to run. Maintainers: create the key with `node tools/release.js --keygen ' +
      '<file outside the repo>` and paste the public key into RELEASE_PUBLIC_KEY in update.js.')
  }
  let key = null
  try {
    if (/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) key = crypto.createPublicKey({ key: Buffer.from(b64, 'base64'), format: 'der', type: 'spki' })
  } catch (e) {}
  if (!key || key.asymmetricKeyType !== 'ed25519') throw new Error('The release key pinned in update.js is not a valid Ed25519 public key.')
  return key
}

// Short, human-comparable fingerprint of a public key: first 128 bits of SHA-256 over the SPKI DER.
function keyFingerprint (key) {
  const der = key.export({ type: 'spki', format: 'der' })
  return sha256(der).slice(0, 32).match(/.{4}/g).join(' ')
}

// ---------------------------------------------------------------------------------------------
// Downloads
// ---------------------------------------------------------------------------------------------

const allowedHost = (host) => ['github.com', 'githubusercontent.com'].some((d) => host === d || host.endsWith('.' + d))

function checkUrl (url) {
  let u
  try { u = new URL(url) } catch (e) { throw new Error(`Refusing an invalid download URL: ${url}`) }
  if (u.protocol !== 'https:') throw new Error(`Refusing a non-https download: ${u.protocol}//${u.host}`)
  if (u.username || u.password || (u.port && u.port !== '443')) throw new Error(`Refusing an unusual download URL: ${u.host}`)
  if (!allowedHost(u.hostname.toLowerCase())) {
    throw new Error(`Refusing a download from ${u.hostname} – only github.com / githubusercontent.com are allowed.`)
  }
  return u
}

// One HTTPS GET without following redirects. Resolves { status, location, body }. Replaced by a stub in
// the tests (run(argv, { get })).
function httpsGet (url, { maxBytes }) {
  return new Promise((resolve, reject) => {
    let settled = false
    let deadline = null
    let req = null
    const finish = (err, value) => {
      if (settled) return
      settled = true
      clearTimeout(deadline)
      if (err) { if (req) req.destroy(); reject(err) } else resolve(value)
    }
    req = https.get(url, { headers: { 'User-Agent': 'exodus-multi-wallet-updater', Accept: '*/*' } }, (res) => {
      const status = res.statusCode
      if (status >= 300 && status < 400) {
        res.resume()
        finish(null, { status, location: res.headers.location || null, body: Buffer.alloc(0) })
        return
      }
      const declared = Number(res.headers['content-length'])
      if (declared > maxBytes) { finish(new Error(`Download too large (${declared} bytes): ${url}`)); return }
      const chunks = []
      let size = 0
      res.on('data', (c) => {
        size += c.length
        if (size > maxBytes) finish(new Error(`Download too large (over ${maxBytes} bytes): ${url}`))
        else chunks.push(c)
      })
      res.on('end', () => {
        if (!res.complete) finish(new Error(`Connection closed early: ${url}`))
        else finish(null, { status, location: null, body: Buffer.concat(chunks) })
      })
      res.on('aborted', () => finish(new Error(`Connection closed early: ${url}`)))
      res.on('error', finish)
    })
    deadline = setTimeout(() => finish(new Error(`Download took too long: ${url}`)), DOWNLOAD_DEADLINE_MS)
    req.setTimeout(IDLE_TIMEOUT_MS, () => finish(new Error(`No response (timeout): ${url}`)))
    req.on('error', finish)
  })
}

// GET with the redirect policy: https only, allowed hosts only, at most MAX_REDIRECTS hops, size limit.
async function download (get, url, maxBytes) {
  let current = url
  for (let redirects = 0; ; redirects++) {
    checkUrl(current)
    const res = await get(current, { maxBytes })
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      if (redirects >= MAX_REDIRECTS) throw new Error(`Too many redirects: ${url}`)
      if (!res.location) throw new Error(`Redirect without a target: ${url}`)
      current = new URL(res.location, current).toString()
      continue
    }
    if (res.status !== 200) throw new Error(`Download failed (HTTP ${res.status}): ${url}`)
    if (!Buffer.isBuffer(res.body) || res.body.length > maxBytes) throw new Error(`Download too large: ${url}`)
    return res.body
  }
}

// ---------------------------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------------------------

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i

// Relative path of plain segments: no leading '/', no '.', no '..', no backslash, no drive letters.
function safeRelativePath (p) {
  if (typeof p !== 'string' || !p.length || p.length > 200) return false
  return p.split('/').every((s) => /^[A-Za-z0-9_][A-Za-z0-9._-]*$/.test(s) && !WINDOWS_RESERVED.test(s))
}

function validateManifest (m) {
  const bad = (why) => new Error(`The release manifest is not acceptable: ${why}. Nothing was installed.`)
  if (!m || typeof m !== 'object' || Array.isArray(m)) throw bad('not an object')
  if (m.name !== MANIFEST_NAME) throw bad(`it is for "${m.name}", not "${MANIFEST_NAME}"`)
  if (typeof m.version !== 'string' || !VERSION_RE.test(m.version)) throw bad('invalid version')
  if (typeof m.commit !== 'string' || !/^[0-9a-f]{40}$/.test(m.commit)) throw bad('invalid commit (expected 40 hex characters)')
  if (!m.files || typeof m.files !== 'object' || Array.isArray(m.files)) throw bad('no file list')
  const entries = Object.entries(m.files)
  if (!entries.length || entries.length > LIMITS.files) throw bad('unexpected number of files')
  const seen = new Set()
  for (const [p, h] of entries) {
    if (!safeRelativePath(p)) throw bad(`unsafe file path "${p}"`)
    if (seen.has(p.toLowerCase())) throw bad(`duplicate file path "${p}"`)
    seen.add(p.toLowerCase())
    if (typeof h !== 'string' || !/^[0-9a-f]{64}$/.test(h)) throw bad(`invalid SHA-256 for ${p}`)
  }
  for (const needed of ['install.js', 'update.js']) if (!has(m.files, needed)) throw bad(`${needed} is missing`)
  return m
}

// Check the signature over the exact manifest bytes, then the content. Returns the parsed manifest.
function verifyManifest (manifestBytes, signatureText, publicKey) {
  const b64 = String(signatureText).trim()
  const sig = /^[A-Za-z0-9+/]+={0,2}$/.test(b64) ? Buffer.from(b64, 'base64') : null
  if (!sig || sig.length !== 64) throw new Error('The release signature is malformed. Nothing was installed.')
  if (!crypto.verify(null, manifestBytes, publicKey, sig)) {
    throw new Error('The release signature does NOT match the pinned release key – the release may have been ' +
      'tampered with. Nothing was installed.')
  }
  let m
  try { m = JSON.parse(manifestBytes.toString('utf8')) } catch (e) { throw new Error('The release manifest is not valid JSON. Nothing was installed.') }
  return validateManifest(m)
}

// Download every listed file from the manifest's commit, check its SHA-256 and write it below dir.
async function fetchRelease (get, manifest, dir) {
  const root = path.resolve(dir)
  let total = 0
  for (const [rel, hash] of Object.entries(manifest.files)) {
    const buf = await download(get, `https://raw.githubusercontent.com/${REPO}/${manifest.commit}/${rel}`, LIMITS.file)
    total += buf.length
    if (total > LIMITS.total) throw new Error('The release is larger than expected. Nothing was installed.')
    if (sha256(buf) !== hash) throw new Error(`${rel} does not match the signed release (SHA-256 mismatch). Nothing was installed.`)
    const target = path.resolve(root, ...rel.split('/'))
    if (!target.startsWith(root + path.sep)) throw new Error(`Unsafe file path in the release: ${rel}`)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, buf, { flag: 'wx' })
  }
}

// ---------------------------------------------------------------------------------------------
// Local updater
// ---------------------------------------------------------------------------------------------

// Same folder as install.js' localUpdaterDir().
function localUpdaterDir () {
  if (process.platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Exodus-Multi-Wallet')
  }
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'Exodus-Multi-Wallet')
  return path.join(os.homedir(), '.local', 'share', 'exodus-multi-wallet')
}

function samePath (a, b) {
  const real = (p) => { try { return fs.realpathSync(p) } catch (e) { return path.resolve(p) } }
  const x = real(a)
  const y = real(b)
  return process.platform === 'win32' || process.platform === 'darwin' ? x.toLowerCase() === y.toLowerCase() : x === y
}

const runningAsLocalUpdater = () => samePath(path.dirname(__filename), localUpdaterDir())

// ---------------------------------------------------------------------------------------------
// Running install.js
// ---------------------------------------------------------------------------------------------

function runInstaller (dir, args, capture) {
  const r = spawnSync(process.execPath, [path.join(dir, 'install.js'), ...args], {
    cwd: dir,
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    encoding: 'utf8',
    windowsHide: true
  })
  if (r.error) throw new Error(`Could not run install.js: ${r.error.message}`)
  return capture ? { status: r.status, stdout: r.stdout || '' } : r.status
}

function askYesNo (question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (answer) => {
      rl.close()
      resolve(/^\s*y(es)?\s*$/i.test(answer))
    })
  })
}

// ---------------------------------------------------------------------------------------------
// Main flow
// ---------------------------------------------------------------------------------------------

function normalizeTag (v) {
  const m = /^v?(\d{1,6}(\.\d{1,6}){1,3})$/.exec(v || '')
  if (!m) throw new Error(`Invalid --version "${v || ''}" (expected e.g. v1.2.3).`)
  return 'v' + m[1]
}

function parseArgs (argv) {
  const opts = { action: null, yes: false, allowDowngrade: false, tag: null, appArgs: [], help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--yes' || a === '-y') opts.yes = true
    else if (a === '--allow-downgrade') opts.allowDowngrade = true
    else if (a === '--version') opts.tag = normalizeTag(argv[++i])
    else if (a === '--app') {
      const p = argv[++i]
      if (!p) throw new Error('--app needs a path.')
      opts.appArgs = ['--app', path.resolve(p)]
    } else if (a === '--help' || a === '-h') opts.help = true
    else if (!a.startsWith('-') && !opts.action) opts.action = a.toLowerCase()
    else throw new Error(`Unknown argument "${a}". Try --help.`)
  }
  opts.action = opts.action || 'update'
  if (!ACTIONS.includes(opts.action)) throw new Error(`Unknown action "${opts.action}". Allowed: ${ACTIONS.join(', ')}`)
  return opts
}

const USAGE = `Usage: node update.js [${ACTIONS.join('|')}] [--version vX.Y.Z] [--yes] [--allow-downgrade] [--app "<path>"]`

// Returns the exit code. deps (tests): get = network stub, interactive, confirm.
async function run (argv, deps = {}) {
  const opts = parseArgs(argv)
  if (opts.help) { log(USAGE); return 0 }
  if (typeof crypto.verify !== 'function' || typeof crypto.createPublicKey !== 'function') {
    throw new Error('Node.js 16 or newer is required.')
  }
  const get = deps.get || httpsGet
  const interactive = deps.interactive !== undefined ? deps.interactive : !!(process.stdin.isTTY && process.stdout.isTTY)
  const confirm = deps.confirm || askYesNo

  const key = loadPinnedKey()
  const local = runningAsLocalUpdater()
  log(`Exodus Multi Wallet updater${local ? ' (local)' : ''} – release key ${keyFingerprint(key)}`)

  const base = opts.tag
    ? `https://github.com/${REPO}/releases/download/${opts.tag}/`
    : `https://github.com/${REPO}/releases/latest/download/`
  log(`Checking ${opts.tag ? 'release ' + opts.tag : 'the latest release'} ...`)
  const manifestBytes = await download(get, base + 'release-manifest.json', LIMITS.manifest)
  const signature = await download(get, base + 'release-manifest.sig', LIMITS.signature)
  const manifest = verifyManifest(manifestBytes, signature.toString('utf8'), key)
  if (opts.tag && 'v' + manifest.version !== opts.tag) {
    throw new Error(`Release ${opts.tag} carries a manifest for v${manifest.version}. Nothing was installed.`)
  }
  const short = manifest.commit.slice(0, 7)
  log(`Signature OK: release v${manifest.version}, commit ${short}.`)

  // First use (not the local updater): this file must itself be the update.js of the verified release.
  if (!local) {
    if (opts.tag) {
      log(`Note: this update.js (${__filename}) is not the local updater; with --version its own file is not checked.`)
    } else if (sha256(fs.readFileSync(__filename)) !== manifest.files['update.js']) {
      throw new Error(`This update.js is not the one of the signed release v${manifest.version} (SHA-256 mismatch). ` +
        `Download it again from https://github.com/${REPO}/releases/latest. Nothing was installed.`)
    }
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exodus-mw-'))
  try {
    await fetchRelease(get, manifest, dir)
    log(`All ${Object.keys(manifest.files).length} files match the signed release.`)
    const installer = (args, capture) => runInstaller(dir, [...args, ...opts.appArgs], capture)

    if (opts.action === 'status') {
      const code = installer(['status'])
      log(`Available: v${manifest.version} (commit ${short})`)
      return code === 0 ? 0 : 1
    }

    const st = installer(['status', '--json'], true)
    let state
    try { state = JSON.parse(st.stdout) } catch (e) { state = null }
    if (st.status !== 0 || !state || typeof state.appDir !== 'string') {
      throw new Error('Could not determine the Exodus installation to use (see above). Nothing was changed.')
    }
    const installed = state.installed ? (typeof state.sidebar === 'string' ? state.sidebar : '?') : null
    const where = `${state.appDir}${state.exodusVersion ? ` (Exodus ${state.exodusVersion})` : ''}`

    let action = opts.action
    if (action === 'toggle') {
      action = state.installed ? 'uninstall' : 'install'
      log(state.installed ? `The sidebar is installed in ${state.appDir} -> removing it ...` : 'Installing the sidebar ...')
    }
    if (action === 'uninstall' && !state.installed) {
      // install.js explains the details (nothing to do, or a damaged install)
      return installer(['uninstall']) === 0 ? 0 : 1
    }

    const cmp = installed && VERSION_RE.test(installed) ? compareVersions(manifest.version, installed) : null
    if (cmp !== null && cmp < 0 && !opts.allowDowngrade) {
      throw new Error(action === 'uninstall'
        ? `v${installed} is installed, but the release is the older v${manifest.version}, whose uninstaller may not ` +
          'undo everything a newer version did. Use the newer release, or --allow-downgrade. Nothing was changed.'
        : `Refusing to downgrade: v${installed} is installed, the release is v${manifest.version}. ` +
          'Use --allow-downgrade if you really want this. Nothing was changed.')
    }
    if (action === 'update' && cmp === 0) {
      log(`Already up to date: v${installed} is installed in ${where}.`)
      return 0
    }

    log('')
    log(`Exodus:    ${where}`)
    if (action === 'uninstall') {
      log(`Installed: v${installed} – will be removed (uninstaller from release v${manifest.version}, commit ${short})`)
    } else {
      log(`Installed: ${installed ? 'v' + installed : 'none'} → Available: v${manifest.version} (commit ${short})`)
    }
    if (interactive && !opts.yes) {
      const question = action === 'uninstall'
        ? 'Remove the sidebar from this Exodus now? [y/N] '
        : `Install v${manifest.version} into this Exodus now? [y/N] `
      if (!(await confirm(question))) {
        log('Cancelled – nothing was changed.')
        return 0
      }
    }
    const args = action === 'uninstall' ? ['uninstall'] : ['install', '--install-updater']
    if (installer(args) !== 0) throw new Error(`install.js ${args[0]} failed (see above).`)
    return 0
  } finally {
    rmrf(dir)
  }
}

module.exports = {
  REPO,
  MANIFEST_NAME,
  RELEASE_PUBLIC_KEY,
  run,
  httpsGet,
  download,
  checkUrl,
  verifyManifest,
  validateManifest,
  loadPinnedKey,
  keyFingerprint,
  compareVersions,
  localUpdaterDir
}

if (require.main === module) {
  run(process.argv.slice(2)).then(
    (code) => { process.exitCode = code },
    (e) => {
      console.error('')
      console.error('ERROR: ' + e.message)
      process.exitCode = 1
    }
  )
}
