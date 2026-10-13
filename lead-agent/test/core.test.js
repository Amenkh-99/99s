const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/core.js');

test('normalizeDomain strips scheme, www, path, port and subdomains', () => {
  assert.equal(C.normalizeDomain('https://www.AcmeStaffing.com/contact?x=1'), 'acmestaffing.com');
  assert.equal(C.normalizeDomain('http://jobs.acmestaffing.com:8080/'), 'acmestaffing.com');
  assert.equal(C.normalizeDomain('acmestaffing.com'), 'acmestaffing.com');
  assert.equal(C.normalizeDomain('info@acmestaffing.com'), 'acmestaffing.com');
  assert.equal(C.normalizeDomain('https://www.example.co.uk/a'), 'example.co.uk');
  assert.equal(C.normalizeDomain('not a url'), null);
  assert.equal(C.normalizeDomain(''), null);
});

test('normalizeCompanyName removes legal suffixes and punctuation', () => {
  assert.equal(C.normalizeCompanyName('Acme Staffing, Inc.'), 'acme staffing');
  assert.equal(C.normalizeCompanyName('ACME STAFFING LLC'), 'acme staffing');
  assert.equal(C.normalizeCompanyName('The Smith & Jones Group, L.L.C.'), 'smith and jones group');
});

test('normalizePhone handles US formats and rejects junk', () => {
  assert.equal(C.normalizePhone('(214) 555-0199'), '+12145550199');
  assert.equal(C.normalizePhone('+1 214.555.0199'), '+12145550199');
  assert.equal(C.normalizePhone('214-555-0199 ext. 12'), '+12145550199');
  assert.equal(C.normalizePhone('555-0199'), null);
  assert.equal(C.normalizePhone('call us today'), null);
  assert.equal(C.formatPhone('+12145550199'), '(214) 555-0199');
});

test('normalizeEmail validates and lowercases', () => {
  assert.equal(C.normalizeEmail('mailto:Info@AcmeStaffing.com'), 'info@acmestaffing.com');
  assert.equal(C.normalizeEmail('info at acme'), null);
});

const PAGE_HTML = `<!doctype html><html><head><script>var x="(999) 999-9999";</script></head><body>
<h1>Contact Acme Staffing</h1>
<p>Call us at <a href="tel:+12145550199">(214) 555-0199</a> or email
<a href="mailto:info@acmestaffing.com">info&#64;acmestaffing.com</a>.</p>
<p>Employers: to request staff, download our Job Order Form and email it to orders@acmestaffing.com.</p>
<div class="team"><h3>Jane Q. Doe</h3><p>President &amp; Founder</p></div>
<p>Our team of 35 recruiters serves Dallas, TX since 2009.</p>
</body></html>`;
const page = { ok: true, status: 200, html: PAGE_HTML, finalUrl: 'https://www.acmestaffing.com/contact' };

test('verifyClaim confirms facts that are on the page', () => {
  assert.equal(C.verifyClaim({ field: 'phone', value: '214-555-0199', source_url: 'https://acmestaffing.com/contact' }, page).status, 'verified');
  assert.equal(C.verifyClaim({ field: 'email', value: 'info@acmestaffing.com', source_url: 'x://' + 'a' }, page).status, 'verified');
  assert.equal(C.verifyClaim({ field: 'decision_maker', value: 'Jane Q. Doe', role: 'President', source_url: 'https://a' }, page).status, 'verified');
  assert.equal(C.verifyClaim({ field: 'process_evidence', value: 'manual job order form', quote: 'download our Job Order Form and email it to orders@acmestaffing.com', source_url: 'https://a' }, page).status, 'verified');
  assert.equal(C.verifyClaim({ field: 'employee_count', value: '35', quote: 'Our team of 35 recruiters', source_url: 'https://a' }, page).status, 'verified');
  assert.equal(C.verifyClaim({ field: 'website', value: 'https://acmestaffing.com', source_url: 'https://acmestaffing.com' }, page).status, 'verified');
});

test('verifyClaim rejects facts that are not on the page (anti-hallucination)', () => {
  assert.equal(C.verifyClaim({ field: 'phone', value: '(999) 999-9999', source_url: 'https://a' }, page).status, 'unverified', 'phone inside <script> must not count');
  assert.equal(C.verifyClaim({ field: 'phone', value: '(214) 555-0100', source_url: 'https://a' }, page).status, 'unverified');
  assert.equal(C.verifyClaim({ field: 'email', value: 'ceo@acmestaffing.com', source_url: 'https://a' }, page).status, 'unverified');
  assert.equal(C.verifyClaim({ field: 'decision_maker', value: 'John Smith', role: 'CEO', source_url: 'https://a' }, page).status, 'unverified');
  assert.equal(C.verifyClaim({ field: 'decision_maker', value: 'Jane', role: 'President', source_url: 'https://a' }, page).status, 'unverified', 'first name only is not enough');
  assert.equal(C.verifyClaim({ field: 'employee_count', value: '50', quote: 'Our team of 35 recruiters', source_url: 'https://a' }, page).status, 'unverified');
  assert.equal(C.verifyClaim({ field: 'process_evidence', value: 'x', quote: 'We use an AI chatbot for all intake', source_url: 'https://a' }, page).status, 'unverified');
  assert.equal(C.verifyClaim({ field: 'phone', value: '214-555-0199', source_url: '' }, page).reason, 'no_source_url');
  assert.equal(C.verifyClaim({ field: 'phone', value: '214-555-0199', source_url: 'https://a' }, { ok: false, status: 403 }).status, 'fetch_failed');
});

