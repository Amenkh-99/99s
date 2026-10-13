const test = require('node:test');
const assert = require('node:assert/strict');
const { decide } = require('../claude/guard-hook.js');

const FC = 'mcp__claude_ai_Firecrawl__firecrawl_scrape';

test('allows subscription web tools and plumbing', () => {
  for (const t of ['WebSearch', 'WebFetch', 'ToolSearch', 'StructuredOutput']) {
    assert.equal(decide({ tool_name: t, tool_input: {} }).decision, 'allow', t);
  }
});

test('allows only the free Apollo people search through Firecrawl', () => {
  const ok = { alexandria: { provider: 'apollo', capability: 'people/search', options: { per_page: 25 } } };
  assert.equal(decide({ tool_name: FC, tool_input: ok }).decision, 'allow');
  assert.equal(decide({ tool_name: 'mcp__firecrawl__firecrawl_scrape', tool_input: { alexandria: [ok.alexandria] } }).decision, 'allow');
});

test('denies every credit-consuming or unknown call', () => {
  const deny = (name, input) => assert.equal(decide({ tool_name: name, tool_input: input }).decision, 'deny', name + ' ' + JSON.stringify(input));
  deny(FC, { url: 'https://example.com' });
  deny(FC, { alexandria: { provider: 'apollo', capability: 'people/match', options: { id: 'x' } } });
  deny(FC, { alexandria: { provider: 'apollo', capability: 'companies/search' } });
  deny(FC, { alexandria: [{ provider: 'apollo', capability: 'people/search' }, { provider: 'apollo', capability: 'people/bulk-match' }] });
  deny(FC, { alexandria: { provider: 'apollo', capability: 'people/search', options: { per_page: 100 } } });
  deny(FC, {});
  deny('mcp__claude_ai_Firecrawl__firecrawl_search', { query: 'x' });
  deny('mcp__claude_ai_Gmail__send_message', { to: 'a@b.com' });
  deny('mcp__claude_ai_Gmail__create_draft', {});
  deny('Bash', { command: 'curl https://x' });
  deny('Write', { file_path: 'x' });
  deny('Edit', {});
  deny('', {});
});
