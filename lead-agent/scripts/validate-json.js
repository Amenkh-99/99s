#!/usr/bin/env node
// Checks that every committed JSON file parses, and that the JSON Schemas Claude Code
// receives (--json-schema) are well-formed object schemas.
//   node scripts/validate-json.js [rootDir]

const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const SKIP = new Set(['.git', 'node_modules', 'data', 'archive']);

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.json')) out.push(p);
  }
  return out;
}

function checkSchema(schema, where, errors) {
  if (!schema || typeof schema !== 'object') return errors.push(`${where}: not an object`);
  if (schema.type === 'object') {
    const props = schema.properties || {};
    for (const r of schema.required || []) if (!(r in props)) errors.push(`${where}: required "${r}" is not in properties`);
    for (const [k, v] of Object.entries(props)) checkSchema(v, `${where}.${k}`, errors);
  } else if (schema.type === 'array') {
    checkSchema(schema.items, `${where}[]`, errors);
  } else if (!['string', 'boolean', 'number', 'integer'].includes(schema.type)) {
    errors.push(`${where}: unknown type ${JSON.stringify(schema.type)}`);
  }
}

const files = walk(root, []);
let failed = 0;
for (const f of files) {
  const rel = path.relative(root, f);
  const errors = [];
  let data;
  try { data = JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, '')); }
  catch (e) { errors.push(e.message); }
  if (data && f.endsWith('.schema.json')) {
    if (data.type !== 'object') errors.push('top-level schema must be type "object"');
    checkSchema(data, '$', errors);
  }
  if (errors.length) { failed++; for (const e of errors) console.log(`::error file=${rel}::${e}`); }
  else console.log(`ok  ${rel}`);
}
console.log(`${files.length} JSON file(s) checked, ${failed} failed`);
process.exit(failed ? 1 : 0);
