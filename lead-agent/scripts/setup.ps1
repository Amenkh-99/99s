# One-time, non-destructive project setup:
#  - creates the data folders and empty lists (never overwrites existing files)
#  - generates the n8n workflow for this folder
#  - imports it into n8n (inactive; manual trigger only; no schedule)
#
#   powershell -ExecutionPolicy Bypass -File scripts\setup.ps1

. (Join-Path $PSScriptRoot 'common.ps1')

Write-Step 'Creating project folders'
Ensure-ProjectFolders
Write-Ok "data folders ready under $Root\data"

Write-Step 'Generating the n8n workflow'
& node (Join-Path $Root 'n8n\build-workflow.js') --project-dir $Root --out $WorkflowFile
if ($LASTEXITCODE -ne 0) { throw 'workflow generation failed' }

Write-Step 'Importing the workflow into n8n'
$n8n = Get-N8nCommand
if (-not $n8n) { Write-Fail 'n8n is not installed. Run: npm install -g n8n@2.43.4  then run this script again.'; exit 1 }
if (Test-PortListening 5678) {
    Write-Warn2 'n8n appears to be running. Stop it (Ctrl+C in its window) and run setup again, so the import does not race the running server.'
    exit 1
}
Set-N8nEnv
& n8n import:workflow "--input=$WorkflowFile"
if ($LASTEXITCODE -ne 0) { throw 'n8n import failed' }
& n8n list:workflow
Write-Ok "Imported workflow id $WorkflowId (inactive, manual trigger, no schedule)."
Write-Host "`nNext: scripts\test-offline.ps1 (no Claude usage), then scripts\run-research.ps1 -Companies 2"