test('verifyClaim accepts a long verbatim fragment of a paraphrased quote as partial', () => {
  const r = C.verifyClaim({ field: 'process_evidence', value: 'x', quote: 'Employers: to request staff, download our Job Order Form and fax it back to us', source_url: 'https://a' }, page);
  assert.equal(r.status, 'partial');
  assert.match(r.matched, /download our job order form/);
});

test('decision maker with unconfirmed role is partial', () => {
  const r = C.verifyClaim({ field: 'decision_maker', value: 'Jane Q. Doe', role: 'CEO', source_url: 'https://a' }, page);
  assert.equal(r.status, 'partial');
});

test('extractJson and parseClaudeEnvelope', () => {
  assert.deepEqual(C.extractJson('Here:\n```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(C.extractJson('blah {"a":{"b":2}} trailing'), { a: { b: 2 } });
  assert.equal(C.extractJson('no json'), null);
  assert.deepEqual(C.parseClaudeEnvelope({ subtype: 'success', is_error: false, structured_output: { x: 1 }, result: '' }), { ok: true, data: { x: 1 } });
  assert.equal(C.parseClaudeEnvelope({ subtype: 'error_max_turns', is_error: true, result: '' }).ok, false);
});

function researchedCompany() {
  return {
    company_name: 'Acme Staffing, Inc.',
    website: 'https://www.acmestaffing.com',
    state: 'TX',
    is_target_industry: true,
    discovery_source: 'web_search',
    facts: [
      { field: 'industry', value: 'staffing agency', source_url: 'https://acmestaffing.com/contact', quote: 'Contact Acme Staffing' },
      { field: 'phone', value: '(214) 555-0199', source_url: 'https://acmestaffing.com/contact', quote: '' },
      { field: 'email', value: 'info@acmestaffing.com', source_url: 'https://acmestaffing.com/contact', quote: '' },
      { field: 'decision_maker', value: 'Jane Q. Doe', role: 'President', source_url: 'https://acmestaffing.com/contact', quote: '' },
      { field: 'process_evidence', value: 'manual job order form', source_url: 'https://acmestaffing.com/contact', quote: 'download our Job Order Form and email it to orders@acmestaffing.com' },
      { field: 'employee_count', value: '35', source_url: 'https://acmestaffing.com/contact', quote: 'Our team of 35 recruiters' },
      { field: 'location', value: 'Dallas, TX', source_url: 'https://acmestaffing.com/contact', quote: 'serves Dallas, TX since 2009' },
      { field: 'email', value: 'ceo@acmestaffing.com', source_url: 'https://acmestaffing.com/contact', quote: '' },
      { field: 'phone', value: '(214) 555-0100', source_url: '', quote: '' },
    ],
    hypotheses: { automation_opportunity: 'Replace emailed job order form with a web intake flow.', outreach_angle: 'Faster employer order intake.' },
  };
}

test('cleanClaims drops claims without a source URL and adds the website claim', () => {
  const claims = C.cleanClaims(researchedCompany());
  assert.equal(claims[0].field, 'website');
  assert.ok(!claims.some((c) => c.value === '(214) 555-0100'));
});

test('buildLead + scoreLead only promote verified facts and qualify a strong lead', () => {
  const company = researchedCompany();
  const claims = C.cleanClaims(company);
  for (const c of claims) c.verification = C.verifyClaim(c, c.field === 'website' ? { ...page, finalUrl: 'https://acmestaffing.com/' } : page);
  const lead = C.buildLead(company, claims, { now: '2026-10-13T00:00:00Z', run_id: 'r1' });
  assert.equal(lead.domain, 'acmestaffing.com');
  assert.equal(lead.phone, '(214) 555-0199');
  assert.equal(lead.email, 'info@acmestaffing.com');
  assert.equal(lead.decision_maker_name, 'Jane Q. Doe');
  assert.match(lead.unverified_claims, /ceo@acmestaffing.com/);
  const s = C.scoreLead(lead, claims, { employee_range: { min: 10, max: 100 }, scoring: { qualified_min_score: 55, review_min_score: 35 } }, null);
  assert.equal(s.qualification, 'qualified');
  assert.ok(s.fit_score >= 80, 'score ' + s.fit_score);
  assert.equal(s.confidence_label, 'high');
});

test('scoreLead rejects non-target industry and out-of-range size', () => {
  const company = { ...researchedCompany(), is_target_industry: false };
  const claims = C.cleanClaims(company);
  for (const c of claims) c.verification = C.verifyClaim(c, page);
  const lead = C.buildLead(company, claims, { now: 'n', run_id: 'r' });
  assert.equal(C.scoreLead(lead, claims, {}, null).qualification, 'rejected');

  const big = researchedCompany();
  big.facts = big.facts.map((f) => (f.field === 'employee_count' ? { ...f, value: '2009', quote: 'serves Dallas, TX since 2009' } : f));
  const claims2 = C.cleanClaims(big);
  for (const c of claims2) c.verification = C.verifyClaim(c, page);
  const lead2 = C.buildLead(big, claims2, { now: 'n', run_id: 'r' });
  assert.equal(C.scoreLead(lead2, claims2, {}, null).qualification, 'rejected');
});

test('lead with nothing verified is low_fit with low confidence', () => {
  const company = researchedCompany();
  const claims = C.cleanClaims(company);
  for (const c of claims) c.verification = C.verifyClaim(c, { ok: false, status: 403 });
  const lead = C.buildLead(company, claims, { now: 'n', run_id: 'r' });
  assert.equal(lead.phone, '');
  assert.equal(lead.email, '');
  assert.equal(lead.decision_maker_name, '');
  const s = C.scoreLead(lead, claims, {}, null);
  assert.equal(s.qualification, 'low_fit');
  assert.equal(s.confidence_label, 'low');
});

test('dedupe by domain and by normalized name', () => {
  const db = { leads: { 'd:acmestaffing.com': { company_name: 'Acme Staffing Inc', domain: 'acmestaffing.com' } } };
  assert.equal(C.findDuplicate(db, { website: 'http://www.acmestaffing.com/jobs', company_name: 'X' }).by, 'domain');
  assert.equal(C.findDuplicate(db, { website: 'https://acme-staff.net', company_name: 'ACME STAFFING, LLC' }).by, 'name');
  assert.equal(C.findDuplicate(db, { website: 'https://other.com', company_name: 'Other Staffing' }), null);
});

test('do-not-contact list marks matching leads', () => {
  const dnc = C.parseDncCsv('domain,company_name,reason\n# comment line\nacmestaffing.com,,asked not to be contacted\n,Beta Recruiting LLC,competitor\n');
  const a = C.applyDnc({ domain: 'acmestaffing.com', company_name: 'Acme', outreach_status: 'not_contacted' }, dnc);
  assert.equal(a.do_not_contact, true);
  assert.equal(a.outreach_status, 'do_not_contact');
  const b = C.applyDnc({ domain: 'beta.com', company_name: 'Beta Recruiting' }, dnc);
  assert.equal(b.dnc_reason, 'competitor');
  const c = C.applyDnc({ domain: 'gamma.com', company_name: 'Gamma' }, dnc);
  assert.equal(c.do_not_contact, undefined);
});

test('CSV round trip with quotes, commas, newlines and formula guard', () => {
  const rows = [{ a: 'x,"y"', b: 'line1\nline2', c: '=HYPERLINK("evil")' }];
  const csv = C.toCsv(rows, ['a', 'b', 'c']);
  const back = C.parseCsv(csv);
  assert.equal(back[0].a, 'x,"y"');
  assert.equal(back[0].b, 'line1\nline2');
  assert.equal(back[0].c, '\'=HYPERLINK("evil")');
});

test('isPublicHttpUrl blocks local and private network targets', () => {
  assert.equal(C.isPublicHttpUrl('https://acmestaffing.com/contact'), true);
  for (const bad of ['http://localhost:5678/rest', 'http://127.0.0.1:11434/api/tags', 'http://192.168.1.1/', 'http://10.0.0.5/',
    'http://172.20.1.1/', 'http://169.254.169.254/latest', 'file:///C:/Windows', 'ftp://x.com', 'http://router.local/', 'http://[::1]/', 'not a url']) {
    assert.equal(C.isPublicHttpUrl(bad), false, bad);
  }
  const claims = C.cleanClaims({ website: 'acme.com', facts: [{ field: 'phone', value: '2145550199', source_url: 'http://127.0.0.1:5678/x', quote: '' }] });
  assert.deepEqual(claims.map((c) => c.field), ['website']);
});

test('Ollama label is advisory unless affects_score is enabled', () => {
  const company = researchedCompany();
  const claims = C.cleanClaims(company);
  for (const c of claims) c.verification = C.verifyClaim(c, page);
  const lead = C.buildLead(company, claims, { now: 'n', run_id: 'r' });
  const base = C.scoreLead(lead, claims, {}, null).fit_score;
  assert.equal(C.scoreLead(lead, claims, {}, { label: 'not_fit' }).fit_score, base);
  assert.equal(C.scoreLead(lead, claims, { ollama: { affects_score: true } }, { label: 'not_fit' }).fit_score, base - 10);
});
