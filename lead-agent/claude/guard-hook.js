#!/usr/bin/env node
// Claude Code PreToolUse hook: the zero-cost / no-outreach guard.
// It allows only:
//   - WebSearch and WebFetch (included with the Claude subscription),
//   - ToolSearch and StructuredOutput (internal plumbing for loading tools and returning JSON),
//   - Firecrawl's firecrawl_scrape when, and only when, every call is the free
//     Apollo people/search capability (0 credits) with per_page <= 25.
// Everything else is denied: credit-billed Firecrawl calls (url scraping, web search,
// paid Apollo capabilities), Gmail and every other connector, shell, file writes.
// Every decision is appended to data/logs/guard.log.

const fs = require('fs');
const path = require('path');

const ALLOWED_BUILTIN = new Set(['WebSearch', 'WebFetch', 'ToolSearch', 'StructuredOutput']);
const FREE_ALEXANDRIA = new Set(['apollo/people/search']);
const MAX_PER_PAGE = 25;

function decide(event) {
  const tool = String(event.tool_name || '');
  const input = event.tool_input || {};

  if (ALLOWED_BUILTIN.has(tool)) return { decision: 'allow', reason: 'allowed built-in tool' };

  if (/^mcp__.*firecrawl.*__firecrawl_scrape$/i.test(tool)) {
    if (input.url) return { decision: 'deny', reason: 'Firecrawl URL scraping is credit-billed; use WebFetch instead.' };
    const calls = Array.isArray(input.alexandria) ? input.alexandria : input.alexandria ? [input.alexandria] : [];
    if (!calls.length) return { decision: 'deny', reason: 'Only the free Apollo people/search capability is allowed.' };
    for (const c of calls) {
      const id = `${c && c.provider}/${c && c.capability}`;
      if (!FREE_ALEXANDRIA.has(id)) {
        return { decision: 'deny', reason: `Capability ${id} may cost credits; only apollo/people/search (free) is allowed.` };
      }
      const perPage = Number((c.options && c.options.per_page) || 25);
      if (!(perPage > 0 && perPage <= MAX_PER_PAGE)) {
        return { decision: 'deny', reason: `per_page must be between 1 and ${MAX_PER_PAGE}.` };
      }
    }
    return { decision: 'allow', reason: 'free Apollo people/search' };
  }

  return { decision: 'deny', reason: `Tool ${tool} is not on the lead-agent allow-list (zero-cost, no-outreach guard).` };
}

function log(event, result) {
  try {
    const dir = path.join(__dirname, '..', 'data', 'logs');
    fs.mkdirSync(dir, { recursive: true });
    const line = JSON.stringify({
      at: new Date().toISOString(),
      tool: event.tool_name,
      decision: result.decision,
      reason: result.reason,
      input: JSON.stringify(event.tool_input || {}).slice(0, 500),
    });
    fs.appendFileSync(path.join(dir, 'guard.log'), line + '\n');
  } catch (e) { /* logging must never break the guard */ }
}

function main() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (d) => { raw += d; });
  process.stdin.on('end', () => {
    let event = {};
    try { event = JSON.parse(raw || '{}'); } catch (e) { event = {}; }
    const result = decide(event);
    log(event, result);
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: result.decision,
        permissionDecisionReason: result.reason,
      },
    }));
    process.exit(0);
  });
}

if (require.main === module) main();
module.exports = { decide };
