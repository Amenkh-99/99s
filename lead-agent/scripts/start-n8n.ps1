# Starts the n8n editor on http://localhost:5678, bound to 127.0.0.1 only (not reachable from
# other computers). Leave this window open while you use the editor; press Ctrl+C to stop.
#
#   powershell -ExecutionPolicy Bypass -File scripts\start-n8n.ps1

. (Join-Path $PSScriptRoot 'common.ps1')
if (-not (Get-N8nCommand)) { Write-Fail 'n8n is not installed. Run: npm install -g n8n@2.43.4'; exit 1 }
if (Test-PortListening 5678) { Write-Warn2 'Port 5678 is already in use; n8n may already be running. Open http://localhost:5678'; exit 0 }
Set-N8nEnv
Write-Host 'Starting n8n on http://localhost:5678 (local only). Press Ctrl+C to stop.' -ForegroundColor Cyan
& n8n start
