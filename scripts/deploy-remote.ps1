#requires -Version 7.0
<# .SYNOPSIS
Tests, builds and deploys Pages using terminal settings or the project .env.
#>
[CmdletBinding()]
param([switch]$DryRun)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
try {
  $arguments = @((Join-Path $PSScriptRoot 'pages.mjs'), 'deploy')
  if ($DryRun) { $arguments += '--dry-run' }
  & node @arguments
  exit $LASTEXITCODE
} catch {
  Write-Error 'Unable to start deployment. Check your Node.js 24 installation.' -ErrorAction Continue
  exit 1
}
