// Lead-agent core logic. Plain JavaScript, no dependencies.
// The same source is unit-tested with `node --test` and embedded verbatim into
// the n8n Code nodes by n8n/build-workflow.mjs, so keep it free of imports.

const LEAD_COLUMNS = [
  'lead_id', 'company_name', 'website', 'domain',
  'location', 'location_source_url',
  'employee_estimate', 'employee_source_url',
  'phone', 'phone_source_url',
  'email', 'email_source_url',
  'decision_maker_name', 'decision_maker_role', 'decision_maker_source_url',
  'process_evidence', 'process_evidence_source_url',
  'job_volume_evidence', 'job_volume_source_url',
  'automation_opportunity_hypothesis', 'outreach_angle_hypothesis',
  'fit_score', 'confidence', 'confidence_label', 'qualification', 'score_breakdown',
  'llm_fit_label', 'llm_fit_reason',
  'unverified_claims', 'all_source_urls',
  'discovery_source', 'discovered_at', 'last_researched_at', 'run_id',
  'outreach_status', 'do_not_contact', 'dnc_reason', 'notes',
];

// Columns a person owns. A later run never overwrites them.
const USER_OWNED_COLUMNS = ['outreach_status', 'do_not_contact', 'dnc_reason', 'notes'];

const OUTREACH_STATUSES = [
  'not_contacted', 'ready_for_review', 'contacted_manually', 'replied',
  'meeting_booked', 'not_interested', 'do_not_contact',
];

const CLAIM_FIELDS = [
  'website', 'industry', 'location', 'employee_count', 'phone', 'email',
  'decision_maker', 'process_evidence', 'job_volume',
];

const LEGAL_SUFFIXES = new Set([
  'inc', 'incorporated', 'llc', 'l l c', 'ltd', 'limited', 'corp', 'corporation',
  'co', 'company', 'lp', 'llp', 'pllc', 'pc', 'plc', 'the',
]);

const MULTI_PART_SUFFIXES = new Set(['co', 'com', 'org', 'net', 'gov', 'ac', 'edu']);

// ---------- normalization ----------

function normalizeDomain(input) {
  if (!input || typeof input !== 'string') return null;
  let s = input.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  s = s.replace(/^[^@/]*@/, ''); // user-info or an email address
  s = s.split(/[/?#]/)[0].split(':')[0].replace(/\.+$/, '');
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(s)) return null;
  const labels = s.split('.').filter(Boolean);
  if (labels[0] === 'www' || /^www\d$/.test(labels[0])) labels.shift();
  if (labels.length < 2) return null;
  const tld = labels[labels.length - 1];
  const sld = labels[labels.length - 2];
  const keep = tld.length === 2 && MULTI_PART_SUFFIXES.has(sld) && labels.length >= 3 ? 3 : 2;
  return labels.slice(-keep).join('.');
}

function normalizeWebsite(input) {
  const domain = normalizeDomain(input);
  return domain ? 'https://' + domain : null;
}

function normalizeCompanyName(name) {
  if (!name || typeof name !== 'string') return null;
  let s = name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
  s = s.replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/\bl l c\b/g, 'llc');
  const words = s.split(' ').filter((w) => w && !LEGAL_SUFFIXES.has(w));
  return words.join(' ') || null;
}

function normalizeState(state) {
  if (!state || typeof state !== 'string') return '';
  return state.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
}

function normalizePhone(input) {
  if (!input || typeof input !== 'string') return null;
  if (/[a-z]{3,}/i.test(input.replace(/\b(ext|x)\b.*$/i, ''))) return null;
  const main = input.replace(/\s*(ext\.?|x)\s*\d+\s*$/i, '');
  let digits = main.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  if (digits.length !== 10) return null;
  if (/^[01]/.test(digits) || /^\d{3}[01]/.test(digits)) return null; // invalid NANP
  return '+1' + digits;
}

