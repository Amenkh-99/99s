# Read-only environment check. It installs nothing, changes no settings and deletes nothing.
# The -Live switch runs two tiny headless Claude Code calls (uses a small amount of your
# subscription usage) to prove headless mode, WebSearch and WebFetch work with your login.
#
#   powershell -ExecutionPolicy Bypass -File scripts\check-env.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\check-env.ps1 -Live

param([switch]$Live)
. (Join-Path $PSScriptRoot 'common.ps1')
$fails = 0
$warns = 0

Write-Step 'Node.js'
$nodeVer = (& node -v) 2>$null
if ($nodeVer -match '^v(\d+)\.') {
    if ([int]$Matches[1] -ge 24) { Write-Ok "Node $nodeVer (n8n 2.x needs 24 or newer)" }
    else { Write-Fail "Node $nodeVer is too old for n8n 2.x; install Node 24 LTS"; $fails++ }
} else { Write-Fail 'Node.js not found'; $fails++ }

Write-Step 'Claude Code'
$claudeVer = (& claude --version) 2>$null
if ($LASTEXITCODE -eq 0 -and $claudeVer) { Write-Ok "Claude Code $claudeVer" } else { Write-Fail 'claude not found on PATH'; $fails++ }
if ($env:ANTHROPIC_API_KEY) {
    Write-Fail 'ANTHROPIC_API_KEY is set. Claude Code would bill that API key instead of your subscription. Remove it (System Properties > Environment Variables) or run: Remove-Item Env:ANTHROPIC_API_KEY'
    $fails++
} else { Write-Ok 'ANTHROPIC_API_KEY is not set (Claude Code will use your subscription login)' }
$help = (& claude --help) 2>$null | Out-String
foreach ($flag in @('--json-schema', '--permission-mode', '--tools', '--strict-mcp-config', '--no-session-persistence')) {
    if ($help -match [regex]::Escape($flag)) { Write-Ok "supports $flag" } else { Write-Fail "this Claude Code version lacks $flag; run: claude update"; $fails++ }
}
if ($help -match 'dontAsk') { Write-Ok 'supports permission mode dontAsk' } else { Write-Fail 'permission mode dontAsk not available; run: claude update'; $fails++ }

Write-Step 'Claude connectors (Firecrawl for the free Apollo search)'
$mcp = (& claude mcp list) 2>$null | Out-String
if ($mcp -match '(?i)firecrawl') {
    $line = ($mcp -split "`n" | Where-Object { $_ -match '(?i)firecrawl' } | Select-Object -First 1).Trim()
    Write-Ok "Firecrawl visible to Claude Code: $line"
} else {
    Write-Warn2 'Firecrawl is not visible to Claude Code here. Discovery will still work with web search only (run research with -NoApollo). To enable it, make sure you are logged in with your claude.ai account (/login) and the Firecrawl connector is enabled.'
    $warns++
}

if ($Live) {
    Write-Step 'Live headless test 1: plain reply (tiny subscription usage)'
    $out = 'Reply with exactly: ok' | & claude -p --output-format json --max-turns 2 --tools 'WebSearch' --no-session-persistence 2>&1 | Out-String
    try { $j = $out | ConvertFrom-Json } catch { $j = $null }
    if ($j -and $j.subtype -eq 'success') { Write-Ok "headless mode works (result: $($j.result))" }
    else { Write-Fail "headless call failed: $($out.Substring(0, [Math]::Min(400, $out.Length)))"; $fails++ }

    Write-Step 'Live headless test 2: WebSearch + WebFetch with the zero-cost guard hook'
    New-Item -ItemType Directory -Force -Path (Join-Path $Root 'data\tmp') | Out-Null
    $hook = (Join-Path $Root 'claude\guard-hook.js') -replace '\\', '/'
    $nodeExe = (Get-Command node).Source -replace '\\', '/'
    $settings = '{"hooks":{"PreToolUse":[{"matcher":"*","hooks":[{"type":"command","command":"\"' + $nodeExe + '\" \"' + $hook + '\""}]}]}}'
    $settingsFile = Join-Path $Root 'data\tmp\check.settings.json'
    [IO.File]::WriteAllText($settingsFile, $settings)
    $prompt = 'Use WebSearch once for: Example Domain IANA. Then use WebFetch on https://example.com and reply with only the main heading of that page.'
    $out = $prompt | & claude -p --output-format json --max-turns 6 --tools 'WebSearch,WebFetch' --allowedTools 'WebSearch,WebFetch' --permission-mode dontAsk --settings $settingsFile --strict-mcp-config --no-session-persistence 2>&1 | Out-String
    try { $j = $out | ConvertFrom-Json } catch { $j = $null }
    if ($j -and $j.subtype -eq 'success' -and $j.result -match 'Example Domain') {
        Write-Ok "WebSearch and WebFetch work headless (searches: $($j.usage.server_tool_use.web_search_requests); result: $($j.result.Trim()))"
    } else { Write-Fail "web tools test failed: $($out.Substring(0, [Math]::Min(600, $out.Length)))"; $fails++ }
    if (Test-Path (Join-Path $Root 'data\logs\guard.log')) { Write-Ok 'guard hook ran (see data\logs\guard.log)' } else { Write-Warn2 'guard hook did not log anything'; $warns++ }
}

Write-Step 'Ollama'
try {
    $tags = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 5
    $names = @($tags.models | ForEach-Object { $_.name })
    if ($names -contains 'llama3.2:3b') { Write-Ok "Ollama running; llama3.2:3b present ($($names -join ', '))" }
    else { Write-Warn2 "Ollama running but llama3.2:3b not found ($($names -join ', ')). Set ollama.enabled=false in config\niche.json or change ollama.model."; $warns++ }
    $body = @{ model = 'llama3.2:3b'; prompt = 'Reply as JSON: {"label":"ok"}'; stream = $false; format = 'json'; options = @{ num_predict = 20 } } | ConvertTo-Json
    $r = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/generate' -Method Post -Body $body -ContentType 'application/json' -TimeoutSec 180
    Write-Ok "llama3.2:3b answered in $([Math]::Round($r.total_duration / 1e9, 1)) s: $($r.response.Trim())"
} catch { Write-Warn2 "Ollama not reachable at 127.0.0.1:11434 ($($_.Exception.Message)). The pipeline still runs; scoring just skips the LLM check."; $warns++ }

Write-Step 'n8n'
$n8n = Get-N8nCommand
if ($n8n) {
    $v = (& n8n --version) 2>$null | Select-Object -Last 1
    Write-Ok "n8n found: $n8n (version $v)"
} else { Write-Warn2 'n8n is not installed yet. Install it with: npm install -g n8n@2.43.4'; $warns++ }
if (Test-PortListening 5678) { Write-Warn2 'something is already listening on port 5678 (an n8n instance?)'; $warns++ } else { Write-Ok 'port 5678 is free' }

Write-Step 'Git'
$git = (& git --version) 2>$null
if ($git) { Write-Ok $git } else { Write-Warn2 'git not found (needed only to pull updates)'; $warns++ }

Write-Host ''
if ($fails -eq 0) { Write-Host "Environment check finished: 0 failures, $warns warning(s)." -ForegroundColor Green }
else { Write-Host "Environment check finished: $fails failure(s), $warns warning(s). Fix the failures before continuing." -ForegroundColor Red; exit 1 }
