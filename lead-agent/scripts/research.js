#!/usr/bin/env node
// Manual research runner: discovery -> local dedupe -> batched research with headless Claude Code.
// Writes Claude's JSON results to data/inbox/ for the n8n pipeline to verify, score and store.
//
// Usage (from the lead-agent folder):
//   node scripts/research.js                       full run using config/niche.json limits
//   node scripts/research.js --companies 3         research at most 3 new companies
//   node scripts/research.js --discover-only       only build a candidate list
//   node scripts/research.js --candidates FILE     skip discovery, research companies from a JSON file
//   node scripts/research.js --no-apollo           discovery without the Apollo free search
//   node scripts/research.js --dry-run             print what would run, call nothing

const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const core = require('../src/core.js');

const ROOT = path.resolve(__dirname, '..');
const P = (...p) => path.join(ROOT, ...p);
const DIRS = { inbox: P('data', 'inbox'), discovery: P('data', 'discovery'), logs: P('data', 'logs'), tmp: P('data', 'tmp'), exports: P('data', 'exports') };

function parseArgs(argv) {
  const a = { companies: null, discoverOnly: false, candidates: null, apollo: true, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--companies') a.companies = Number(argv[++i]);
    else if (k === '--discover-only') a.discoverOnly = true;
    else if (k === '--candidates') a.candidates = argv[++i];
    else if (k === '--no-apollo') a.apollo = false;
    else if (k === '--dry-run') a.dryRun = true;
    else if (k === '-h' || k === '--help') { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 12).join('\n')); process.exit(0); }
    else throw new Error('Unknown argument: ' + k);
  }
  return a;
}

function stamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_');
}

let LOG_FILE = null;
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  if (LOG_FILE) fs.appendFileSync(LOG_FILE, line + '\n');
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch (e) { return fallback; }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function appendCsvRow(file, header, row) {
  const exists = fs.existsSync(file);
  const line = header.map((h) => core.csvCell(row[h])).join(',');
  fs.appendFileSync(file, (exists ? '' : header.join(',') + '\r\n') + line + '\r\n', 'utf8');
}

// ---------- locating the claude executable without a shell ----------

function resolveClaude() {
  if (process.env.LEAD_AGENT_CLAUDE) return { cmd: process.env.LEAD_AGENT_CLAUDE, pre: [] };
  if (process.platform !== 'win32') return { cmd: 'claude', pre: [] };
  let found = [];
  try { found = execFileSync('where', ['claude'], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean); } catch (e) { /* none */ }
  const exe = found.find((f) => /\.exe$/i.test(f));
  if (exe) return { cmd: exe, pre: [] };
  const cmdFile = found.find((f) => /\.cmd$/i.test(f));
  if (cmdFile) {
    // npm shim: run the CLI's JavaScript entry point with this Node directly, so
    // arguments containing JSON are passed exactly (no cmd.exe re-quoting).
    const text = fs.readFileSync(cmdFile, 'utf8');
    const m = text.match(/"%(?:~dp0|dp0%)\\?([^"]+\.(?:c?js|mjs))"/i) || text.match(/%~?dp0%?\\([^\s"]+\.(?:c?js|mjs))/i);
    if (m) return { cmd: process.execPath, pre: [path.join(path.dirname(cmdFile), m[1])] };
  }
  throw new Error('Could not find the claude executable. Run "where claude" in a terminal, then set LEAD_AGENT_CLAUDE to its full path.');
}

// ---------- running Claude Code headless ----------

function guardSettingsFile() {
  const hook = P('claude', 'guard-hook.js').replace(/\\/g, '/');
  const nodeExe = process.execPath.replace(/\\/g, '/');
  const settings = {
    hooks: {
      PreToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: `"${nodeExe}" "${hook}"`, timeout: 30 }] }],
    },
  };
  const file = path.join(DIRS.tmp, 'guard.settings.json');
  writeJson(file, settings);
  return file;
}