function formatPhone(e164) {
  if (!e164) return '';
  const d = e164.replace(/\D/g, '').slice(-10);
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function normalizeEmail(input) {
  if (!input || typeof input !== 'string') return null;
  const s = input.trim().toLowerCase().replace(/^mailto:/, '');
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(s) ? s : null;
}

function dedupeKeys(lead) {
  const domainKey = normalizeDomain(lead.website || lead.domain || '');
  const nameKey = normalizeCompanyName(lead.company_name || '');
  return {
    domainKey,
    nameKey: nameKey ? nameKey + '|' + normalizeState(lead.state || '') : null,
  };
}

// Only public http(s) pages may be fetched for verification. This stops a bad
// source_url from pointing the verifier at n8n, Ollama, or the home network.
// Parsed without the URL class, which the n8n Code sandbox does not provide.
function isPublicHttpUrl(url) {
  const m0 = typeof url === 'string' && url.trim().match(/^https?:\/\/([^/?#]*)/i);
  if (!m0) return false;
  const authority = m0[1];
  if (!authority || authority.includes('@') || authority.startsWith('[')) return false; // credentials, IPv6 literals
  const h = authority.replace(/:\d*$/, '').toLowerCase().replace(/\.$/, '');
  if (!/^[a-z0-9.-]+$/.test(h)) return false;
  if (!h.includes('.') || h === 'localhost' || /\.(local|localhost|internal|lan|home|corp)$/.test(h)) return false;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
  }
  return true;
}

// ---------- page text ----------

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '-', rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', hellip: '...', copy: '(c)', reg: '(r)', trade: '(tm)' };

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);?/gi, (_, h) => safeFromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (_, d) => safeFromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => (n.toLowerCase() in NAMED_ENTITIES ? NAMED_ENTITIES[n.toLowerCase()] : m));
}

function safeFromCodePoint(n) {
  try { return String.fromCodePoint(n); } catch (e) { return ' '; }
}

function htmlToText(html) {
  if (!html || typeof html !== 'string') return '';
  let s = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|header|footer)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  return s.replace(/[ \t\r\f\v ]+/g, ' ').replace(/\n\s*/g, '\n').trim();
}

function normForMatch(s) {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/[^a-z0-9@.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPhones(text) {
  const out = new Set();
  const re = /(?:\+?1[\s.\-]?)?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/g;
  for (const m of String(text || '').matchAll(re)) {
    const p = normalizePhone(m[0]);
    if (p) out.add(p);
  }
  return out;
}

// Longest run of consecutive quote words that appears verbatim on the page.
function longestQuoteRun(quoteNorm, pageNorm, minWords) {
  const words = quoteNorm.split(' ').filter(Boolean).slice(0, 80);
  for (let size = words.length; size >= minWords; size--) {
    for (let i = 0; i + size <= words.length; i++) {
      const frag = words.slice(i, i + size).join(' ');
      if (pageNorm.includes(frag)) return frag;
    }
  }
  return null;
}

// ---------- claim verification ----------
// page = { ok, status, html, finalUrl, error }
// Returns { status: 'verified' | 'partial' | 'unverified' | 'fetch_failed', reason, matched }

function verifyClaim(claim, page) {
  if (!claim || !claim.source_url) return { status: 'unverified', reason: 'no_source_url' };
  if (!page || !page.ok || !page.html) {
    return { status: 'fetch_failed', reason: (page && (page.error || ('http_' + page.status))) || 'not_fetched' };
  }
  const html = page.html;
  const text = htmlToText(html);
  const pageNorm = normForMatch(text);
  const field = claim.field;

  if (field === 'website') {
    const want = normalizeDomain(claim.value);
    const got = normalizeDomain(page.finalUrl || claim.source_url);
    if (want && got && want === got) return { status: 'verified', reason: 'site_reachable' };
    return { status: 'unverified', reason: 'redirected_to_' + (got || 'unknown') };
  }

  if (field === 'phone') {
    const want = normalizePhone(claim.value);
    if (!want) return { status: 'unverified', reason: 'invalid_phone' };
    const hrefs = Array.from(html.matchAll(/tel:([+\d().\-\s%20]+)/gi)).map((m) => { try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; } });
    const found = new Set([...extractPhones(text), ...extractPhones(hrefs.join(' '))]);
    return found.has(want)
      ? { status: 'verified', reason: 'phone_on_page', matched: formatPhone(want) }
      : { status: 'unverified', reason: 'phone_not_on_page' };
  }

  if (field === 'email') {
    const want = normalizeEmail(claim.value);
    if (!want) return { status: 'unverified', reason: 'invalid_email' };
    const hay = (decodeEntities(html) + ' ' + text).toLowerCase();
    return hay.includes(want)
      ? { status: 'verified', reason: 'email_on_page', matched: want }
      : { status: 'unverified', reason: 'email_not_on_page' };
  }

  if (field === 'decision_maker') {
    const name = normForMatch(claim.value);
    if (!name || name.split(' ').length < 2) return { status: 'unverified', reason: 'need_full_name' };
    if (!pageNorm.includes(name)) return { status: 'unverified', reason: 'name_not_on_page' };
    const role = normForMatch(claim.role || '');
    const roleOk = role && pageNorm.includes(role);
    return roleOk
      ? { status: 'verified', reason: 'name_and_role_on_page', matched: claim.value }
      : { status: 'partial', reason: 'name_on_page_role_not_confirmed', matched: claim.value };
  }

  // Quote-backed fields: industry, location, employee_count, process_evidence, job_volume
  const quote = normForMatch(claim.quote || '');
  if (quote.length < 8) return { status: 'unverified', reason: 'quote_missing_or_too_short' };
  if (field === 'employee_count') {
    const nums = String(claim.value || '').match(/\d+/g) || [];
    if (!nums.length || !nums.every((n) => quote.includes(n))) {
      return { status: 'unverified', reason: 'count_not_in_quote' };
    }
  }
  if (pageNorm.includes(quote)) return { status: 'verified', reason: 'quote_on_page', matched: claim.quote };
  const frag = longestQuoteRun(quote, pageNorm, 6);
  if (frag && field !== 'employee_count') return { status: 'partial', reason: 'quote_fragment_on_page', matched: frag };
  return { status: 'unverified', reason: 'quote_not_on_page' };
}

function isVerified(v) {
  return v && (v.status === 'verified' || v.status === 'partial');
}

// ---------- Claude output parsing ----------

function extractJson(text) {
  if (text && typeof text === 'object') return text;
  if (!text || typeof text !== 'string') return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [];
  if (fenced) candidates.push(fenced[1]);
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last > first) candidates.push(text.slice(first, last + 1));
  candidates.push(text);
  for (const c of candidates) {
    try { return JSON.parse(c); } catch (e) { /* try next */ }
  }
  return null;
}

