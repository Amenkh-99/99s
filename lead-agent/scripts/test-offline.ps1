# Offline end-to-end test that uses no Claude usage and no credits:
#  1. runs the unit tests (normalization, verification, scoring, dedupe, CSV, guard hook)
#  2. puts a test research file with deliberately fabricated facts into data\inbox
#  3. runs the n8n pipeline and checks that fabricated facts were rejected
# The test lead is real data in your database afterwards; scripts\archive-data.ps1 moves it aside.
#
#   powershell -ExecutionPolicy Bypass -File scripts\test-offline.ps1

. (Join-Path $PSScriptRoot 'common.ps1')
Ensure-ProjectFolders

Write-Step 'Unit tests'
Push-Location $Root
& node --test
$unit = $LASTEXITCODE
Pop-Location
if ($unit -ne 0) { Write-Fail 'unit tests failed'; exit 1 }
Write-Ok 'unit tests passed'

Write-Step 'Pipeline test with fabricated data'
$fixture = Join-Path $Root 'test\fixtures\research_fabricated.json'
$target = Join-Path $Root ('data\inbox\research_offlinetest_' + (Get-Date -Format 'yyyyMMdd_HHmmss') + '.json')
Copy-Item $fixture $target
& (Join-Path $PSScriptRoot 'run-pipeline.ps1')
if ($LASTEXITCODE -ne 0) { exit 1 }

$ev = Get-ChildItem (Join-Path $Root 'data\exports\evidence_*.csv') | Sort-Object LastWriteTime | Select-Object -Last 1
$rows = Import-Csv $ev.FullName | Where-Object { $_.company_name -like 'Example Domain*' }
$bad = $rows | Where-Object { $_.field -in @('phone', 'email', 'decision_maker', 'employee_count', 'industry') -and $_.verification -in @('verified', 'partial') }
$good = $rows | Where-Object { $_.field -eq 'process_evidence' -and $_.verification -eq 'verified' }
if (-not $rows) { Write-Warn2 'test company was not processed (already in the database from an earlier test?). Run scripts\archive-data.ps1 to start clean.'; exit 0 }
if ($bad) { Write-Fail 'a fabricated fact was accepted:'; $bad | Format-Table field, value, verification; exit 1 }
Write-Ok 'all fabricated phone/email/name/count/industry claims were rejected'
if ($good) { Write-Ok 'the one real quote on example.com was verified' } else { Write-Warn2 'example.com could not be fetched; check your internet connection' }
Write-Host "`nOffline test passed. Ollama answers this run: see 'ollama_answers' above (0 means Ollama was not reachable)."