function runClaude({ stage, prompt, schemaFile, maxTurns, tools, strictMcp, model, timeoutMs, dryRun }) {
  const schema = JSON.stringify(JSON.parse(fs.readFileSync(schemaFile, 'utf8')));
  const args = [
    '-p',
    '--output-format', 'json',
    '--no-session-persistence',
    '--max-turns', String(maxTurns),
    '--tools', tools.join(','),
    '--allowedTools', tools.filter((t) => t !== 'ToolSearch').join(','),
    '--permission-mode', 'dontAsk',
    '--settings', guardSettingsFile(),
    '--json-schema', schema,
  ];
  if (strictMcp) args.push('--strict-mcp-config');
  if (model) args.push('--model', model);

  if (dryRun) {
    log(`[dry-run] ${stage}: claude ${args.map((x) => (x.length > 80 ? x.slice(0, 77) + '...' : x)).join(' ')}`);
    log(`[dry-run] ${stage}: prompt is ${prompt.length} characters`);
    return Promise.resolve({ ok: false, dryRun: true });
  }

  const { cmd, pre } = resolveClaude();
  const env = { ...process.env };
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(cmd, [...pre, ...args], { cwd: ROOT, env, windowsHide: true });
    let out = '', err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    const timer = setTimeout(() => { err += '\n[timeout]'; child.kill(); }, timeoutMs);
    child.on('error', (e) => { err += String(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      const seconds = Math.round((Date.now() - started) / 1000);
      let envelope = null;
      try { envelope = JSON.parse(out); } catch (e) { envelope = core.extractJson(out); }
      const parsed = core.parseClaudeEnvelope(envelope);
      resolve({ ok: code === 0 && parsed.ok, code, seconds, envelope, parsed, stderr: err.trim(), stdout: out });
    });
    child.stdin.end(prompt, 'utf8');
  });
}

function looksLikeUsageLimit(res) {
  const text = `${res.stderr} ${res.envelope ? res.envelope.result : ''} ${res.stdout.slice(0, 2000)}`;
  return /usage limit|rate limit|limit reached|out of extra usage|429/i.test(text);
}

const RUN_LOG_HEADER = ['run_id', 'stage', 'batch', 'started_at', 'seconds', 'ok', 'subtype', 'num_turns', 'companies', 'error'];

async function runWithRetry(opts, ctx) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const startedAt = new Date().toISOString();
    const res = await runClaude(opts);
    if (res.dryRun) return res;
    const env = res.envelope || {};
    const error = res.ok ? '' : (res.parsed.error || res.stderr || 'exit code ' + res.code).slice(0, 400);
    appendCsvRow(path.join(DIRS.logs, 'claude_runs.csv'), RUN_LOG_HEADER, {
      run_id: ctx.runId, stage: opts.stage, batch: ctx.batch || '', started_at: startedAt, seconds: res.seconds,
      ok: res.ok, subtype: env.subtype || '', num_turns: env.num_turns || '', companies: ctx.companies || '', error,
    });
    if (res.ok) return res;
    log(`${opts.stage}: attempt ${attempt} failed: ${error}`);
    if (looksLikeUsageLimit(res)) { res.usageLimit = true; return res; }
    if (env.subtype === 'error_max_turns' || attempt === 2) return res;
    log(`${opts.stage}: waiting 60 s before one retry`);
    await sleep(60000);
  }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ---------- known companies and candidates ----------

function loadKnown() {
  const known = new Map();
  const add = (name, website) => {
    const d = core.normalizeDomain(website || '');
    const n = core.normalizeCompanyName(name || '');
    if (d) known.set('d:' + d, name || d);
    if (n) known.set('n:' + n, name || n);
  };
  for (const k of readJson(path.join(DIRS.exports, 'known_companies.json'), [])) add(k.company_name, k.domain);
  if (fs.existsSync(DIRS.inbox)) {
    for (const f of fs.readdirSync(DIRS.inbox).filter((x) => x.endsWith('.json'))) {
      const parsed = core.parseClaudeEnvelope(readJson(path.join(DIRS.inbox, f), null));
      if (parsed.ok) for (const c of parsed.data.companies || []) add(c.company_name, c.website);
    }
  }
  return known;
}