// Accepts the JSON envelope printed by `claude -p --output-format json`.
function parseClaudeEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object') return { ok: false, error: 'empty_envelope' };
  if (envelope.is_error || (envelope.subtype && envelope.subtype !== 'success')) {
    return { ok: false, error: 'claude_' + (envelope.subtype || 'error') + ': ' + String(envelope.result || '').slice(0, 300) };
  }
  const data = envelope.structured_output || extractJson(envelope.result);
  if (!data) return { ok: false, error: 'no_json_in_result' };
  return { ok: true, data };
}

// ---------- lead assembly ----------

function cleanClaims(company) {
  const claims = Array.isArray(company.facts) ? company.facts : [];
  const out = [];
  for (const f of claims) {
    if (!f || !CLAIM_FIELDS.includes(f.field)) continue;
    const url = typeof f.source_url === 'string' ? f.source_url.trim() : '';
    if (!isPublicHttpUrl(url)) continue; // no public source URL, no claim
    out.push({
      field: f.field,
      value: typeof f.value === 'string' ? f.value.trim() : String(f.value ?? ''),
      role: typeof f.role === 'string' ? f.role.trim() : '',
      source_url: url,
      quote: typeof f.quote === 'string' ? f.quote.trim() : '',
    });
  }
  const website = normalizeWebsite(company.website || '');
  if (website && isPublicHttpUrl(website) && !out.some((c) => c.field === 'website')) {
    out.unshift({ field: 'website', value: website, role: '', source_url: website, quote: '' });
  }
  return out;
}

function pickVerified(claims, field) {
  const hits = claims.filter((c) => c.field === field && isVerified(c.verification));
  hits.sort((a, b) => (a.verification.status === 'verified' ? 0 : 1) - (b.verification.status === 'verified' ? 0 : 1));
  return hits[0] || null;
}

