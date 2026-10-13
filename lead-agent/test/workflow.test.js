// Builds the n8n workflow into a temp folder and checks it is importable and safe:
// valid JSON, consistent connections, Code nodes that compile, and no schedule,
// webhook, shell or email nodes (manual trigger only, inactive).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

function buildWorkflow() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lead-agent-wf-'));
  const out = path.join(dir, 'workflow.json');
  execFileSync(process.execPath, [path.join(ROOT, 'n8n', 'build-workflow.js'), '--project-dir', dir, '--out', out], { stdio: 'pipe' });
  return JSON.parse(fs.readFileSync(out, 'utf8'));
}

const wf = buildWorkflow();

test('workflow has the fixed id, is inactive and has unique node names', () => {
  assert.equal(wf.id, 'LeadAgentPipe001');
  assert.equal(wf.active, false);
  const names = wf.nodes.map((n) => n.name);
  assert.equal(new Set(names).size, names.length, 'duplicate node names');
  for (const n of wf.nodes) {
    assert.ok(n.id && n.type && typeof n.typeVersion === 'number' && Array.isArray(n.position) && n.parameters, `incomplete node ${n.name}`);
  }
});

test('every connection points at an existing node', () => {
  const names = new Set(wf.nodes.map((n) => n.name));
  for (const [from, conn] of Object.entries(wf.connections)) {
    assert.ok(names.has(from), `connection from unknown node ${from}`);
    for (const outputs of conn.main) for (const c of outputs) assert.ok(names.has(c.node), `connection to unknown node ${c.node}`);
  }
  const targets = new Set(Object.values(wf.connections).flatMap((c) => c.main.flat().map((x) => x.node)));
  for (const n of wf.nodes) if (n.type !== 'n8n-nodes-base.manualTrigger') assert.ok(targets.has(n.name), `${n.name} is never reached`);
});

test('manual trigger only: no schedule, webhook, shell, email or connector nodes', () => {
  const triggers = wf.nodes.filter((n) => /trigger|cron|webhook/i.test(n.type));
  assert.deepEqual(triggers.map((n) => n.type), ['n8n-nodes-base.manualTrigger']);
  const allowed = new Set([
    'n8n-nodes-base.manualTrigger', 'n8n-nodes-base.code', 'n8n-nodes-base.readWriteFile', 'n8n-nodes-base.extractFromFile',
    'n8n-nodes-base.if', 'n8n-nodes-base.httpRequest', 'n8n-nodes-base.convertToFile',
  ]);
  for (const n of wf.nodes) assert.ok(allowed.has(n.type), `unexpected node type ${n.type} (${n.name})`);
  for (const n of wf.nodes.filter((x) => x.type === 'n8n-nodes-base.httpRequest')) {
    assert.ok(!n.parameters.authentication, `${n.name} must not use credentials`);
  }
});

test('every Code node compiles as an n8n async function body', () => {
  const codeNodes = wf.nodes.filter((n) => n.type === 'n8n-nodes-base.code');
  assert.ok(codeNodes.length >= 4);
  for (const n of codeNodes) {
    assert.doesNotThrow(() => new AsyncFunction('$', '$input', n.parameters.jsCode), `${n.name} has a syntax error`);
  }
});
