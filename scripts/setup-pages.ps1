#requires -Version 7.0
<# .SYNOPSIS
Creates a Pages project with production branch main. Does not build or upload assets.
#>
[CmdletBinding()]
param([switch]$DryRun)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
try {
  $arguments = @((Join-Path $PSScriptRoot 'pages.mjs'), 'setup')
  if ($DryRun) { $arguments += '--dry-run' }
  & node @arguments
  exit $LASTEXITCODE
} catch {
  Write-Error 'Unable to start setup. Check your Node.js 24 installation.' -ErrorAction Continue
  exit 1
}
