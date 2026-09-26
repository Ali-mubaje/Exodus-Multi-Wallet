#!/usr/bin/env node
'use strict'
/*
 * Exodus Multi Wallet – release tool (maintainers only). Pure Node.js, no dependencies.
 *
 *   node tools/release.js --keygen <private key file>
 *       Once: create the Ed25519 release key pair. The private key is written to <private key file>, which
 *       must be OUTSIDE this repository – keep it offline. Paste the printed public key into
 *       RELEASE_PUBLIC_KEY in update.js and commit that.
 *
 *   node tools/release.js --key <private key file>
 *       For every release, on a clean checkout of the commit to release (committed and pushed): writes
 *       dist/release-manifest.json  name, version (payload/main.js VERSION), commit, SHA-256 of every file
 *                                   the installer needs – taken from the commit, byte for byte what
 *                                   raw.githubusercontent.com serves
 *       dist/release-manifest.sig   Ed25519 signature over the exact manifest bytes (base64)
 *       dist/update.js              the committed update.js, to attach to the release (first installs)
 *       and prints the `gh release create` command to publish them. It never publishes anything itself.
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execFileSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const DIST = path.join(ROOT, 'dist')
const updater = require(path.join(ROOT, 'update.js'))
const { PAYLOAD_FILES } = require(path.join(ROOT, 'install.js'))

// Everything update.js downloads and install.js needs to run.
const RELEASE_FILES = ['install.js', 'update.js', ...PAYLOAD_FILES.map((f) => `payload/${f}`)]

const log = (...a) => console.log(...a)
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex')
const spki = (key) => key.export({ type: 'spki', format: 'der' })
const git = (args, opts = {}) => execFileSync('git', args, { cwd: ROOT, maxBuffer: 256 * 1024 * 1024, ...opts })

function fail (msg) {
  throw new Error(msg)
}

// Resolve symlinks of the part of the path that exists, so a link can't smuggle the key into the repo.
function realish (p) {
  const rest = []
  let cur = path.resolve(p)
  while (!fs.existsSync(cur)) {
    const up = path.dirname(cur)
    if (up === cur) break
    rest.unshift(path.basename(cur))
    cur = up
  }
  try { cur = fs.realpathSync(cur) } catch (e) {}
  return path.join(cur, ...rest)
}

function refuseInsideRepo (file) {
  const rel = path.relative(fs.realpathSync(ROOT), realish(file))
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
    fail(`${file} is inside the repository. Keep the private release key outside of it (and offline).`)
  }
}

function restrictPermissions (file) {
  try {
    if (process.platform === 'win32') {
      const icacls = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'icacls.exe')
      const user = `${process.env.USERDOMAIN ? process.env.USERDOMAIN + '\\' : ''}${process.env.USERNAME}`
      execFileSync(icacls, [file, '/inheritance:r', '/grant:r', `${user}:F`], { stdio: 'ignore', windowsHide: true })
    } else {
      fs.chmodSync(file, 0o600)
    }
    return true
  } catch (e) {
    log(`WARNING: could not restrict the permissions of ${file} (${e.message}). Make sure only you can read it.`)
    return false
  }
}

function keygen (target) {
  const file = path.resolve(target)
  refuseInsideRepo(file)
  if (fs.existsSync(file)) fail(`${file} already exists – refusing to overwrite a key.`)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519')
  fs.writeFileSync(file, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600, flag: 'wx' })
  restrictPermissions(file)
  log(`Private release key written to: ${file}`)
  log('Keep it offline and backed up. Anyone who has it can publish updates that every updater accepts;')
  log('if it is lost, no further update can be signed (key rotation is not supported yet).')
  log('')
  log('Public key – paste it into RELEASE_PUBLIC_KEY in update.js and commit that:')
  log(`  ${spki(publicKey).toString('base64')}`)
  log(`Fingerprint: ${updater.keyFingerprint(publicKey)}`)
}

function release (keyPath) {
  const file = path.resolve(keyPath)
  refuseInsideRepo(file)
  if (process.platform !== 'win32' && (fs.statSync(file).mode & 0o077)) {
    log(`WARNING: ${file} is readable by other users (chmod 600 it).`)
  }
  let privateKey
  try { privateKey = crypto.createPrivateKey(fs.readFileSync(file)) } catch (e) { fail(`Could not read the private key ${file}: ${e.message}`) }
  if (privateKey.asymmetricKeyType !== 'ed25519') fail(`${file} is not an Ed25519 private key.`)

  // The key must be the one every updater pins – otherwise the release would be rejected by everyone.
  let pinned
  try { pinned = updater.loadPinnedKey() } catch (e) { fail(e.message) }
  const mine = crypto.createPublicKey(privateKey)
  if (!spki(mine).equals(spki(pinned))) {
    fail(`This private key (fingerprint ${updater.keyFingerprint(mine)}) does not belong to the key pinned in ` +
      `update.js (fingerprint ${updater.keyFingerprint(pinned)}). Updaters would reject the release.`)
  }

  const dirty = git(['status', '--porcelain'], { encoding: 'utf8' }).trim()
  if (dirty) fail(`The working tree is not clean – commit (and push) first:\n${dirty}`)
  const commit = git(['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  if (!/^[0-9a-f]{40}$/.test(commit)) fail(`Unexpected commit id "${commit}".`)

  // Hash the committed blobs: exactly the bytes raw.githubusercontent.com serves for this commit.
  const blob = (p) => {
    try { return git(['cat-file', 'blob', `${commit}:${p}`], { stdio: ['ignore', 'pipe', 'pipe'] }) } catch (e) { fail(`${p} is not committed in ${commit}.`) }
  }
  const m = blob('payload/main.js').toString('utf8').match(/const VERSION = '([^']+)'/)
  if (!m || !/^\d{1,6}(\.\d{1,6}){1,3}$/.test(m[1])) fail('Could not read a valid VERSION from payload/main.js.')
  const version = m[1]
  const files = {}
  const blobs = {}
  for (const p of RELEASE_FILES) {
    blobs[p] = blob(p)
    files[p] = sha256(blobs[p])
  }

  const manifest = { name: updater.MANIFEST_NAME, version, commit, createdAt: new Date().toISOString(), files }
  const bytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n', 'utf8')
  const signature = crypto.sign(null, bytes, privateKey).toString('base64') + '\n'
  updater.verifyManifest(bytes, signature, pinned) // the same check every updater runs

  fs.mkdirSync(DIST, { recursive: true })
  fs.writeFileSync(path.join(DIST, 'release-manifest.json'), bytes)
  fs.writeFileSync(path.join(DIST, 'release-manifest.sig'), signature)
  fs.writeFileSync(path.join(DIST, 'update.js'), blobs['update.js'])

  const tag = `v${version}`
  log(`Signed release ${tag} (commit ${commit}, release key ${updater.keyFingerprint(pinned)}):`)
  for (const [p, h] of Object.entries(files)) log(`  ${h}  ${p}`)
  log('')
  log('Written: dist/release-manifest.json, dist/release-manifest.sig, dist/update.js')

  let remote = ''
  try { remote = git(['branch', '-r', '--contains', commit], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch (e) {}
  if (!remote) {
    log('')
    log(`WARNING: ${commit.slice(0, 7)} is not on any fetched remote branch. Push it before publishing –`)
    log('         updaters download the files from raw.githubusercontent.com at exactly this commit.')
  }
  let tagged = ''
  try { tagged = git(['rev-parse', '--verify', '--quiet', `refs/tags/${tag}^{commit}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch (e) {}
  if (tagged && tagged !== commit) {
    log('')
    log(`WARNING: tag ${tag} already exists and points to ${tagged.slice(0, 7)}, not ${commit.slice(0, 7)}. Bump VERSION.`)
  }

  log('')
  log('Publish it (review first – this tool does not run it):')
  log('')
  log(`  gh release create ${tag} dist/release-manifest.json dist/release-manifest.sig dist/update.js ` +
    `--repo ${updater.REPO} --target ${commit} --title "Exodus Multi Wallet ${tag}" ` +
    `--notes "Signed release ${tag} (commit ${commit.slice(0, 7)}, release key ${updater.keyFingerprint(pinned)})." --latest`)
}

function main (argv) {
  const [flag, value] = argv
  if (flag === '--keygen' && value) return keygen(value)
  if (flag === '--key' && value) return release(value)
  log('Usage:')
  log('  node tools/release.js --keygen <private key file outside the repo>   create the release key (once)')
  log('  node tools/release.js --key <private key file>                       sign a release of HEAD into dist/')
  if (flag !== '--help' && flag !== '-h') process.exitCode = 1
}

if (require.main === module) {
  try {
    main(process.argv.slice(2))
  } catch (e) {
    console.error('')
    console.error('ERROR: ' + e.message)
    process.exitCode = 1
  }
}

module.exports = { RELEASE_FILES, keygen, release }
