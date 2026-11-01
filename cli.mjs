// cli.mjs — claim-receipt-gate on the command line. build-skill.mjs bundles this with kernel.mjs (the same
// logic the live page runs) into scripts/claim-receipt-gate.mjs, the single file the Agensi skill runs.
// It reads a draft post and the build-receipt behind it, pulls out every checkable claim (links, "live",
// "CI green", "verified", K/N scores, percents) and says which ones the receipt backs. No model in the loop.
// Exit 0 = SHIP (every checkable claim backed) · 1 = REFUSE · 2 = the input could not be used.
import { readFileSync } from 'node:fs';
import { gatePost, makePostReceipt, receiptValid } from './kernel.mjs';

const USAGE = `usage: node claim-receipt-gate.mjs <input.json | ->
input:  {"post": "<text>" | {"text"} | {"hook","reveal","cta"},
         "receipt": {"url", "live", "ci", "witness": {"clean","killed","total"} | null, "facts": [{"key","value"}]},
         "sealedAt": "<ISO time, optional: seal a passed post into a content-addressed post-receipt>"}
output: a JSON report on stdout. exit 0 = SHIP, 1 = REFUSE, 2 = bad input`;

class InputError extends Error {}
const fail = (msg) => { throw new InputError(msg); };

function readText(path) {
  try { return readFileSync(path === '-' ? 0 : path, 'utf8'); }
  catch (e) { return fail(`cannot read ${path === '-' ? 'stdin' : path}: ${e.code || e.message}`); }
}

const slim = (c) => {
  const o = { type: c.type, claim: c.raw, why: c.why };
  return o;
};

function gate(input) {
  const rv = receiptValid(input.receipt);
  const g = gatePost(input.post, input.receipt);
  const report = {
    tool: 'claim-receipt-gate',
    verdict: g.ok ? 'SHIP' : 'REFUSE',
    why: g.why,
    receiptValid: rv.ok,
    checked: g.checked,
    backed: g.backed.map(slim),
    unbacked: g.unbacked.map(slim),
  };
  if (g.ok && typeof input.sealedAt === 'string' && input.sealedAt.length > 0) {
    const s = makePostReceipt(input.post, input.receipt, { sealedAt: input.sealedAt });
    if (s.ok) report.postReceipt = s.receipt;
  }
  return { exitCode: g.ok ? 0 : 1, report };
}

function main(args) {
  if (args.length !== 1 || args[0] === '-h' || args[0] === '--help') {
    process.stderr.write(USAGE + '\n');
    return 2;
  }
  let input;
  try { input = JSON.parse(readText(args[0])); } catch (e) { if (e instanceof InputError) throw e; fail(`the input is not valid JSON (${e.message})`); }
  if (!input || typeof input !== 'object' || Array.isArray(input) || !('post' in input) || !('receipt' in input)) {
    fail('the input must be an object with "post" (the draft) and "receipt" (the build-receipt behind it)');
  }
  const { exitCode, report } = gate(input);
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  return exitCode;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (e) {
  process.stderr.write(`claim-receipt-gate: ${e instanceof InputError ? e.message : 'internal error: ' + (e && e.message)}\n`);
  process.exitCode = e instanceof InputError ? 2 : 3;
}
