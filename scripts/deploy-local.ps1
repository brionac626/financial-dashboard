#requires -Version 7.0
<# .SYNOPSIS
Builds and previews Cloudflare Pages on localhost without uploading assets.
#>
[CmdletBinding()]
param([ValidateRange(1024, 65535)][int]$Port = 8788)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$npmCommand = if ($IsWindows) { 'npm.cmd' } else { 'npm' }
Push-Location -LiteralPath $projectRoot
try {
  if (-not (Test-Path -LiteralPath 'node_modules/wrangler/bin/wrangler.js')) {
    throw 'Install dependencies first: npm ci --allow-remote=root'
  }
  & $npmCommand run build
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  if (-not (Test-Path -LiteralPath 'dist/index.html')) { throw 'Build did not produce dist/index.html.' }
  Write-Host "Local Pages preview: http://127.0.0.1:$Port"
  & node node_modules/wrangler/bin/wrangler.js pages dev dist --ip 127.0.0.1 --port $Port
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} catch {
  Write-Error $_ -ErrorAction Continue
  exit 1
} finally {
  Pop-Location
}
