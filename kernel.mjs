// post-proof — the gate every announcement passes before it ships. A post may CLAIM only what a
// verifiable BUILD-RECEIPT backs: the live URL (a real 200), CI's conclusion, the mutation-witness
// verdict, and a whitelist of measured facts. One inflated receipt poisons six true ones, so the
// rail refuses the inflated post — deterministically, no model in the loop. checkClaims names the
// exact unproven words. Every gate decision lands on a SHA-256 ledger; a passed post seals a
// content-addressed receipt that verifies anywhere.
//
// PURE and TOTAL: never fetches (the runner does the real 200 / CI / witness probes and hands the
// receipt here); garbage in gives { ok:false, why }, never a throw. This is the ai-native-doctrine
// ("the receipt-audit applies to our own posts hardest") made mechanical, wired before the rail
// alongside fallscrub — no receipt, no post.

export const CI_STATES = Object.freeze(['success', 'failure', null]);
export const CLAIM_TYPES = Object.freeze(['url', 'live', 'ci', 'clean', 'score', 'pct']);

const isStr = (v) => typeof v === 'string';
const isBool = (v) => typeof v === 'boolean';
const isInt = (v) => Number.isInteger(v);
const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

// ── SHA-256 + canonical JSON (the estate's proven pair, verbatim) ───────────────────────────────
const K256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function sha256(text) {
  if (!isStr(text)) return { ok: false, why: 'sha256 takes a string' };
  const data = new TextEncoder().encode(text);
  const len = data.length;
  const padded = new Uint8Array((((len + 8) >> 6) << 6) + 64);
  padded.set(data);
  padded[len] = 0x80;
  const dv = new DataView(padded.buffer);
  const bitLen = len * 8;
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 4294967296));
  dv.setUint32(padded.length - 4, bitLen >>> 0);
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const w = new Uint32Array(64);
  for (let i = 0; i < padded.length; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = dv.getUint32(i + t * 4);
    for (let t = 16; t < 64; t++) {
      const x = w[t - 15], y = w[t - 2];
      const s0 = (((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)) >>> 0;
      const s1 = (((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10)) >>> 0;
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, hh = h7;
    for (let t = 0; t < 64; t++) {
      const S1 = (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const t1 = (hh + S1 + ch + K256[t] + w[t]) >>> 0;
      const S0 = (((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + hh) >>> 0;
  }
  const hex = (n) => n.toString(16).padStart(8, '0');
  return { ok: true, hash: hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4) + hex(h5) + hex(h6) + hex(h7) };
}

export function canon(v) {
  if (v === null || typeof v === 'number' || typeof v === 'boolean') return JSON.stringify(v);
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return '"?"';
}

// ── the build-receipt: proof-of-play of a shipped thing, produced by REAL probes ────────────────
// { url, live:bool (a real 200 was observed), ci:'success'|'failure'|null,
//   witness:{clean:bool, killed:int, total:int} | null, does:string,
//   facts:[{key, value}] — extra measured facts a post may cite (e.g. {key:'beats', value:'16/16'},
//   or {key:'link', value:'https://...'} to whitelist an outbound link that is not the product URL) }
export function receiptValid(receipt) {
  const r = receipt;
  if (!isObj(r)) return { ok: false, why: 'a build-receipt is an object' };
  if (!isStr(r.url) || r.url.length === 0) return { ok: false, why: 'the receipt needs a url' };
  if (!/^https?:\/\//.test(r.url)) return { ok: false, why: 'the url must be an http or https address' };
  if (!isBool(r.live)) return { ok: false, why: 'live must be a boolean (a real 200 was observed, or it was not)' };
  if (!CI_STATES.includes(r.ci)) return { ok: false, why: 'ci must be success, failure, or null' };
  if (r.witness !== null && r.witness !== undefined) {
    const w = r.witness;
    if (!isObj(w)) return { ok: false, why: 'witness is null, absent, or an object' };
    if (!isBool(w.clean)) return { ok: false, why: 'witness.clean must be a boolean' };
    if (!isInt(w.killed) || w.killed < 0) return { ok: false, why: 'witness.killed must be a non-negative integer' };
    if (!isInt(w.total) || w.total < 1) return { ok: false, why: 'witness.total must be a positive integer' };
    if (w.killed > w.total) return { ok: false, why: 'witness.killed cannot exceed witness.total' };
    // NB: clean can be true with killed fewer than total — survivors carry a written equivalence
    // argument (the estate's baseline model), so clean is an independent boolean, not killed===total.
  }
  if (r.does !== undefined && !isStr(r.does)) return { ok: false, why: 'does, if present, is a string' };
  if (r.facts !== undefined) {
    if (!Array.isArray(r.facts)) return { ok: false, why: 'facts, if present, is an array' };
    for (let i = 0; i < r.facts.length; i++) {
      const f = r.facts[i];
      if (!isObj(f) || !isStr(f.key) || f.key.length === 0 || !isStr(f.value) || f.value.length === 0) {
        return { ok: false, why: 'fact ' + i + ' needs a non-empty key and value' };
      }
    }
  }
  return { ok: true, why: 'the receipt is well-formed and internally consistent' };
}

// ── the text of a post: hook + reveal + cta, or a plain { text } ─────────────────────────────────
export function postText(post) {
  if (isStr(post)) return post;
  if (!isObj(post)) return '';
  if (isStr(post.text) && post.text.length > 0) return post.text;
  return [post.hook, post.reveal, post.cta].filter((s) => isStr(s) && s.length > 0).join('\n\n');
}

// ── claim extraction: pull only the CHECKABLE claims out of a draft, conservatively ─────────────
// A number that is not a K/N score or a percent is left alone ("7 layers" is not a witness score).
export function extractClaims(text) {
  if (!isStr(text)) return [];
  const claims = [];
  const seen = new Set();
  const add = (c) => { const k = c.type + '|' + c.raw; if (!seen.has(k)) { seen.add(k); claims.push(c); } };
  let m;
  const urlRx = /https?:\/\/[^\s)\]]+/g;
  while ((m = urlRx.exec(text)) !== null) add({ type: 'url', raw: m[0], value: m[0].replace(/[.,;:]+$/, '') });
  const scoreRx = /\b(\d{1,4})\s*\/\s*(\d{1,4})\b/g;
  while ((m = scoreRx.exec(text)) !== null) add({ type: 'score', raw: m[0], killed: Number(m[1]), total: Number(m[2]) });
  const pctRx = /\b(\d{1,3}(?:\.\d+)?)\s*%/g;
  while ((m = pctRx.exec(text)) !== null) add({ type: 'pct', raw: m[0], value: m[1] });
  if (/\b(live|shipped|deployed|in production)\b/i.test(text)) add({ type: 'live', raw: 'live' });
  if (/\bci (?:is )?green\b|\bci passing\b|\btests? pass(?:ing|ed)?\b|\bgreen on [^.]*runner\b|\bbuild green\b/i.test(text)) add({ type: 'ci', raw: 'ci-green' });
  if (/\bwitness[- ]clean\b|\bmutation[- ]clean\b|\bgate[- ]?clean\b|\bprovably\b|\bverified\b/i.test(text)) add({ type: 'clean', raw: 'verified' });
  return claims;
}

// ── adjudicate every claim against the receipt ──────────────────────────────────────────────────
function factHas(receipt, value) {
  const facts = Array.isArray(receipt.facts) ? receipt.facts : [];
  return facts.some((f) => isObj(f) && isStr(f.value) && f.value.indexOf(value) !== -1);
}
function linkWhitelisted(receipt, value) {
  const facts = Array.isArray(receipt.facts) ? receipt.facts : [];
  return facts.some((f) => isObj(f) && f.key === 'link' && f.value === value);
}

export function checkClaims(text, receipt) {
  const rv = receiptValid(receipt);
  if (!rv.ok) return { ok: false, why: 'the receipt is invalid: ' + rv.why };
  const claims = extractClaims(text);
  const backed = [], unbacked = [];
  for (const c of claims) {
    let ok = false, why = '';
    if (c.type === 'url') {
      if (c.value === receipt.url && receipt.live === true) { ok = true; why = 'the live product url'; }
      else if (linkWhitelisted(receipt, c.value)) { ok = true; why = 'a whitelisted link'; }
      else why = 'cites a url the receipt does not back as a live product url or a whitelisted link';
    } else if (c.type === 'live') {
      if (receipt.live === true) { ok = true; why = 'the receipt observed a 200'; }
      else why = 'says it is live but the receipt observed no 200';
    } else if (c.type === 'ci') {
      if (receipt.ci === 'success') { ok = true; why = 'ci concluded success'; }
      else why = 'claims ci is green but the receipt ci concluded ' + String(receipt.ci);
    } else if (c.type === 'clean') {
      if (isObj(receipt.witness) && receipt.witness.clean === true) { ok = true; why = 'the witness is clean'; }
      else why = 'claims verified or clean but the receipt witness is not clean';
    } else if (c.type === 'score') {
      if (isObj(receipt.witness) && receipt.witness.killed === c.killed && receipt.witness.total === c.total) { ok = true; why = 'the witness killed count'; }
      else if (factHas(receipt, c.raw)) { ok = true; why = 'a measured fact'; }
      else why = 'claims a ' + c.raw + ' score the receipt does not back';
    } else if (c.type === 'pct') {
      if (factHas(receipt, c.raw) || factHas(receipt, c.value)) { ok = true; why = 'a measured fact'; }
      else why = 'claims ' + c.raw + ' but no receipt fact backs it';
    }
    (ok ? backed : unbacked).push({ ...c, why });
  }
  return { ok: unbacked.length === 0, backed, unbacked, checked: claims.length };
}

// ── the gate: the composite the rail calls. A post ships only if every checkable claim is backed. ─
export function gatePost(post, receipt) {
  const rv = receiptValid(receipt);
  if (!rv.ok) return { ok: false, why: 'cannot gate against an invalid receipt: ' + rv.why, unbacked: [], backed: [], checked: 0 };
  const text = postText(post);
  if (text.length === 0) return { ok: false, why: 'no post text to check', unbacked: [], backed: [], checked: 0 };
  const cc = checkClaims(text, receipt);
  return {
    ok: cc.ok, unbacked: cc.unbacked, backed: cc.backed, checked: cc.checked,
    why: cc.ok
      ? (cc.checked === 0 ? 'no checkable claim in the post — nothing to refute, but nothing proven either' : 'every one of the ' + cc.checked + ' checkable claims is backed by the receipt')
      : cc.unbacked.length + ' unbacked claim(s) — refused before the rail: ' + cc.unbacked.map((u) => u.raw).join(', '),
  };
}

// ── the post-receipt: a passed post sealed to its backing receipt, content-addressed ────────────
export function makePostReceipt(post, receipt, meta) {
  const g = gatePost(post, receipt);
  if (!g.ok) return { ok: false, why: 'will not seal a post that failed the gate: ' + g.why };
  if (!isObj(meta) || !isStr(meta.sealedAt) || meta.sealedAt.length === 0) return { ok: false, why: 'meta needs a sealedAt timestamp' };
  const text = postText(post);
  const ph = sha256(text);
  const rh = sha256(canon(receipt));
  const body = {
    v: 1, kind: 'post-proof-receipt',
    url: receipt.url, postHash: ph.hash, receiptHash: rh.hash,
    claimsBacked: g.backed.length, claimTypes: g.backed.map((b) => b.type).sort(),
    sealedAt: meta.sealedAt,
    scope: 'every checkable claim in this post is backed by the named build-receipt — it proves the post did not overclaim, not that the post is persuasive',
  };
  const h = sha256(canon(body));
  if (!h.ok) return { ok: false, why: h.why };
  return { ok: true, receipt: { ...body, hash: h.hash } };
}

export function verifyPostReceipt(r) {
  if (!isObj(r) || !isStr(r.hash)) return { ok: false, why: 'a receipt is an object with a hash' };
  if (r.kind !== 'post-proof-receipt') return { ok: false, why: 'not a post-proof receipt' };
  const body = { ...r };
  delete body.hash;
  const h = sha256(canon(body));
  if (!h.ok) return { ok: false, why: h.why };
  return { ok: true, valid: h.hash === r.hash };
}

// ── the post ledger: every gate decision, hash-chained (what we claimed and what backed it) ─────
export function appendPostLedger(chain, post, receipt) {
  if (!Array.isArray(chain)) return { ok: false, why: 'the post ledger is an array' };
  const g = gatePost(post, receipt);
  if (!isStr(receipt && receipt.url)) return { ok: false, why: 'the receipt needs a url to ledger' };
  const text = postText(post);
  const entry = { url: receipt.url, postHash: sha256(text).hash, shipped: g.ok, checked: g.checked, unbacked: g.unbacked.length };
  const prevHash = chain.length === 0 ? 'GENESIS' : chain[chain.length - 1].hash;
  const h = sha256(prevHash + '|' + canon(entry));
  if (!h.ok) return { ok: false, why: h.why };
  return { ok: true, chain: [...chain, { seq: chain.length, prevHash, hash: h.hash, entry }], decision: g };
}

export function verifyPostLedger(chain) {
  if (!Array.isArray(chain)) return { ok: false, why: 'the post ledger is an array' };
  for (let i = 0; i < chain.length; i++) {
    const item = chain[i];
    if (!isObj(item) || !isStr(item.hash) || !isStr(item.prevHash) || !isObj(item.entry)) return { ok: true, valid: false, brokenAt: i };
    if (item.seq !== i) return { ok: true, valid: false, brokenAt: i };
    const expectedPrev = i === 0 ? 'GENESIS' : chain[i - 1].hash;
    if (item.prevHash !== expectedPrev) return { ok: true, valid: false, brokenAt: i };
    const h = sha256(item.prevHash + '|' + canon(item.entry));
    if (!h.ok || h.hash !== item.hash) return { ok: true, valid: false, brokenAt: i };
  }
  return { ok: true, valid: true, length: chain.length };
}

export default gatePost;
