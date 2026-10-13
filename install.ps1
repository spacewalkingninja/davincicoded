<#
  OpenCode Terminal for DaVinci Resolve - installer.

  Copies the plugin into DaVinci Resolve's "Workflow Integration Plugins"
  folder and installs its runtime dependencies (node-pty + xterm.js). The npm
  postinstall step also copies WorkflowIntegration.node from your local
  DaVinci Resolve developer package.

  Usage:
      powershell -ExecutionPolicy Bypass -File install.ps1

  If writing to %PROGRAMDATA% is denied, run this from an elevated PowerShell.
#>

$ErrorActionPreference = 'Stop'

$here       = Split-Path -Parent $MyInvocation.MyCommand.Path
$pluginName = 'com.opencode.resolve.terminal'
$root       = Join-Path $env:ProgramData 'Blackmagic Design\DaVinci Resolve\Support\Workflow Integration Plugins'
$dest       = Join-Path $root $pluginName

Write-Host 'OpenCode Terminal  ->  DaVinci Resolve' -ForegroundColor Cyan
Write-Host "  source : $here"
Write-Host "  target : $dest"
Write-Host ''

if (-not (Test-Path $root)) {
    New-Item -ItemType Directory -Force -Path $root | Out-Null
    Write-Host "Created plugin root: $root"
}

# Copy the plugin sources (skip dev/CI artifacts and generated folders).
robocopy $here $dest /E /XD node_modules .git vendor /XF *.log install.ps1 .gitignore LICENSE README.md /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with exit code $LASTEXITCODE" }

# Runtime dependencies. install.js (npm postinstall) vendors xterm.js and
# copies WorkflowIntegration.node from the installed Resolve developer package.
$npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if (-not $npm) { throw 'npm was not found on PATH. Install Node.js first: https://nodejs.org' }

Push-Location $dest
try {
    Write-Host 'Installing dependencies (node-pty, xterm.js)...'
    & $npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "npm install failed with exit code $LASTEXITCODE" }
}
finally {
    Pop-Location
}

Write-Host ''
Write-Host 'Installed successfully.' -ForegroundColor Green
Write-Host 'Next steps:'
Write-Host '  1. Restart DaVinci Resolve Studio.'
Write-Host '  2. Open: Workspace > Workflow Integrations > OpenCode Terminal.'
Write-Host ''
Write-Host 'Requirements: DaVinci Resolve Studio, Node.js on PATH, and "opencode" on PATH.'
