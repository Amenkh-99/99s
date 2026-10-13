#!/usr/bin/env node
// Generates the importable n8n workflow for this machine.
// The pipeline logic lives in src/core.js (unit-tested) and is embedded into the Code nodes,
// and the project folder path is baked in so n8n reads and writes the right files.
//
//   node n8n/build-workflow.js [--project-dir <path>] [--out <file>]

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const arg = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const projectDir = path.resolve(arg('--project-dir', ROOT)).replace(/\\/g, '/');
const out = path.resolve(arg('--out', path.join(ROOT, 'data', 'n8n', 'lead-pipeline.workflow.json')));

const WORKFLOW_ID = 'LeadAgentPipe001';
const CORE = fs.readFileSync(path.join(ROOT, 'src', 'core.js'), 'utf8');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'niche.json'), 'utf8'));
const verifyCfg = cfg.verification || {};

const code = (body) => `${CORE}\n\n// ===== node logic =====\n${body}`;
const uuid = () => crypto.randomUUID();

// ---------- Code node bodies ----------

const SETTINGS = `
const projectDir = ${JSON.stringify(projectDir)};
const now = new Date();
const runId = now.toISOString().replace(/[-:]/g, '').replace(/\\..+/, '').replace('T', '_');
return [{ json: { projectDir, configDir: projectDir + '/config', dataDir: projectDir + '/data', runId, now: now.toISOString() } }];
`;

const PARSE_AND_PLAN = `
const S = $('Settings').first().json;
const all = (name) => { try { return $(name).all(); } catch (e) { return []; } };
// Extract-from-file output items line up 1:1 with the read node's items, which carry the file names.
const named = (textNode, readNode) => {
  const reads = all(readNode);
  return all(textNode).map((it, k) => {
    const idx = it.pairedItem && typeof it.pairedItem.item === 'number' ? it.pairedItem.item : k;
    const src = reads[idx] ? reads[idx].json : {};
    return { fileName: it.json.fileName || src.fileName, data: typeof it.json.data === 'string' ? it.json.data.replace(/^\\ufeff/, '') : null };
  }).filter((f) => f.fileName && f.data !== null);
};
const files = {};
for (const f of named('Config text', 'Read config files')) files[f.fileName] = f.data;
let cfg;
try { cfg = JSON.parse(files['niche.json']); } catch (e) { throw new Error('config/niche.json is missing or not valid JSON: ' + e.message); }

const errors = [];
const dbItem = all('Database text')[0];
const dbOriginalText = dbItem && typeof dbItem.json.data === 'string' ? dbItem.json.data.replace(/^\\ufeff/, '') : '';
let db = { leads: {}, meta: {} };
if (dbOriginalText.trim()) {
  try { db = JSON.parse(dbOriginalText); }
  catch (e) { throw new Error('data/db/leads.json is not valid JSON. Restore the newest file from data/db/backups. ' + e.message); }
}
db.leads = db.leads || {};
db.meta = db.meta || {};
db.meta.processed_files = db.meta.processed_files || [];
db.meta.runs = db.meta.runs || [];

const processed = new Set(db.meta.processed_files);
const newFiles = [];
const companies = [];
for (const f of named('Inbox text', 'Read inbox')) {
  const name = f.fileName;
  if (processed.has(name)) continue;
  newFiles.push(name);
  let env;
  try { env = JSON.parse(f.data); } catch (e) { errors.push({ stage: 'parse', file: name, error: 'invalid JSON file' }); continue; }
  const parsed = LeadCore.parseClaudeEnvelope(env);
  if (!parsed.ok) { errors.push({ stage: 'parse', file: name, error: parsed.error }); continue; }
  for (const c of parsed.data.companies || []) companies.push({ company: c, file: name });
}

const accepted = [];
const duplicates = [];
const seen = new Map();
for (const { company, file } of companies) {
  if (!company || !company.company_name) { errors.push({ stage: 'parse', file, error: 'company without a name' }); continue; }
  const dup = LeadCore.findDuplicate(db, company);
  if (dup) { duplicates.push({ company_name: company.company_name, website: company.website || '', duplicate_of: dup.id, matched_by: dup.by, file }); continue; }
  const k = LeadCore.dedupeKeys(company);
  const key = k.domainKey ? 'd:' + k.domainKey : 'n:' + String(k.nameKey || '').split('|')[0];
  if (seen.has(key)) { duplicates.push({ company_name: company.company_name, website: company.website || '', duplicate_of: seen.get(key), matched_by: 'same_run', file }); continue; }
  seen.set(key, company.company_name);
  accepted.push({ company, claims: LeadCore.cleanClaims(company), file });
}

const maxPages = ${Number(verifyCfg.max_pages_per_run) || 150};
const urls = [];
for (const a of accepted) for (const c of a.claims) if (!urls.includes(c.source_url)) urls.push(c.source_url);
const fetchList = urls.slice(0, maxPages);
if (urls.length > maxPages) errors.push({ stage: 'verify', error: (urls.length - maxPages) + ' pages over the per-run cap were not fetched; their claims stay unverified' });

const plan = { settings: S, cfg, dncText: files['do_not_contact.csv'] || '', updatesText: files['lead_updates.csv'] || '',
  db, dbOriginalText, newFiles, companiesInFiles: companies.length, accepted, duplicates, errors, fetchList };
if (!fetchList.length) return [{ json: { hasUrls: false, plan } }];
return fetchList.map((url, i) => ({ json: i === 0 ? { hasUrls: true, url, plan } : { hasUrls: true, url } }));
`;