function buildLead(company, claims, ctx) {
  const website = normalizeWebsite(company.website || '');
  const domain = normalizeDomain(website || '');
  const get = (f) => pickVerified(claims, f);
  const loc = get('location');
  const emp = get('employee_count');
  const phone = get('phone');
  const email = get('email');
  const dm = get('decision_maker');
  const procs = claims.filter((c) => c.field === 'process_evidence' && isVerified(c.verification));
  const jobs = get('job_volume');
  const unverified = claims
    .filter((c) => !isVerified(c.verification))
    .map((c) => `${c.field}: ${c.value || c.quote} [${c.verification ? c.verification.reason : 'not_checked'}] <${c.source_url}>`);
  const sources = Array.from(new Set(claims.map((c) => c.source_url)));
  const hyp = company.hypotheses || {};
  return {
    lead_id: domain ? 'd:' + domain : 'n:' + (normalizeCompanyName(company.company_name) || 'unknown'),
    company_name: String(company.company_name || '').trim(),
    website: website || '',
    domain: domain || '',
    state: normalizeState(company.state || ''), // used for name-based dedupe only
    location: loc ? loc.value : '',
    location_source_url: loc ? loc.source_url : '',
    employee_estimate: emp ? emp.value : '',
    employee_source_url: emp ? emp.source_url : '',
    phone: phone ? formatPhone(normalizePhone(phone.value)) : '',
    phone_source_url: phone ? phone.source_url : '',
    email: email ? normalizeEmail(email.value) : '',
    email_source_url: email ? email.source_url : '',
    decision_maker_name: dm ? dm.value : '',
    decision_maker_role: dm ? (dm.verification.status === 'verified' ? dm.role : (dm.role ? dm.role + ' (role unconfirmed)' : '')) : '',
    decision_maker_source_url: dm ? dm.source_url : '',
    process_evidence: procs.map((c) => c.verification.matched || c.quote).join(' | '),
    process_evidence_source_url: procs.map((c) => c.source_url).join(' | '),
    job_volume_evidence: jobs ? (jobs.verification.matched || jobs.quote) : '',
    job_volume_source_url: jobs ? jobs.source_url : '',
    automation_opportunity_hypothesis: String(hyp.automation_opportunity || '').trim(),
    outreach_angle_hypothesis: String(hyp.outreach_angle || '').trim(),
    is_target_industry: company.is_target_industry === true,
    unverified_claims: unverified.join(' || '),
    all_source_urls: sources.join(' | '),
    discovery_source: String(company.discovery_source || ctx.discovery_source || '').trim(),
    discovered_at: ctx.now,
    last_researched_at: ctx.now,
    run_id: ctx.run_id,
    outreach_status: 'not_contacted',
    do_not_contact: false,
    dnc_reason: '',
    notes: '',
  };
}

// ---------- scoring ----------

function parseEmployeeRange(value) {
  const nums = (String(value || '').replace(/,/g, '').match(/\d+/g) || []).map(Number);
  if (!nums.length) return null;
  return { lo: Math.min(...nums), hi: Math.max(...nums) };
}

function scoreLead(lead, claims, config, llm) {
  const range = (config && config.employee_range) || { min: 10, max: 100 };
  const thresholds = (config && config.scoring) || { qualified_min_score: 55, review_min_score: 35 };
  const has = (f) => claims.some((c) => c.field === f && isVerified(c.verification));
  const claimed = (f) => claims.some((c) => c.field === f);
  const b = {};

  b.website = has('website') ? 5 : 0;
  b.industry = has('industry') ? 5 : 0;
  const emp = has('employee_count') ? parseEmployeeRange(lead.employee_estimate) : null;
  let sizeFlag = 'unknown';
  if (emp) {
    const overlaps = emp.hi >= range.min && emp.lo <= range.max;
    b.size = overlaps ? 20 : 0;
    sizeFlag = overlaps ? 'in_range' : 'out_of_range';
  } else {
    b.size = 5;
  }
  const procCount = claims.filter((c) => c.field === 'process_evidence' && isVerified(c.verification)).length;
  b.process = procCount >= 2 ? 25 : procCount === 1 ? 20 : 0;
  b.job_volume = has('job_volume') ? 10 : 0;
  b.decision_maker = lead.decision_maker_name ? (lead.decision_maker_role && !/unconfirmed/.test(lead.decision_maker_role) ? 15 : 10) : 0;
  b.contact = (lead.phone ? 8 : 0) + (lead.email ? 7 : 0);
  b.location = has('location') ? 5 : 0;
  // The small local model is advisory by default: its label is shown but only moves the
  // score when config.ollama.affects_score is true (it misjudged test data in evaluation).
  const llmCounts = !!(config && config.ollama && config.ollama.affects_score);
  b.llm = !llmCounts || !llm || !llm.label ? 0 : llm.label === 'strong_fit' ? 5 : llm.label === 'not_fit' ? -10 : 0;

  const score = Math.max(0, Math.min(100, Object.values(b).reduce((a, n) => a + n, 0)));

  const core = ['website', 'industry', 'location', 'employee_count', 'decision_maker', 'process_evidence'];
  let verifiedCore = core.filter((f) => has(f)).length + (lead.phone || lead.email ? 1 : 0);
  const confidence = Math.round((verifiedCore / (core.length + 1)) * 100) / 100;
  const confidence_label = confidence >= 0.67 ? 'high' : confidence >= 0.34 ? 'medium' : 'low';

  let qualification;
  const reasons = [];
  if (!lead.is_target_industry) { qualification = 'rejected'; reasons.push('not_target_industry'); }
  else if (sizeFlag === 'out_of_range') { qualification = 'rejected'; reasons.push('size_out_of_range'); }
  else if (score >= thresholds.qualified_min_score && has('website') && has('industry') && (lead.phone || lead.email)) qualification = 'qualified';
  else if (score >= thresholds.review_min_score) { qualification = 'needs_review'; if (!has('industry')) reasons.push('industry_unverified'); if (!(lead.phone || lead.email)) reasons.push('no_verified_contact'); }
  else qualification = 'low_fit';
  if (!claimed('process_evidence')) reasons.push('no_process_evidence_found');

  const breakdown = Object.entries(b).map(([k, v]) => `${k}:${v}`).join(' ') + (reasons.length ? ' | ' + reasons.join(',') : '') + ' | size:' + sizeFlag;
  return { fit_score: score, confidence, confidence_label, qualification, score_breakdown: breakdown };
}

