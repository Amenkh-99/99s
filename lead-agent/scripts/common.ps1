# Shared helpers, dot-sourced by the other scripts. Works in Windows PowerShell 5.1 and PowerShell 7.

# 'Continue' on purpose: in Windows PowerShell 5.1, 'Stop' turns any stderr line from a native
# program (n8n, claude) into a fatal error. Scripts check $LASTEXITCODE instead.
$ErrorActionPreference = 'Continue'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$RootFwd = $Root -replace '\\', '/'
$WorkflowId = 'LeadAgentPipe001'
$WorkflowFile = Join-Path $Root 'data\n8n\lead-pipeline.workflow.json'

[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)

function Write-Ok($msg)   { Write-Host "[ OK ] $msg" -ForegroundColor Green }
function Write-Warn2($msg){ Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red }
function Write-Step($msg) { Write-Host "`n== $msg" -ForegroundColor Cyan }

function Get-N8nCommand {
    $cmd = Get-Command n8n -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

# n8n settings for this project: local-only, no telemetry, file access limited to this project.
function Set-N8nEnv {
    $env:N8N_LISTEN_ADDRESS = '127.0.0.1'
    $env:N8N_HOST = 'localhost'
    $env:N8N_PORT = '5678'
    $env:N8N_RESTRICT_FILE_ACCESS_TO = "$RootFwd/data;$RootFwd/config"
    $env:N8N_DIAGNOSTICS_ENABLED = 'false'
    $env:N8N_VERSION_NOTIFICATIONS_ENABLED = 'false'
    $env:N8N_TEMPLATES_ENABLED = 'false'
    $env:N8N_PERSONALIZATION_ENABLED = 'false'
    $env:N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS = 'false'
}

function Test-PortListening([int]$Port) {
    try {
        $c = New-Object System.Net.Sockets.TcpClient
        $iar = $c.BeginConnect('127.0.0.1', $Port, $null, $null)
        $ok = $iar.AsyncWaitHandle.WaitOne(700) -and $c.Connected
        $c.Close()
        return $ok
    } catch { return $false }
}

function Ensure-ProjectFolders {
    foreach ($d in @('data\inbox', 'data\discovery', 'data\db\backups', 'data\exports', 'data\logs', 'data\tmp', 'data\n8n')) {
        New-Item -ItemType Directory -Force -Path (Join-Path $Root $d) | Out-Null
    }
    $db = Join-Path $Root 'data\db\leads.json'
    if (-not (Test-Path $db)) { [IO.File]::WriteAllText($db, "{`"leads`":{},`"meta`":{}}`n") }
    foreach ($name in @('do_not_contact.csv', 'lead_updates.csv')) {
        $target = Join-Path $Root "config\$name"
        $example = Join-Path $Root ("config\" + ($name -replace '\.csv$', '.example.csv'))
        if (-not (Test-Path $target)) { Copy-Item $example $target -ErrorAction Stop }
    }
}