const VERIFY = `
const planItems = $('Parse and plan').all();
const plan = planItems[0].json.plan;
let fetched = [];
try { fetched = $('Fetch source pages').all(); } catch (e) { fetched = []; }
const pages = {};
fetched.forEach((it, k) => {
  const idx = it.pairedItem && typeof it.pairedItem.item === 'number' ? it.pairedItem.item : k;
  const url = planItems[idx] && planItems[idx].json.url;
  if (!url) return;
  const j = it.json || {};
  const status = Number(j.statusCode || 0);
  const html = typeof j.body === 'string' ? j.body : typeof j.data === 'string' ? j.data : '';
  const err = j.error ? String(j.error.message || j.error.description || j.error).slice(0, 200) : '';
  pages[url] = { ok: status >= 200 && status < 300 && html.length > 0, status, html, error: err };
});

const fetchErrors = [];
for (const url of plan.fetchList) {
  const p = pages[url];
  if (!p || !p.ok) fetchErrors.push({ stage: 'verify', url, error: p ? (p.error || 'http_' + p.status) : 'not_fetched' });
}

const results = plan.accepted.map((a) => {
  for (const c of a.claims) c.verification = LeadCore.verifyClaim(c, pages[c.source_url]);
  const lead = LeadCore.buildLead(a.company, a.claims, { now: plan.settings.now, run_id: plan.settings.runId });
  return { lead, claims: a.claims, file: a.file };
});
const verified = { results, fetchErrors, pagesFetched: Object.keys(pages).length, pagesOk: Object.values(pages).filter((p) => p.ok).length };

const oll = plan.cfg.ollama || {};
if (!oll.enabled || !results.length) return [{ json: { useOllama: false, verified } }];

const schema = { type: 'object', properties: { label: { type: 'string', enum: ['strong_fit', 'possible_fit', 'not_fit'] }, reason: { type: 'string' } }, required: ['label', 'reason'] };
return results.map((r, i) => {
  const ev = r.claims.filter((c) => LeadCore.isVerified(c.verification) && ['industry', 'process_evidence', 'job_volume', 'employee_count'].includes(c.field))
    .map((c) => '- ' + c.field + ': "' + String(c.verification.matched || c.quote || c.value).slice(0, 300) + '"');
  const prompt = [
    'You classify B2B sales leads. Reply with JSON only.',
    'Our offer: ' + (plan.cfg.offer_summary || ''),
    'Target customer: ' + (plan.cfg.description || ''),
    'Company: ' + r.lead.company_name + ' (' + (r.lead.website || 'no website') + ')',
    'Verified evidence quoted from the company website:',
    ev.length ? ev.join('\\n') : '- (none)',
    'label = "strong_fit" if the evidence shows a ' + (plan.cfg.industry_label || 'target') + ' business with manual intake, screening or follow-up steps our offer could automate;',
    '"possible_fit" if it is a ' + (plan.cfg.industry_label || 'target') + ' business but evidence of manual processes is weak or missing;',
    '"not_fit" if the evidence shows it is not such a business.',
    'reason = one short sentence that cites the evidence. Do not invent facts.',
  ].join('\\n');
  const body = { model: oll.model || 'llama3.2:3b', prompt, stream: false, format: schema, options: { temperature: 0, num_predict: 120 }, keep_alive: '10m' };
  const json = { useOllama: true, i, ollamaUrl: String(oll.url || 'http://127.0.0.1:11434').replace(/\\/+$/, ''), ollamaBody: body };
  if (i === 0) json.verified = verified;
  return { json };
});
`;

