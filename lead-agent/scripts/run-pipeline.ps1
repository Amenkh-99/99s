# Runs the n8n workflow once from the command line: verify sources, dedupe, score (Ollama),
# apply do-not-contact and status updates, save the database and export CSVs.
# You can also open http://localhost:5678 and click "Execute workflow" instead.
#
#   powershell -ExecutionPolicy Bypass -File scripts\run-pipeline.ps1

. (Join-Path $PSScriptRoot 'common.ps1')
Ensure-ProjectFolders
if (-not (Get-N8nCommand)) { Write-Fail 'n8n is not installed. Run: npm install -g n8n@2.43.4'; exit 1 }
Set-N8nEnv
# A command-line run starts its own task runner; use a different internal port in case the editor is open.
$env:N8N_RUNNERS_BROKER_PORT = '5681'

$before = Get-Date
Write-Step "Running n8n workflow $WorkflowId"
$log = Join-Path $Root ('data\logs\n8n_execute_' + (Get-Date -Format 'yyyyMMdd_HHmmss') + '.txt')
& n8n execute "--id=$WorkflowId" *> $log
$code = $LASTEXITCODE

$run = Get-ChildItem (Join-Path $Root 'data\logs\run_*.json') -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -ge $before } | Sort-Object LastWriteTime | Select-Object -Last 1
if ($code -ne 0 -or -not $run) {
    Write-Fail "n8n run failed (exit code $code). Full output: $log"
    Get-Content $log -Tail 25
    exit 1
}
$s = (Get-Content $run.FullName -Raw | ConvertFrom-Json).summary
Write-Ok "run $($s.run_id) finished"
$s | Format-List
Write-Host "Exports:  $Root\data\exports\  (qualified_ready_for_review.csv, leads_master.csv, new_leads_*.csv, evidence_*.csv)"
Write-Host "Logs:     $($run.FullName)"
if ($s.errors -gt 0) { Write-Warn2 "$($s.errors) error(s) logged - see data\logs\errors_$($s.run_id).csv" }
