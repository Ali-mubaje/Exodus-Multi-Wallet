# Exodus Multi Wallet one-line installer for Windows (PowerShell).
#
#   irm https://raw.githubusercontent.com/Ali-mubaje/Exodus-Multi-Wallet/main/bootstrap.ps1 | iex
#
# Action via $env:EMW_ACTION (irm | iex can't pass arguments); it is cleared again right away.
#   (empty)   toggle: install, or uninstall if the sidebar is installed
#   install, update, uninstall, status
# Quit Exodus first. Only run this if you trust the source.
#
# If the local updater exists (%LOCALAPPDATA%\Exodus-Multi-Wallet\update.js, set up by the first
# install), it is used - it checks every release against the release key it already has. Otherwise
# update.js is downloaded from the latest GitHub release (trust on first use); it verifies the signed
# release manifest and every file before anything is installed. This script itself never downloads
# the add-on.
#
# The whole script is one script block: a cut-off download fails to parse and runs nothing, and none
# of its variables or settings stay behind in your PowerShell session.
& {
  $repo = 'Ali-mubaje/Exodus-Multi-Wallet'
  $action = $env:EMW_ACTION
  Remove-Item Env:EMW_ACTION -ErrorAction SilentlyContinue
  if (-not $action) { $action = 'toggle' }
  $action = $action.Trim().ToLowerInvariant()
  if (@('toggle', 'install', 'update', 'uninstall', 'status') -notcontains $action) {
    Write-Host "Unknown action '$action'. Use toggle, install, update, uninstall or status."
    return
  }

  if (-not (Get-Command node -CommandType Application -ErrorAction SilentlyContinue)) {
    Write-Host 'Node.js is required. Get it at https://nodejs.org/ and run this again.'
    return
  }

  if ($env:LOCALAPPDATA) {
    $localUpdater = Join-Path $env:LOCALAPPDATA 'Exodus-Multi-Wallet\update.js'
    if (Test-Path -LiteralPath $localUpdater -PathType Leaf) {
      Write-Host "Using the local updater: $localUpdater"
      & node $localUpdater $action
      if ($LASTEXITCODE -ne 0) { Write-Host 'The updater stopped with an error (see above).' }
      return
    }
  }

  $tmp = Join-Path ([IO.Path]::GetTempPath()) ('exodus-mw-' + [Guid]::NewGuid().ToString('N'))
  try {
    New-Item -ItemType Directory -Path $tmp -ErrorAction Stop | Out-Null
    $updater = Join-Path $tmp 'update.js'
    Write-Host "Downloading the updater from the latest release of $repo ..."
    $ProgressPreference = 'SilentlyContinue'
    try {
      Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/$repo/releases/latest/download/update.js" -OutFile $updater -ErrorAction Stop
    } catch {
      Write-Host "Could not download the updater from https://github.com/$repo/releases/latest ($($_.Exception.Message))"
      return
    }
    & node $updater $action
    if ($LASTEXITCODE -ne 0) { Write-Host 'The updater stopped with an error (see above).' }
  } finally {
    Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
  }
}
