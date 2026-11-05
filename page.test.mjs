// page.test.mjs — the page keeps its promise to load nothing and send nothing, and the browser is what holds it to that:
// its Content-Security-Policy allows no source anywhere (default-src 'none'), names each of the page's own inline scripts
// by SHA-256 and no other script, and no element on the page loads anything from elsewhere. make-page.mjs writes the
// policy; this checks it independently against the committed index.html (which CI's page fixpoint ties to make-page).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const page = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const meta = page.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/);
const policy = meta ? Object.fromEntries(meta[1].split(';').map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v])) : {};

test('the page carries a Content-Security-Policy, before any script', () => {
  assert.ok(meta, 'no Content-Security-Policy meta element');
  assert.ok(page.indexOf(meta[0]) < page.indexOf('<script'));
  assert.ok(page.indexOf(meta[0]) < page.indexOf('<body') || page.indexOf('<body') === -1);
});

test('it allows no source anywhere: nothing loads from elsewhere, nothing connects', () => {
  assert.deepEqual(policy['default-src'], ["'none'"]);
  // left out on purpose, so each falls back to default-src 'none'
  for (const d of ['connect-src', 'font-src', 'frame-src', 'child-src', 'worker-src', 'media-src', 'object-src', 'manifest-src', 'prefetch-src']) {
    assert.equal(policy[d], undefined, d);
  }
  assert.deepEqual(policy['img-src'], ['data:']);
  assert.deepEqual(policy['style-src'], ["'unsafe-inline'"]);
  assert.deepEqual(policy['base-uri'], ["'none'"]);
  assert.deepEqual(policy['form-action'], ["'none'"]);
  assert.deepEqual(Object.keys(policy).sort(), ['base-uri', 'default-src', 'form-action', 'img-src', 'script-src', 'style-src']);
});

test("only the page's own inline scripts may run, each named by its SHA-256", () => {
  const inline = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map((m) => "'sha256-" + createHash('sha256').update(m[1], 'utf8').digest('base64') + "'");
  assert.ok(inline.length > 0);
  assert.deepEqual(policy['script-src'], inline);
  for (const s of policy['script-src']) assert.match(s, /^'sha256-[A-Za-z0-9+/]{43}='$/, s);   // no 'unsafe-…', no host, no *
});

test('no element loads anything from elsewhere', () => {
  const scripts = [...page.matchAll(/<script\b([^>]*)>/g)].map((m) => m[1].trim());
  for (const a of scripts) assert.ok(a === '' || a === 'type="application/json" id="basis"', 'an unexpected script element: ' + a);
  assert.doesNotMatch(page, /<(?:img|iframe|frame|audio|video|source|track|embed|object|portal)\b/i);
  for (const [l] of page.matchAll(/<link\b[^>]*>/gi)) assert.match(l, /\shref="data:/, l);
  assert.doesNotMatch(page, /@import|url\(\s*['"]?(?:https?:)?\/\//i);
  assert.doesNotMatch(page, /<base\b/i);
});