const SCORE_AND_SAVE = `
const plan = $('Parse and plan').first().json.plan;
const vItems = $('Verify claims').all();
const verified = vItems[0].json.verified;
const S = plan.settings;
const cfg = plan.cfg;
const errors = [...plan.errors, ...verified.fetchErrors];

// Ollama answers, matched back to the lead they belong to.
const llmByLead = {};
let llmItems = [];
try { llmItems = $('Ollama fit check').all(); } catch (e) { llmItems = []; }
let ollamaOk = 0;
llmItems.forEach((it, k) => {
  const idx = it.pairedItem && typeof it.pairedItem.item === 'number' ? it.pairedItem.item : k;
  const src = vItems[idx] && vItems[idx].json;
  if (!src || typeof src.i !== 'number') return;
  const j = it.json || {};
  let parsed = null;
  try { parsed = JSON.parse(j.response || ''); } catch (e) { parsed = null; }
  if (parsed && ['strong_fit', 'possible_fit', 'not_fit'].includes(parsed.label)) { llmByLead[src.i] = parsed; ollamaOk++; }
  else errors.push({ stage: 'ollama', company: verified.results[src.i] && verified.results[src.i].lead.company_name, error: j.error ? String(j.error.message || j.error).slice(0, 200) : 'no valid JSON answer' });
});

const dnc = LeadCore.parseDncCsv(plan.dncText);
const db = plan.db;
const newLeads = [];
const evidenceRows = [];
for (let i = 0; i < verified.results.length; i++) {
  const { lead, claims } = verified.results[i];
  const llm = llmByLead[i] || null;
  Object.assign(lead, LeadCore.scoreLead(lead, claims, cfg, llm));
  lead.llm_fit_label = llm ? llm.label : '';
  lead.llm_fit_reason = llm ? String(llm.reason || '').slice(0, 300) : '';
  lead.outreach_status = lead.qualification === 'qualified' ? 'ready_for_review' : 'not_contacted';
  LeadCore.applyDnc(lead, dnc);
  db.leads[lead.lead_id] = lead;
  newLeads.push(lead);
  for (const c of claims) {
    evidenceRows.push({ run_id: S.runId, lead_id: lead.lead_id, company_name: lead.company_name, field: c.field, value: c.value, role: c.role,
      source_url: c.source_url, quote: c.quote, verification: c.verification ? c.verification.status : '', reason: c.verification ? c.verification.reason : '',
      matched_text: c.verification && c.verification.matched ? c.verification.matched : '' });
  }
}

// Your manual status updates (config/lead_updates.csv), then the do-not-contact list, which always wins.
const updates = LeadCore.parseCsv(plan.updatesText);
let updatesApplied = 0;
for (const u of updates) {
  const d = LeadCore.normalizeDomain(u.domain || u.website || '');
  const lead = d && db.leads['d:' + d];
  if (!lead) { if (d) errors.push({ stage: 'status_update', error: 'no lead with domain ' + d }); continue; }
  const st = String(u.outreach_status || '').trim();
  if (st) {
    if (LeadCore.OUTREACH_STATUSES.includes(st)) lead.outreach_status = st;
    else errors.push({ stage: 'status_update', error: 'unknown outreach_status "' + st + '" for ' + d });
  }
  if (u.notes) lead.notes = u.notes;
  if (st === 'do_not_contact' || /^(true|yes|1)$/i.test(u.do_not_contact || '')) { lead.do_not_contact = true; lead.outreach_status = 'do_not_contact'; lead.dnc_reason = lead.dnc_reason || u.notes || 'marked in lead_updates.csv'; }
  updatesApplied++;
}
for (const lead of Object.values(db.leads)) LeadCore.applyDnc(lead, dnc);

const count = (q) => newLeads.filter((l) => l.qualification === q).length;
const claimsTotal = evidenceRows.length;
const claimsVerified = evidenceRows.filter((r) => r.verification === 'verified' || r.verification === 'partial').length;
const summary = {
  run_id: S.runId, started_at: S.now, finished_at: new Date().toISOString(),
  inbox_files_new: plan.newFiles.length, companies_in_files: plan.companiesInFiles, duplicates_skipped: plan.duplicates.length,
  new_leads: newLeads.length, qualified: count('qualified'), needs_review: count('needs_review'), low_fit: count('low_fit'), rejected: count('rejected'),
  pages_checked: verified.pagesFetched, pages_ok: verified.pagesOk, claims_total: claimsTotal, claims_verified: claimsVerified,
  ollama_answers: ollamaOk, status_updates_applied: updatesApplied, errors: errors.length, total_leads_in_db: Object.keys(db.leads).length,
};
db.meta.processed_files.push(...plan.newFiles);
db.meta.runs.push(summary);
db.meta.runs = db.meta.runs.slice(-500);
db.meta.updated_at = summary.finished_at;
db.meta.schema_version = 1;

const all = Object.values(db.leads).sort((a, b) => (b.fit_score || 0) - (a.fit_score || 0));
const ready = all.filter((l) => l.qualification === 'qualified' && !l.do_not_contact && ['ready_for_review', 'not_contacted'].includes(l.outreach_status));
const C = LeadCore.LEAD_COLUMNS;
const D = S.dataDir;
const outFiles = [];
const add = (p, text) => outFiles.push({ json: { path: p, text } });
if (plan.dbOriginalText.trim()) add(D + '/db/backups/leads_before_' + S.runId + '.json', plan.dbOriginalText);
add(D + '/db/leads.json', JSON.stringify(db, null, 2) + '\\n');
add(D + '/exports/leads_master.csv', LeadCore.toCsv(all, C));
add(D + '/exports/qualified_ready_for_review.csv', LeadCore.toCsv(ready, C));
add(D + '/exports/known_companies.json', JSON.stringify(all.map((l) => ({ company_name: l.company_name, domain: l.domain })), null, 1) + '\\n');
const EVIDENCE_COLUMNS = ['run_id', 'lead_id', 'company_name', 'field', 'value', 'role', 'source_url', 'quote', 'verification', 'reason', 'matched_text'];
if (newLeads.length) {
  add(D + '/exports/new_leads_' + S.runId + '.csv', LeadCore.toCsv(newLeads, C));
  add(D + '/exports/evidence_' + S.runId + '.csv', LeadCore.toCsv(evidenceRows, EVIDENCE_COLUMNS));
}
add(D + '/logs/run_' + S.runId + '.json', JSON.stringify({ summary, duplicates: plan.duplicates, errors }, null, 2) + '\\n');
add(D + '/logs/run_history.csv', LeadCore.toCsv(db.meta.runs, Object.keys(summary)));
if (errors.length) {
  const rows = errors.map((e) => ({ run_id: S.runId, stage: e.stage || '', file: e.file || '', url: e.url || '', company: e.company || '', error: e.error || '' }));
  add(D + '/logs/errors_' + S.runId + '.csv', LeadCore.toCsv(rows, Object.keys(rows[0])));
}
outFiles[0].json.summary = summary;
return outFiles;
`;