// ---------- persistence ----------

function parseDncCsv(text) {
  const rows = parseCsv(text || '');
  const set = new Map();
  for (const r of rows) {
    const d = normalizeDomain(r.domain || r.website || '');
    const n = normalizeCompanyName(r.company_name || '');
    const reason = r.reason || 'listed in do_not_contact.csv';
    if (d) set.set('d:' + d, reason);
    if (n) set.set('n:' + n, reason);
  }
  return set;
}

function applyDnc(lead, dnc) {
  const d = normalizeDomain(lead.domain || lead.website || '');
  const n = normalizeCompanyName(lead.company_name || '');
  const reason = (d && dnc.get('d:' + d)) || (n && dnc.get('n:' + n));
  if (reason) {
    lead.do_not_contact = true;
    lead.dnc_reason = reason;
    lead.outreach_status = 'do_not_contact';
  }
  return lead;
}

// db: { leads: { [lead_id]: lead }, meta: {...} }
function findDuplicate(db, lead) {
  const { domainKey, nameKey } = dedupeKeys(lead);
  if (domainKey && db.leads['d:' + domainKey]) return { by: 'domain', id: 'd:' + domainKey };
  if (nameKey) {
    const plainName = nameKey.split('|')[0];
    for (const [id, existing] of Object.entries(db.leads)) {
      if (normalizeCompanyName(existing.company_name) === plainName) return { by: 'name', id };
    }
  }
  return null;
}

function knownCompanies(db) {
  return Object.values(db.leads).map((l) => ({ company_name: l.company_name, domain: l.domain }));
}

// ---------- CSV ----------

function csvCell(v) {
  if (v === null || v === undefined) return '';
  let s = typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // spreadsheet formula injection guard
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function toCsv(rows, columns) {
  const lines = [columns.join(',')];
  for (const r of rows) lines.push(columns.map((c) => csvCell(r[c])).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

function parseCsv(text) {
  const src = String(text || '').replace(/^﻿/, '');
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== '') && !String(r[0]).trim().startsWith('#'));
  if (!nonEmpty.length) return [];
  const header = nonEmpty[0].map((h) => h.trim().toLowerCase());
  return nonEmpty.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] || '').trim()])));
}

const LeadCore = {
  LEAD_COLUMNS, USER_OWNED_COLUMNS, OUTREACH_STATUSES, CLAIM_FIELDS,
  normalizeDomain, normalizeWebsite, normalizeCompanyName, normalizeState, normalizePhone, formatPhone,
  normalizeEmail, dedupeKeys, isPublicHttpUrl, htmlToText, normForMatch, extractPhones, verifyClaim, isVerified,
  extractJson, parseClaudeEnvelope, cleanClaims, buildLead, scoreLead, parseEmployeeRange,
  parseDncCsv, applyDnc, findDuplicate, knownCompanies, toCsv, parseCsv, csvCell,
};

if (typeof module !== 'undefined' && module.exports) module.exports = LeadCore;
