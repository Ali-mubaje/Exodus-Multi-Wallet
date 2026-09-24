# Exodus Multi-Wallet one-line installer for Windows (PowerShell).
#
#   irm https://raw.githubusercontent.com/Ali-mubaje/Exodus-Multi-Wallet/main/bootstrap.ps1 | iex
#
# Downloads the tool and installs the sidebar into Exodus. If it is already installed,
# this uninstalls it again (toggle). Quit Exodus first. Only run this if you trust the source.
$ErrorActionPreference = 'Stop'

$Repo   = 'Ali-mubaje/Exodus-Multi-Wallet'
$Branch = 'main'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'Node.js is required. Get it at https://nodejs.org/ and run this again.'
  return
}

$tmp = Join-Path ([IO.Path]::GetTempPath()) ('exodus-mw-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp | Out-Null
try {
  $zip = Join-Path $tmp 'src.zip'
  Write-Host "Downloading $Repo ($Branch) ..."
  Invoke-WebRequest -Uri "https://github.com/$Repo/archive/refs/heads/$Branch.zip" -OutFile $zip
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  $dir = Join-Path $tmp ((($Repo -split '/')[-1]) + "-$Branch")
  Set-Location $dir

  # Toggle: uninstall if already installed, otherwise install.
  $status = & node install.js status 2>$null | Out-String
  if ($status -match 'sidebar installed') {
    Write-Host 'Sidebar already installed -> removing it ...'
    & node install.js uninstall
  } else {
    Write-Host 'Installing the sidebar ...'
    & node install.js install
  }
} finally {
  Set-Location $env:TEMP
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
