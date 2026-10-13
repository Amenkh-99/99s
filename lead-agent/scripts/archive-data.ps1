# Non-destructive reset: moves the current data folder to archive\data_<timestamp>\ and creates a
# fresh empty one. Nothing is deleted. Use it to clear test leads before real use.
# The n8n workflow and your config files (do-not-contact list, status updates) are kept.
#
#   powershell -ExecutionPolicy Bypass -File scripts\archive-data.ps1

. (Join-Path $PSScriptRoot 'common.ps1')
$data = Join-Path $Root 'data'
$archive = Join-Path $Root ('archive\data_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
New-Item -ItemType Directory -Force -Path (Split-Path $archive) | Out-Null
$workflow = $null
if (Test-Path $WorkflowFile) { $workflow = Get-Content $WorkflowFile -Raw }
Move-Item $data $archive -ErrorAction Stop
Ensure-ProjectFolders
if ($workflow) { [IO.File]::WriteAllText($WorkflowFile, $workflow) }
Write-Ok "Old data moved to $archive"
Write-Ok 'Fresh empty data folder created'
