# Manual research run: discovery + website research with headless Claude Code (your subscription).
# Results land in data\inbox\ for the n8n pipeline. Nothing is contacted, nothing is paid for.
#
#   powershell -ExecutionPolicy Bypass -File scripts\run-research.ps1 -Companies 2
#   powershell -ExecutionPolicy Bypass -File scripts\run-research.ps1 -Companies 2 -NoApollo
#   powershell -ExecutionPolicy Bypass -File scripts\run-research.ps1 -DiscoverOnly
#   powershell -ExecutionPolicy Bypass -File scripts\run-research.ps1 -DryRun

param(
    [int]$Companies = 0,
    [switch]$NoApollo,
    [switch]$DiscoverOnly,
    [string]$Candidates = '',
    [switch]$DryRun
)
. (Join-Path $PSScriptRoot 'common.ps1')
Ensure-ProjectFolders

$a = @((Join-Path $Root 'scripts\research.js'))
if ($Companies -gt 0) { $a += @('--companies', "$Companies") }
if ($NoApollo) { $a += '--no-apollo' }
if ($DiscoverOnly) { $a += '--discover-only' }
if ($Candidates) { $a += @('--candidates', $Candidates) }
if ($DryRun) { $a += '--dry-run' }

& node @a
exit $LASTEXITCODE