// ---------- nodes ----------

let x = 0;
const pos = () => { x += 220; return [x, 300]; };
const node = (name, type, typeVersion, parameters, extra = {}) => ({ id: uuid(), name, type, typeVersion, position: pos(), parameters, ...extra });
const continueOnError = { onError: 'continueRegularOutput', alwaysOutputData: true };

const BROWSER_HEADERS = [
  { name: 'User-Agent', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' },
  { name: 'Accept', value: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
  { name: 'Accept-Language', value: 'en-US,en;q=0.9' },
];

const ifNode = (name, field) => node(name, 'n8n-nodes-base.if', 2.2, {
  conditions: {
    options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
    conditions: [{ id: uuid(), leftValue: `={{ $json.${field} }}`, rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
    combinator: 'and',
  },
  options: {},
});

const nodes = [
  node('Start (manual)', 'n8n-nodes-base.manualTrigger', 1, {}),
  node('Settings', 'n8n-nodes-base.code', 2, { jsCode: SETTINGS }),
  node('Read config files', 'n8n-nodes-base.readWriteFile', 1.1, { fileSelector: '={{ $json.configDir }}/*.{json,csv}', options: {} }, { executeOnce: true, ...continueOnError }),
  node('Config text', 'n8n-nodes-base.extractFromFile', 1.1, { operation: 'text', options: {} }, continueOnError),
  node('Read lead database', 'n8n-nodes-base.readWriteFile', 1.1, { fileSelector: "={{ $('Settings').first().json.dataDir }}/db/leads.json", options: {} }, { executeOnce: true, ...continueOnError }),
  node('Database text', 'n8n-nodes-base.extractFromFile', 1.1, { operation: 'text', options: {} }, continueOnError),
  node('Read inbox', 'n8n-nodes-base.readWriteFile', 1.1, { fileSelector: "={{ $('Settings').first().json.dataDir }}/inbox/research_*.json", options: {} }, { executeOnce: true, ...continueOnError }),
  node('Inbox text', 'n8n-nodes-base.extractFromFile', 1.1, { operation: 'text', options: {} }, continueOnError),
  node('Parse and plan', 'n8n-nodes-base.code', 2, { jsCode: code(PARSE_AND_PLAN) }),
  ifNode('Any pages to check?', 'hasUrls'),
  node('Fetch source pages', 'n8n-nodes-base.httpRequest', 4.2, {
    url: '={{ $json.url }}',
    sendHeaders: true,
    headerParameters: { parameters: BROWSER_HEADERS },
    options: {
      batching: { batch: { batchSize: 1, batchInterval: Number(verifyCfg.delay_ms) || 1500 } },
      redirect: { redirect: { maxRedirects: 5 } },
      response: { response: { fullResponse: true, neverError: true, responseFormat: 'text', outputPropertyName: 'body' } },
      timeout: Number(verifyCfg.timeout_ms) || 20000,
    },
  }, { retryOnFail: true, maxTries: 3, waitBetweenTries: 3000, ...continueOnError }),
  node('Verify claims', 'n8n-nodes-base.code', 2, { jsCode: code(VERIFY) }),
  ifNode('Use Ollama?', 'useOllama'),
  node('Ollama fit check', 'n8n-nodes-base.httpRequest', 4.2, {
    method: 'POST',
    url: '={{ $json.ollamaUrl }}/api/generate',
    sendBody: true,
    specifyBody: 'json',
    jsonBody: '={{ JSON.stringify($json.ollamaBody) }}',
    options: { batching: { batch: { batchSize: 1, batchInterval: 0 } }, timeout: 180000 },
  }, { retryOnFail: true, maxTries: 2, waitBetweenTries: 5000, ...continueOnError }),
  node('Score and save', 'n8n-nodes-base.code', 2, { jsCode: code(SCORE_AND_SAVE) }),
  node('To file', 'n8n-nodes-base.convertToFile', 1.1, { operation: 'toText', sourceProperty: 'text', options: { fileName: 'output.txt' } }),
  node('Write files', 'n8n-nodes-base.readWriteFile', 1.1, { operation: 'write', fileName: "={{ $('Score and save').item.json.path }}", options: {} }),
];

const byName = Object.fromEntries(nodes.map((n) => [n.name, n]));
const link = (from, to, output = 0) => {
  connections[from] = connections[from] || { main: [] };
  while (connections[from].main.length <= output) connections[from].main.push([]);
  connections[from].main[output].push({ node: to, type: 'main', index: 0 });
};
const connections = {};
const chain = ['Start (manual)', 'Settings', 'Read config files', 'Config text', 'Read lead database', 'Database text', 'Read inbox', 'Inbox text', 'Parse and plan', 'Any pages to check?'];
for (let i = 0; i < chain.length - 1; i++) link(chain[i], chain[i + 1]);
link('Any pages to check?', 'Fetch source pages', 0);
link('Any pages to check?', 'Verify claims', 1);
link('Fetch source pages', 'Verify claims');
link('Verify claims', 'Use Ollama?');
link('Use Ollama?', 'Ollama fit check', 0);
link('Use Ollama?', 'Score and save', 1);
link('Ollama fit check', 'Score and save');
link('Score and save', 'To file');
link('To file', 'Write files');

// lay out the two branches a little lower for readability
byName['Fetch source pages'].position[1] = 180;
byName['Ollama fit check'].position[1] = 180;

const workflow = {
  id: WORKFLOW_ID,
  name: 'Lead Agent - verify, score and save (manual)',
  active: false,
  nodes,
  connections,
  settings: { executionOrder: 'v1', saveManualExecutions: true, saveDataErrorExecution: 'all', saveDataSuccessExecution: 'all' },
  pinData: {},
  meta: { generatedBy: 'lead-agent/n8n/build-workflow.js', projectDir },
};

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(workflow, null, 2) + '\n', 'utf8');
console.log('Workflow written to ' + out);
console.log('Project folder baked in: ' + projectDir);