function isKnown(known, c) {
  const d = core.normalizeDomain(c.website || '');
  const n = core.normalizeCompanyName(c.company_name || '');
  return (d && known.has('d:' + d)) || (n && known.has('n:' + n));
}

function knownListForPrompt(known) {
  const names = Array.from(new Set(Array.from(known.values())));
  if (!names.length) return '(none yet)';
  return names.slice(-400).map((n) => '- ' + n).join('\n');
}

function nicheForPrompt(cfg) {
  const { run_limits, scoring, ollama, claude, verification, ...rest } = cfg;
  return '```json\n' + JSON.stringify(rest, null, 2) + '\n```';
}

function fill(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));
}

// ---------- main ----------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cfg = readJson(P('config', 'niche.json'), null);
  if (!cfg) throw new Error('config/niche.json is missing or not valid JSON');
  for (const d of Object.values(DIRS)) fs.mkdirSync(d, { recursive: true });

  const runId = stamp();
  LOG_FILE = path.join(DIRS.logs, `research_${runId}.log`);
  const limits = cfg.run_limits || {};
  const claudeCfg = cfg.claude || {};
  const batchSize = Math.max(1, limits.companies_per_research_batch || 5);
  const maxCompanies = args.companies || batchSize * Math.max(1, limits.max_research_batches_per_run || 1);
  const pauseMs = 1000 * (limits.pause_seconds_between_claude_runs ?? 20);
  const timeoutMs = 60000 * (claudeCfg.timeout_minutes || 25);

  if (process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is set in this terminal. Claude Code would bill that API key instead of your subscription. ' +
      'Open a new terminal without it (or run: Remove-Item Env:ANTHROPIC_API_KEY) and try again.');
  }

  log(`run ${runId}: researching up to ${maxCompanies} new companies in batches of ${batchSize}`);
  const known = loadKnown();
  log(`known companies (skipped): ${new Set(known.values()).size}`);

  // 1. Discovery
  let candidates = [];
  if (args.candidates) {
    const data = readJson(path.resolve(args.candidates), null);
    candidates = Array.isArray(data) ? data : (data && (data.candidates || (core.parseClaudeEnvelope(data).data || {}).candidates)) || [];
    log(`loaded ${candidates.length} candidates from ${args.candidates}`);
  } else {
    const apolloNote = args.apollo
      ? 'If a Firecrawl tool is available, you may call firecrawl_scrape with exactly this shape and nothing else: ' +
        '{"alexandria": {"provider": "apollo", "capability": "people/search", "options": {"q_keywords": "<keyword>", "person_titles": [<titles>], "person_locations": ["<US state or city>, US"], "per_page": 25, "page": 1}}}. ' +
        'It is free (0 credits). Use its organization names as candidates (surnames are masked; ignore people details). Every other Firecrawl or Apollo capability costs credits and is blocked.'
      : 'Apollo search is disabled for this run; use web search only.';
    const prompt = fill(fs.readFileSync(P('claude', 'discover.prompt.md'), 'utf8'), {
      NICHE: nicheForPrompt(cfg), COUNT: String(Math.min(limits.candidates_per_discovery_run || 25, maxCompanies * 2)),
      KNOWN: knownListForPrompt(known), APOLLO_NOTE: apolloNote,
    });
    log('discovery: starting headless Claude Code');
    const res = await runWithRetry({
      stage: 'discovery', prompt, schemaFile: P('claude', 'discover.schema.json'), maxTurns: limits.discovery_max_turns || 25,
      tools: ['WebSearch', 'WebFetch', 'ToolSearch'], strictMcp: !args.apollo, model: claudeCfg.model, timeoutMs, dryRun: args.dryRun,
    }, { runId });
    if (res.dryRun) candidates = [];
    else {
      writeJson(path.join(DIRS.discovery, `discovery_${runId}.json`), res.envelope || { error: res.stderr });
      if (!res.ok) {
        log(`discovery failed: ${res.parsed.error || res.stderr}`);
        if (res.usageLimit) log('Claude usage limit reached. Stopping; try again after your limit resets.');
        process.exitCode = 1;
        return;
      }
      candidates = res.parsed.data.candidates || [];
      log(`discovery: ${candidates.length} candidates (${(res.parsed.data.sources_used || []).join(', ') || 'no sources listed'})`);
      if (res.parsed.data.notes) log('discovery notes: ' + res.parsed.data.notes);
    }
  }

  // 2. Local dedupe
  const seen = new Set();
  const fresh = [];
  for (const c of candidates) {
    if (!c || !c.company_name) continue;
    if (isKnown(known, c)) continue;
    const key = core.normalizeDomain(c.website || '') || core.normalizeCompanyName(c.company_name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    fresh.push(c);
  }
  const queue = fresh.slice(0, maxCompanies);
  log(`after dedupe: ${fresh.length} new candidates; researching ${queue.length}`);
  if (args.discoverOnly || !queue.length) {
    log(args.discoverOnly ? 'discover-only: done' : 'nothing new to research');
    return;
  }

  // 3. Research in batches
  const template = fs.readFileSync(P('claude', 'research.prompt.md'), 'utf8');
  let written = 0;
  for (let i = 0; i < queue.length; i += batchSize) {
    const batch = queue.slice(i, i + batchSize);
    const n = i / batchSize + 1;
    if (i > 0 && !args.dryRun) { log(`pausing ${pauseMs / 1000} s between Claude runs`); await sleep(pauseMs); }
    const input = batch.map((c) => ({
      company_name: c.company_name, website: c.website || '', city: c.city || '', state: c.state || '',
      discovery_source: c.discovery_source || '', discovery_evidence_url: c.discovery_evidence_url || '',
    }));
    const prompt = fill(template, { NICHE: nicheForPrompt(cfg), CANDIDATES: '```json\n' + JSON.stringify(input, null, 2) + '\n```' });
    log(`research batch ${n}: ${batch.map((c) => c.company_name).join('; ')}`);
    const res = await runWithRetry({
      stage: 'research', prompt, schemaFile: P('claude', 'research.schema.json'), maxTurns: limits.research_max_turns || 60,
      tools: ['WebSearch', 'WebFetch'], strictMcp: true, model: claudeCfg.model, timeoutMs, dryRun: args.dryRun,
    }, { runId, batch: n, companies: batch.length });
    if (res.dryRun) continue;
    if (res.ok) {
      const file = path.join(DIRS.inbox, `research_${runId}_b${n}.json`);
      writeJson(file, res.envelope);
      written++;
      log(`research batch ${n}: saved ${path.relative(ROOT, file)} (${(res.parsed.data.companies || []).length} companies, ${res.envelope.num_turns} turns, ${res.seconds} s)`);
    } else {
      writeJson(path.join(DIRS.logs, `failed_research_${runId}_b${n}.json`), { error: res.parsed.error, stderr: res.stderr, envelope: res.envelope });
      log(`research batch ${n}: failed (${res.parsed.error || res.stderr}); details saved in data/logs`);
      if (res.usageLimit) { log('Claude usage limit reached. Stopping early; results so far are kept.'); break; }
    }
  }
  log(`done: ${written} research file(s) written to data/inbox. Next: run the n8n pipeline (scripts\\run-pipeline.ps1).`);
}

main().catch((e) => { log('ERROR: ' + e.message); process.exitCode = 1; });
