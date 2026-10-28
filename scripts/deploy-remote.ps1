#requires -Version 7.0
<#
.SYNOPSIS
Tests, builds and uploads dist/ to the main production branch of Cloudflare Pages.
.PARAMETER DryRun
Runs tests/build and prints the target without calling Cloudflare or requiring credentials.
#>
[CmdletBinding()]
param([switch]$DryRun)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$npmCommand = if ($IsWindows) { 'npm.cmd' } else { 'npm' }

Push-Location -LiteralPath $projectRoot
try {
  if (-not (Test-Path -LiteralPath 'node_modules/wrangler/bin/wrangler.js')) {
    throw 'Install dependencies first: npm ci --allow-remote=root'
  }
  $projectName = & node -e 'process.stdout.write(process.env.CLOUDFLARE_PROJECT_NAME || JSON.parse(require("node:fs").readFileSync("wrangler.jsonc", "utf8")).name)'
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  if ($projectName -notmatch '^[a-z0-9][a-z0-9-]*$') { throw 'Invalid Cloudflare Pages project name.' }
  if (-not $DryRun -and ([string]::IsNullOrWhiteSpace($env:CLOUDFLARE_API_TOKEN) -or [string]::IsNullOrWhiteSpace($env:CLOUDFLARE_ACCOUNT_ID))) {
    throw 'Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID before deploying.'
  }
  Write-Host "Target: $projectName | production branch: main"
  & $npmCommand test
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  & $npmCommand run build
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  if (-not (Test-Path -LiteralPath 'dist/index.html')) { throw 'Build did not produce dist/index.html.' }

  Write-Host "Command: node node_modules/wrangler/bin/wrangler.js pages deploy dist --project-name $projectName --branch main"
  if ($DryRun) {
    Write-Host 'Dry run completed. No Cloudflare request was made.'
    exit 0
  }
  # Prevent Wrangler from offering to create a missing project interactively.
  $previousCi = $env:CI
  try {
    $env:CI = 'true'
    & node node_modules/wrangler/bin/wrangler.js pages deploy dist --project-name $projectName --branch main
    $wranglerExitCode = $LASTEXITCODE
  } finally {
    $env:CI = $previousCi
  }
  if ($wranglerExitCode -ne 0) { exit $wranglerExitCode }
  Write-Host 'Deployment completed. See the deployment URL returned by Wrangler above.'
} catch {
  Write-Error $_ -ErrorAction Continue
  exit 1
} finally {
  Pop-Location
}
