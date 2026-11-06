#!/usr/bin/env node
// make-page.mjs — builds every generated part of index.html from the repository, so the page cannot drift from it:
//   1. the claim-gate kernel (kernel.mjs) and the cost-case kernel (costcase.mjs), exports stripped, injected verbatim;
//   2. the sourced cost basis (vendor/sovereign-enterprise/data/basis.json), injected verbatim as JSON;
//   3. every number the page states about the build — each <… data-fact="key"> element — read from receipts/,
//      examples/, the test files and the kernels (an unknown key stops the build);
//   4. the real-run trace (examples/refuse.json + refuse.out.json, ship.json + ship.out.json), claim by claim;
//   5. the Content-Security-Policy: no source allowed anywhere, and only the page's own inline scripts, each named by
//      the SHA-256 of its text as built here (so the browser itself refuses any request, and any script, it does not name).
// CI runs this and fails if index.html changes (git diff --exit-code): nothing on the page about the build is typed in.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { CLAIM_TYPES } from './kernel.mjs';
import { BASIS_KEYS } from './costcase.mjs';

const read = (f) => readFileSync(new URL('./' + f, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const json = (f) => JSON.parse(read(f));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const die = (msg) => { console.error('make-page: ' + msg); process.exit(1); };
const strip = (src) => src.replace(/^export default .*;?\s*$/gm, '')   // drop the default re-export (stripping only "export " would leave invalid "default …")
  .replace(/^export /gm, '').trimEnd();

let page = read('index.html');

function between(begin, end, body) {
  const a = page.indexOf(begin), b = page.indexOf(end);
  if (a === -1 || b === -1 || b < a) die('markers missing: ' + begin);
  page = page.slice(0, a + begin.length) + '\n' + body + '\n' + page.slice(b);
}

// 1 · the kernels
const kernel = strip(read('kernel.mjs'));
between('// ⟦KERNEL-BEGIN⟧ generated from kernel.mjs by make-page.mjs — do not edit here', '// ⟦KERNEL-END⟧', kernel);
const costcase = strip(read('costcase.mjs'));
between('// ⟦COSTCASE-BEGIN⟧ generated from costcase.mjs by make-page.mjs — do not edit here', '// ⟦COSTCASE-END⟧', costcase);

// 2 · the sourced basis, verbatim (it is JSON inside a JSON script element, so it must not close the element)
const basisRaw = read('vendor/sovereign-enterprise/data/basis.json').trimEnd();
if (basisRaw.includes('</')) die('the basis contains "</" and cannot sit inside a script element');
JSON.parse(basisRaw);
page = page.replace(/(<script type="application\/json" id="basis">)[\s\S]*?(<\/script>)/, (m, a, b) => a + '\n' + basisRaw + '\n' + b);

// 3 · the facts
const W = json('receipts/witness.json'), WC = json('receipts/witness-costcase.json');
const RF = json('examples/refuse.json'), RO = json('examples/refuse.out.json');
const SH = json('examples/ship.json'), SO = json('examples/ship.out.json');
const SRC = json('vendor/SOURCES.json').files.find((f) => f.path === 'vendor/sovereign-enterprise/data/basis.json');
const testsIn = (f) => (read(f).match(/^test\(/gm) || []).length;
const lines = (f) => read(f).trimEnd().split('\n').length;
const ofType = (list, t) => list.filter((c) => c.type === t).length;
const RU = RO.report.unbacked, SB = SO.report.backed;
const facts = {
  'w.tag': W.witness.tag,
  'w.k.total': W.total, 'w.k.killed': W.killed, 'w.k.ignored': W.ignored.length, 'w.k.survived': W.survived.length,
  'w.k.sha': W.kernelSha256.slice(0, 12),
  'w.k.platform': ({ win32: 'Windows', linux: 'Linux', darwin: 'macOS' })[W.platform] || W.platform, 'w.k.node': W.node,
  'w.c.total': WC.total, 'w.c.killed': WC.killed, 'w.c.ignored': WC.ignored.length, 'w.c.survived': WC.survived.length,
  'w.c.sha': WC.kernelSha256.slice(0, 12),
  'tests.kernel': testsIn('kernel.test.mjs'), 'tests.costcase': testsIn('costcase.test.mjs'),
  'lines.kernel': lines('kernel.mjs'), 'lines.costcase': lines('costcase.mjs'), 'lines.cli': lines('cli.mjs'),
  'claim.types': CLAIM_TYPES.length,
  'refuse.checked': RO.report.checked, 'refuse.unbacked': RU.length, 'refuse.backed': RO.report.backed.length,
  'refuse.verdict': RO.report.verdict, 'refuse.exit': RO.exitCode,
  'refuse.url': ofType(RU, 'url'), 'refuse.score': ofType(RU, 'score'), 'refuse.pct': ofType(RU, 'pct'), 'refuse.mult': ofType(RU, 'mult'),
  'refuse.live': ofType(RU, 'live'), 'refuse.clean': ofType(RU, 'clean'), 'refuse.ci': ofType(RU, 'ci'),
  'refuse.r.live': String(RF.receipt.live), 'refuse.r.ci': String(RF.receipt.ci),
  'refuse.r.witness': RF.receipt.witness.killed + '/' + RF.receipt.witness.total + (RF.receipt.witness.clean ? ', clean' : ', not clean'),
  'refuse.r.facts': (RF.receipt.facts || []).length,
  'ship.checked': SO.report.checked, 'ship.backed': SB.length, 'ship.unbacked': SO.report.unbacked.length,
  'ship.verdict': SO.report.verdict, 'ship.exit': SO.exitCode, 'ship.seal': SO.report.postReceipt.hash.slice(0, 16),
  'ship.r.witness': SH.receipt.witness.killed + '/' + SH.receipt.witness.total + (SH.receipt.witness.clean ? ', clean' : ', not clean'),
  'basis.figures': BASIS_KEYS.length, 'basis.sha': SRC.sha256.slice(0, 12), 'basis.commit': SRC.commit.slice(0, 7), 'basis.repo': SRC.repo,
};
for (const [k, v] of Object.entries(facts)) if (v === undefined || v === null || Number.isNaN(v)) die('fact ' + k + ' could not be read');
const used = new Set();
let placed = 0;
page = page.replace(/<(span|b|tspan|code|strong)((?: [a-z-]+="[^"]*")*?) data-fact="([a-z0-9.\-]+)"((?: [a-z-]+="[^"]*")*)>[^<]*<\/\1>/g, (m, tag, pre, key, post) => {
  if (!(key in facts)) die('unknown fact on the page: ' + key);
  used.add(key); placed++;
  return '<' + tag + pre + ' data-fact="' + key + '"' + post + '>' + esc(facts[key]) + '</' + tag + '>';
});
const tagged = (page.match(/ data-fact="/g) || []).length;
if (tagged !== placed) die(tagged + ' data-fact elements on the page but ' + placed + ' filled: each must be a span, b, tspan, code or strong holding text only');

// 4 · the real-run trace
const postOf = (p) => typeof p === 'string' ? p : (p.text || [p.hook, p.reveal, p.cta].filter(Boolean).join(' '));
const item = (c, ok) => '<li class="' + (ok ? 'yes' : 'no') + '"><span class="mk">' + (ok ? '✓' : '✗') + '</span> <span class="tag">' + esc(c.type) +
  '</span> <b>' + esc(c.claim) + '</b> — ' + esc(c.why) + '</li>';
const trace = [
  '<div class="trace">',
  '<p class="mut mono">examples/refuse.json · the draft</p>',
  '<blockquote>' + esc(postOf(RF.post)) + '</blockquote>',
  '<p class="mut mono">its receipt: live ' + esc(RF.receipt.live) + ' · ci ' + esc(RF.receipt.ci) + ' · witness ' + esc(facts['refuse.r.witness']) +
    ' · facts: ' + esc((RF.receipt.facts || []).map((f) => f.value).join('; ') || 'none') + '</p>',
  '<p class="stamp no">' + esc(RO.report.verdict) + ' · exit ' + esc(RO.exitCode) + ' · ' + esc(RO.report.why) + '</p>',
  '<ul class="claims">', ...RU.map((c) => item(c, false)), ...RO.report.backed.map((c) => item(c, true)), '</ul>',
  '<p class="mut mono">examples/ship.json · its honest twin</p>',
  '<blockquote>' + esc(postOf(SH.post)) + '</blockquote>',
  '<p class="stamp ok">' + esc(SO.report.verdict) + ' · exit ' + esc(SO.exitCode) + ' · ' + esc(SO.report.why) + ' · sealed ' + esc(facts['ship.seal']) + '…</p>',
  '<ul class="claims">', ...SB.map((c) => item(c, true)), ...SO.report.unbacked.map((c) => item(c, false)), '</ul>',
  '</div>',
].join('\n');
between('<!-- ⟦TRACE-BEGIN⟧ generated by make-page.mjs from examples/ — do not edit here -->', '<!-- ⟦TRACE-END⟧ -->', trace);

// 5 · the Content-Security-Policy, last, so it hashes the scripts exactly as written to the page
const scriptHashes = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map((m) => "'sha256-" + createHash('sha256').update(m[1], 'utf8').digest('base64') + "'");
if (scriptHashes.length === 0) die('no inline scripts to name in the Content-Security-Policy');
const policy = "default-src 'none'; script-src " + scriptHashes.join(' ') + "; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'";
const CSP = /<meta http-equiv="Content-Security-Policy" content="[^"]*">/;
if (!CSP.test(page)) die('the Content-Security-Policy meta element is missing');
page = page.replace(CSP, '<meta http-equiv="Content-Security-Policy" content="' + policy + '">');

writeFileSync(new URL('./index.html', import.meta.url), page);
console.log('page built: kernel ' + kernel.length + ' chars · cost case ' + costcase.length + ' chars · basis ' +
  createHash('sha256').update(basisRaw + '\n').digest('hex').slice(0, 12) + ' · ' + placed + ' facts placed (' + used.size + ' distinct) · ' + scriptHashes.length + ' scripts named in the CSP');
