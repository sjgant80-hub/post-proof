import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CI_STATES, CLAIM_TYPES, sha256, canon, receiptValid, postText, extractClaims, checkClaims,
  gatePost, makePostReceipt, verifyPostReceipt, appendPostLedger, verifyPostLedger,
} from './kernel.mjs';

// ── the dogfood fixture: agent-proof's OWN real receipt (130/133 clean, live, CI green) ──────────
const RECEIPT = {
  url: 'https://sjgant80-hub.github.io/agent-proof/',
  live: true,
  ci: 'success',
  witness: { clean: true, killed: 130, total: 133 },
  does: 'a deterministic policy gate + tamper-evident audit trail for AI agents',
  facts: [
    { key: 'no-judge', value: 'no LLM judge' },
    { key: 'link', value: 'https://eur-lex.europa.eu/eli/reg/2024/1689/oj' },
  ],
};

// a HONEST post: every claim it makes is backed by the receipt
const GOOD = {
  hook: 'We shipped agent-proof — prove an AI agent obeyed its rules, with a receipt that can say FAILS.',
  reveal: 'It is live, CI green on GitHub\'s runner, and witness-clean 130/133. No LLM judge.',
  cta: 'See it: https://sjgant80-hub.github.io/agent-proof/',
};

// a HYPED post: claims that OUTRUN the receipt (wrong score, a metric with no fact, a foreign url)
const HYPED = {
  hook: 'agent-proof is live and 100% bulletproof.',
  reveal: 'Witness 200/200, CI green, provably unbreakable — 3x faster than anything.',
  cta: 'Buy now at https://not-our-domain.example/agent-proof',
};

test('sha256 + canon are the proven pair (known vector, stable order)', () => {
  assert.equal(sha256('abc').hash, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(canon({ b: 1, a: 2 }), '{"a":2,"b":1}');
  assert.equal(sha256(123).ok, false);
});

test('CI_STATES + CLAIM_TYPES are the frozen vocabularies', () => {
  assert.deepEqual([...CI_STATES], ['success', 'failure', null]);
  assert.deepEqual([...CLAIM_TYPES], ['url', 'live', 'ci', 'clean', 'score', 'pct', 'mult']);
  assert.throws(() => { CI_STATES.push('pending'); });
});

test('receiptValid accepts the real agent-proof receipt', () => {
  const v = receiptValid(RECEIPT);
  assert.equal(v.ok, true);
});

test('receiptValid rejects each malformed shape', () => {
  assert.equal(receiptValid(null).ok, false);
  assert.equal(receiptValid({}).ok, false);
  assert.equal(receiptValid({ url: '' }).ok, false);
  assert.equal(receiptValid({ url: 'ftp://x' }).ok, false);
  assert.equal(receiptValid({ url: 'https://x', live: 'yes' }).ok, false);
  assert.equal(receiptValid({ url: 'https://x', live: true, ci: 'pending' }).ok, false);
});

test('receiptValid: ci=null and ci=failure are both valid', () => {
  assert.equal(receiptValid({ url: 'https://x', live: false, ci: null }).ok, true);
  assert.equal(receiptValid({ url: 'https://x', live: false, ci: 'failure' }).ok, true);
});

test('receiptValid: witness boundaries — killed within [0,total]', () => {
  const base = { url: 'https://x', live: true, ci: 'success' };
  assert.equal(receiptValid({ ...base, witness: { clean: true, killed: 0, total: 1 } }).ok, true);   // killed=0 ok
  assert.equal(receiptValid({ ...base, witness: { clean: true, killed: -1, total: 1 } }).ok, false);  // killed=-1 refused
  assert.equal(receiptValid({ ...base, witness: { clean: true, killed: 5, total: 5 } }).ok, true);    // killed===total ok
  assert.equal(receiptValid({ ...base, witness: { clean: true, killed: 6, total: 5 } }).ok, false);   // killed>total refused
  assert.equal(receiptValid({ ...base, witness: { clean: true, killed: 1, total: 0 } }).ok, false);   // total<1 refused
  assert.equal(receiptValid({ ...base, witness: { clean: 1, killed: 1, total: 1 } }).ok, false);      // clean not bool
});

test('receiptValid: clean may be true with killed fewer than total (baselined equivalents)', () => {
  const v = receiptValid({ url: 'https://x', live: true, ci: 'success', witness: { clean: true, killed: 130, total: 133 } });
  assert.equal(v.ok, true);
});

test('receiptValid: facts must be non-empty key+value pairs', () => {
  const base = { url: 'https://x', live: true, ci: 'success', witness: null };
  assert.equal(receiptValid({ ...base, facts: [{ key: 'a', value: 'b' }] }).ok, true);
  assert.equal(receiptValid({ ...base, facts: [{ key: '', value: 'b' }] }).ok, false);
  assert.equal(receiptValid({ ...base, facts: [{ key: 'a', value: '' }] }).ok, false);
  assert.equal(receiptValid({ ...base, facts: 'nope' }).ok, false);
});

test('postText composes hook/reveal/cta, honours plain text, and a raw string', () => {
  assert.equal(postText('hi'), 'hi');
  assert.equal(postText({ text: 'body' }), 'body');
  assert.equal(postText({ hook: 'a', cta: 'b' }), 'a\n\nb');
  assert.equal(postText(42), '');
});

test('extractClaims pulls urls, K/N scores, percents, and the keyword claims', () => {
  const cs = extractClaims('live, CI green, witness-clean 130/133, up 31% at https://x.io/p.');
  const types = cs.map((c) => c.type).sort();
  assert.deepEqual([...new Set(types)].sort(), ['ci', 'clean', 'live', 'pct', 'score', 'url']);
  const score = cs.find((c) => c.type === 'score');
  assert.equal(score.killed, 130); assert.equal(score.total, 133);
  const url = cs.find((c) => c.type === 'url');
  assert.equal(url.value, 'https://x.io/p');   // trailing period stripped
});

test('extractClaims leaves a bare number that is not a score or percent alone', () => {
  const cs = extractClaims('the seven layers, 7 organs, three doors');
  assert.equal(cs.filter((c) => c.type === 'score' || c.type === 'pct').length, 0);
});

test('extractClaims dedupes identical claims', () => {
  const cs = extractClaims('live and live and live');
  assert.equal(cs.filter((c) => c.type === 'live').length, 1);
});

test('checkClaims: the honest post is fully backed', () => {
  const cc = checkClaims(postText(GOOD), RECEIPT);
  assert.equal(cc.ok, true);
  assert.equal(cc.unbacked.length, 0);
  assert.ok(cc.checked >= 4);
});

test('checkClaims: the hyped post names every unproven claim with a reason', () => {
  const cc = checkClaims(postText(HYPED), RECEIPT);
  assert.equal(cc.ok, false);
  const raws = cc.unbacked.map((u) => u.raw);
  assert.ok(raws.includes('200/200'));                           // wrong witness score
  assert.ok(raws.some((r) => r === '100%' || r === '3'));         // a metric with no fact
  assert.ok(raws.some((r) => /not-our-domain/.test(r)));          // a foreign url
});

test('checkClaims: a score is backed only at the EXACT killed/total', () => {
  assert.equal(checkClaims('130/133', RECEIPT).ok, true);
  assert.equal(checkClaims('131/133', RECEIPT).ok, false);   // killed off by one
  assert.equal(checkClaims('130/134', RECEIPT).ok, false);   // total off by one
});

test('checkClaims: WHY pins the CI state so a shadowed branch cannot survive', () => {
  const failed = { ...RECEIPT, ci: 'failure' };
  const cc = checkClaims('CI green', failed);
  assert.equal(cc.ok, false);
  assert.match(cc.unbacked[0].why, /concluded failure/);
});

test('checkClaims: a live claim needs a real 200', () => {
  assert.equal(checkClaims('it is live', RECEIPT).ok, true);
  assert.equal(checkClaims('it is live', { ...RECEIPT, live: false }).ok, false);
  assert.match(checkClaims('it is live', { ...RECEIPT, live: false }).unbacked[0].why, /observed no 200/);
});

test('checkClaims: a clean claim needs a clean witness (present)', () => {
  assert.equal(checkClaims('provably solid', RECEIPT).ok, true);
  assert.equal(checkClaims('provably solid', { ...RECEIPT, witness: { clean: false, killed: 1, total: 2 } }).ok, false);
  assert.equal(checkClaims('provably solid', { ...RECEIPT, witness: null }).ok, false);
});

test('checkClaims: a percent is backed only by a matching fact', () => {
  const withPct = { ...RECEIPT, facts: [{ key: 'beat', value: '31% fewer errors' }] };
  assert.equal(checkClaims('up 31% this quarter', withPct).ok, true);
  assert.equal(checkClaims('up 31% this quarter', RECEIPT).ok, false);
});

test('checkClaims: a score can also be backed by a measured fact (not only the witness)', () => {
  const withBeats = { ...RECEIPT, facts: [{ key: 'beats', value: 'BEATS 16/16 vs 11/16' }] };
  assert.equal(checkClaims('it BEATS 16/16 on the eval', withBeats).ok, true);
});

// 2026-11-05: found on the buyer walk — a number inside a longer number used to back a claim ("3%" passed against a fact
// saying "30%", "1/4" against "11/40"). A fact now backs a number only as the same whole number.
const withFacts = (...values) => ({ url: 'https://x', live: true, ci: 'success', witness: null, facts: values.map((value, i) => ({ key: 'f' + i, value })) });
const backs = (text, ...values) => checkClaims(text, withFacts(...values)).ok;

test('checkClaims: a percent is backed only by the SAME whole percent in a fact', () => {
  assert.equal(backs('review time down 30%', 'cut review time 30% on one team'), true);
  assert.equal(backs('review time down 3%', 'cut review time 30% on one team'), false);   // the digits after it
  assert.equal(backs('review time down 0%', 'cut review time 30% on one team'), false);   // the digit before it
  assert.equal(backs('down 30%', 'cut 130% of it'), false);                               // a longer number
  assert.equal(backs('down 30%', 'cut 1.30% of it'), false);                              // a decimal's tail
  assert.equal(backs('down 30%', 'cut 30.5% of it'), false);                              // a decimal's head
  assert.equal(backs('down 30.5%', 'cut 30.5% of it'), true);
  assert.equal(backs('down 30.5%', 'cut 3015% of it'), false);                            // the dot is literal
  assert.equal(backs('down 31%', '31% fewer errors'), true);                              // at the start of the fact
  assert.equal(backs('down 31%', 'down 31 %'), true);                                     // a space before the sign
  assert.equal(backs('down 31%', 'grew 31 per cent'), true);
  assert.equal(backs('down 31%', 'grew 31 Percent'), true);                               // any case
  assert.equal(backs('down 31%', 'grew 31 percentage points'), false);                    // points are not percent
  assert.equal(backs('down 31%', '31 users asked for it'), false);                        // a count is not a percent
});

test('checkClaims: a K/N score in a fact backs only the SAME whole score', () => {
  assert.equal(backs('it scored 11/40', 'scored 11/40 tasks'), true);
  assert.equal(backs('it scored 1/4', 'scored 11/40 tasks'), false);                      // inside a longer score
  assert.equal(backs('it scored 1/4', 'scored 1/40 tasks'), false);                       // the total runs on
  assert.equal(backs('it scored 1/4', 'scored 1/4.5'), false);                            // a decimal total
  assert.equal(backs('it scored 1/4', 'v2.1/4 runs'), false);                             // a decimal's tail
  assert.equal(backs('it scored 1/4', '1/4 of runs'), true);                              // at the start of the fact
  assert.equal(backs('it scored 1/4', 'one in four, 1/4.'), true);                        // a full stop after it
  assert.equal(backs('it scored 41 / 43', 'caught 41/43'), true);                         // spaces round the slash
  assert.equal(backs('it scored 41/43', 'caught 41 / 43'), true);
});

// 2026-11-05, the fourth buyer walk: "It is 1000% faster" shipped with nothing checked (a percent was read only up to three
// digits, a score only up to four), and "down 70 percent" was not read as a percent at all, though a fact may say "percent".
const pcts = (text) => extractClaims(text).filter((c) => c.type === 'pct').map((c) => [c.raw, c.value]);

test('extractClaims: a score or percent of any length, and a percent in words, is a claim', () => {
  assert.deepEqual(pcts('It is 1000% faster'), [['1000%', '1000']]);
  assert.deepEqual(pcts('up 12000%'), [['12000%', '12000']]);
  assert.deepEqual(pcts('up 1,000% in a year'), [['1,000%', '1,000']]);                 // thousands, as written
  assert.deepEqual(pcts('v2.5% ok'), [['2.5%', '2.5']]);                                  // the decimal is kept
  assert.deepEqual(pcts('down 30 percent'), [['30 percent', '30']]);
  assert.deepEqual(pcts('down 30 per cent'), [['30 per cent', '30']]);
  assert.deepEqual(pcts('down 30 PERCENT'), [['30 PERCENT', '30']]);                      // any case
  assert.deepEqual(pcts('down 30percent'), [['30percent', '30']]);
  assert.deepEqual(pcts('up 30 percentage points'), []);                                  // points are not percent
  assert.deepEqual(pcts('the 30 per centre'), []);
  assert.deepEqual(pcts('30% and 30 percent'), [['30%', '30'], ['30 percent', '30']]);
  const big = extractClaims('scored 12345/12345').filter((c) => c.type === 'score');
  assert.deepEqual(big.map((c) => [c.raw, c.killed, c.total]), [['12345/12345', 12345, 12345]]);
});

test('checkClaims: a long or worded percent and a long score are checked like any other', () => {
  assert.equal(backs('It is 1000% faster', 'cut review time 30% on one team'), false);
  assert.equal(backs('It is 1000% faster', 'job A ran 1000% faster'), true);
  assert.equal(backs('up 1,000%', 'grew 21,000% in year one'), false);                    // inside a longer number
  assert.equal(backs('up 1,000%', 'grew 1,000% in year one'), true);
  assert.equal(backs('down 30%', 'down 1,30% (a decimal comma)'), false);                 // a decimal comma's tail
  assert.equal(backs('review time down 70 percent', 'cut review time 30% on one team'), false);
  assert.equal(backs('review time down 30 percent', 'cut review time 30% on one team'), true);
  assert.equal(backs('scored 12345/12345', 'scored 12345/12345 runs'), true);
  assert.equal(backs('scored 12345/12345', 'scored 41/43 runs'), false);
});

// 2026-11-05, the fifth buyer walk (the served page of dfe386e, the gate driven with drafts it had not been shown):
// "Released on 5/11/2026." was refused as an unbacked score "5/11"; "Rated 4.9/5" was reported as the claim "9/5", words
// nobody wrote, and no fact could back it; "3x faster" (in the page's own hyped draft) and "10× faster" were not read at
// all; "Launched today!", "Out now" and "Now generally available" shipped against a receipt that saw no 200; and a link's
// own path was read as other claims ("reg/2024/1689" in a link was a score, backed only because the link fact held it).
const types = (text) => extractClaims(text).map((c) => c.type);
const scores = (text) => extractClaims(text).filter((c) => c.type === 'score').map((c) => [c.raw, c.killed, c.total]);
const mults = (text) => extractClaims(text).filter((c) => c.type === 'mult').map((c) => [c.raw, c.value]);
const liveWord = (text) => (extractClaims(text).find((c) => c.type === 'live') || {}).raw;

test('extractClaims: a link is one claim, and nothing inside it is read as another', () => {
  assert.deepEqual(types('see https://eur-lex.europa.eu/eli/reg/2024/1689/oj'), ['url']);
  assert.deepEqual(types('docs: https://x.io/live/verified/41/43/30%25/3x'), ['url']);
  assert.deepEqual(types('docs: https://x.io/a/1/2 and https://x.io/deployed'), ['url', 'url']);
  assert.deepEqual(types('it is live at https://x.io/p, 41/43').sort(), ['live', 'score', 'url']);   // the text round a link is still read
  assert.equal(checkClaims('see https://eur-lex.europa.eu/eli/reg/2024/1689/oj', RECEIPT).checked, 1);
});

test('extractClaims: a link in Markdown, HTML or quotes is read without its brackets, quotes or end punctuation', () => {
  const links = (text) => extractClaims(text).filter((c) => c.type === 'url').map((c) => c.value);
  const APP = 'https://example.org/app';
  for (const text of ['See <https://example.org/app>.', '<a href="https://example.org/app">app</a>', 'See "https://example.org/app".',
    "See 'https://example.org/app'.", 'See https://example.org/app!', 'See https://example.org/app?', 'See https://example.org/app…',
    'run `https://example.org/app`', 'See [the app](https://example.org/app).', 'https://example.org/app,']) {
    assert.deepEqual(links(text), [APP], text);
    assert.equal(checkClaims(text, { url: APP, live: true, ci: null, witness: null, facts: [] }).ok, true, text);
  }
  assert.deepEqual(links('see https://example.org/a?b=1&c=2'), ['https://example.org/a?b=1&c=2']);   // a query is kept
  assert.deepEqual(links("see https://example.org/o'brien/x"), ["https://example.org/o'brien/x"]);   // a quote inside is kept
});

test('extractClaims: a date is not a score', () => {
  assert.deepEqual(scores('Released on 5/11/2026.'), []);
  assert.deepEqual(scores('build of 2026/11/05'), []);
  assert.deepEqual(scores('on 5 / 11 / 2026'), []);
  assert.deepEqual(scores('scored 41/43 in the 5/11/2026 run'), [['41/43', 41, 43]]);
  assert.equal(checkClaims('Released on 5/11/2026.', withFacts()).ok, true);
});

test('extractClaims: a decimal score is read whole, so a report names the words as written', () => {
  assert.deepEqual(scores('Rated 4.9/5 by users'), [['4.9/5', 4.9, 5]]);
  assert.deepEqual(scores('it scored 41/43.5'), [['41/43.5', 41, 43.5]]);
  assert.deepEqual(scores('v2.1/4 runs'), []);                                            // a version, not a score
  assert.deepEqual(scores('it scored 41/43.'), [['41/43', 41, 43]]);                       // a full stop is not a decimal
  assert.deepEqual(scores('a1/2 b'), []);
  assert.deepEqual(scores('it scored 41/43a'), []);
});

test('checkClaims: a decimal or written-as-is score is backed only by a fact stating it', () => {
  assert.equal(backs('Rated 4.9/5 by users', 'rated 4.9/5 by 212 reviewers'), true);
  assert.equal(backs('Rated 4.9/5', 'rated 9/5'), false);
  assert.equal(backs('Rated 4.9/5', 'rated 14.9/5'), false);                              // a longer number
  assert.equal(backs('Rated 4.9/5', 'rated 4.9/50'), false);                              // the total runs on
  assert.equal(backs('Rated 4.9/5', 'rated 4x9/5'), false);                               // the dot is literal
  assert.equal(backs('Rated 4.9/5', 'rated 4.9 / 5'), true);                              // spaces round the slash
  assert.equal(backs('scored 5/11', 'ran on 5/11/2026'), false);                          // a date in a fact is not a score
  assert.equal(backs('scored 11/5', 'ran on 2026/11/5'), false);
  assert.equal(backs('scored 11/5', 'ran on 2026/ 11/5'), false);
  assert.equal(backs('scored 11/05', 'scored 11/05 tasks'), true);                        // as written
  assert.match(checkClaims('Rated 4.9/5', withFacts()).unbacked[0].why, /claims a 4\.9\/5 score/);
  assert.equal(checkClaims('scored 130/133', { ...RECEIPT, facts: [] }).ok, true);          // the witness still backs a whole score
  assert.equal(checkClaims('scored 4.9/5', { ...RECEIPT, witness: { clean: true, killed: 4, total: 5 }, facts: [] }).ok, false);
});

test('extractClaims: a multiplier ("3x", "10×") is a claim', () => {
  assert.deepEqual(mults('It is 3x faster'), [['3x', '3']]);
  assert.deepEqual(mults('Now 10× faster.'), [['10×', '10']]);
  assert.deepEqual(mults('Now 10 × faster'), [['10 ×', '10']]);
  assert.deepEqual(mults('2.5X the throughput'), [['2.5X', '2.5']]);
  assert.deepEqual(mults('up 1,000x'), [['1,000x', '1,000']]);
  assert.deepEqual(mults('0.5x the cost, 3x.'), [['0.5x', '0.5'], ['3x', '3']]);
  assert.deepEqual(mults('runs on 1920x1080 screens'), []);                               // a resolution
  assert.deepEqual(mults('the 0x1F flag'), []);                                           // hex
  assert.deepEqual(mults('a 2x2 grid, a 3×3 grid'), []);
  assert.deepEqual(mults('v3x, 3xl'), []);
  assert.deepEqual(mults('3 x faster'), []);                                              // a spaced letter x is not read
  assert.deepEqual(mults('twice as fast, tenfold'), []);                                  // words are not read
  assert.equal(checkClaims('It is 3x faster', withFacts()).checked, 1);
});

test('checkClaims: a multiplier is backed only by a fact stating the same multiplier', () => {
  assert.equal(backs('It is 3x faster', 'job A ran 3x faster on the benchmark'), true);
  assert.equal(backs('It is 3x faster', 'job A ran 3× faster'), true);                   // x and × are the same sign
  assert.equal(backs('It is 3× faster', 'job A ran 3X faster'), true);
  assert.equal(backs('It is 3x faster', '3x on job A'), true);                            // at the start of the fact
  assert.equal(backs('It is 3x faster', 'job A ran 13x faster'), false);                  // a longer number
  assert.equal(backs('It is 3x faster', 'job A ran 3.5x faster'), false);                 // a decimal
  assert.equal(backs('It is 3x faster', 'job A ran 1.3x faster'), false);                 // a decimal's tail
  assert.equal(backs('It is 3x faster', 'job A ran 1,3x faster'), false);                 // a decimal comma's tail
  assert.equal(backs('It is 3x faster', 'a 3x3 grid'), false);
  assert.equal(backs('It is 3x faster', 'cut review time 30% on one team'), false);
  assert.equal(backs('It is 2.5x faster', 'ran 2.5x faster'), true);
  assert.equal(backs('It is 2.5x faster', 'ran 215x faster'), false);                     // the dot is literal
  assert.deepEqual(checkClaims('It is 3x faster', withFacts()).unbacked.map((u) => u.why), ['claims 3x but no receipt fact backs it']);
  assert.deepEqual(checkClaims('It is 3x faster', withFacts('ran 3x faster')).backed.map((b) => b.why), ['a measured fact']);
});

test('extractClaims: the words a launch is announced in are live claims, named as written', () => {
  for (const [text, word] of [['it is live', 'live'], ['Launched today!', 'Launched'], ['Released today.', 'Released'],
    ['Rolled out to everyone.', 'Rolled out'], ['Out now.', 'Out now'], ['Now available to all.', 'Now available'],
    ['Available now.', 'Available now'], ['Now generally available.', 'generally available'], ['We shipped it', 'shipped'],
    ['deployed on Monday', 'deployed'], ['running in production', 'in production']]) {
    assert.equal(liveWord(text), word, text);
  }
  for (const text of ['the release notes', 'launching soon', 'available on request', 'a new release', 'outnow']) {
    assert.equal(liveWord(text), undefined, text);
  }
  const dark = { ...RECEIPT, live: false };
  for (const text of ['Launched today!', 'Out now.', 'Now generally available.', 'Released today.', 'Rolled out to all customers.']) {
    assert.equal(checkClaims(text, dark).ok, false, text);
    assert.equal(checkClaims(text, RECEIPT).ok, true, text);
  }
});

test('extractClaims: the ways a passing build is announced are CI claims, and every status claim is named as written', () => {
  const word = (text, type) => (extractClaims(text).find((c) => c.type === type) || {}).raw;
  for (const [text, w] of [['CI green.', 'CI green'], ['CI is green.', 'CI is green'], ['CI passed.', 'CI passed'],
    ['CI is passing.', 'CI is passing'], ['CI passes.', 'CI passes'], ['CI succeeded.', 'CI succeeded'], ['CI was green', 'CI was green'],
    ['All checks passed.', 'checks passed'], ['every check passes', 'check passes'], ['All tests pass.', 'tests pass'],
    ['Tests are green.', 'Tests are green'], ['the test passed', 'test passed'], ['The build is passing.', 'build is passing'],
    ['Build passing.', 'Build passing'], ['Build green.', 'Build green'], ['the build succeeded', 'build succeeded'],
    ['green on the GitHub runner', 'green on the GitHub runner']]) {
    assert.equal(word(text, 'ci'), w, text);
  }
  for (const text of ['a green build of the logo', 'the CI pipeline', 'tests are planned', 'the checkout passed review', 'green energy', 'the contest passed']) {
    assert.equal(word(text, 'ci'), undefined, text);
  }
  for (const [text, w] of [['witness-clean', 'witness-clean'], ['Mutation clean', 'Mutation clean'], ['gate-clean', 'gate-clean'],
    ['provably correct', 'provably'], ['fully verified', 'verified']]) {
    assert.equal(word(text, 'clean'), w, text);
  }
  const failed = { ...RECEIPT, ci: 'failure' };
  for (const text of ['CI passed.', 'All checks passed.', 'The build is passing.', 'Tests are green.', 'CI succeeded.']) {
    assert.equal(checkClaims(text, failed).ok, false, text);
    assert.equal(checkClaims(text, RECEIPT).ok, true, text);
  }
});

test('checkClaims: a foreign url is backed once whitelisted as a link fact', () => {
  assert.equal(checkClaims('see https://eur-lex.europa.eu/eli/reg/2024/1689/oj', RECEIPT).ok, true);
  assert.equal(checkClaims('see https://random.example/x', RECEIPT).ok, false);
});

test('checkClaims refuses to run against an invalid receipt', () => {
  assert.equal(checkClaims('anything', { url: '' }).ok, false);
});

test('gatePost passes the honest post and refuses the hyped one', () => {
  const good = gatePost(GOOD, RECEIPT);
  assert.equal(good.ok, true);
  assert.match(good.why, /checkable claims is backed/);
  const bad = gatePost(HYPED, RECEIPT);
  assert.equal(bad.ok, false);
  assert.ok(bad.unbacked.length >= 3);
  assert.match(bad.why, /refused before the rail/);
});

test('gatePost: an invalid receipt and empty text are both refused', () => {
  assert.equal(gatePost(GOOD, { url: '' }).ok, false);
  assert.equal(gatePost({ hook: '' }, RECEIPT).ok, false);
});

test('gatePost: a post with no checkable claim passes but says nothing is proven', () => {
  const g = gatePost({ text: 'a quiet note with no claims' }, RECEIPT);
  assert.equal(g.ok, true);
  assert.equal(g.checked, 0);
  assert.match(g.why, /nothing proven/);
});

test('makePostReceipt seals a passed post; verifyPostReceipt confirms it', () => {
  const mk = makePostReceipt(GOOD, RECEIPT, { sealedAt: '2026-09-15T00:00:00Z' });
  assert.equal(mk.ok, true);
  assert.equal(mk.receipt.kind, 'post-proof-receipt');
  assert.equal(mk.receipt.url, RECEIPT.url);
  assert.equal(verifyPostReceipt(mk.receipt).valid, true);
});

test('makePostReceipt refuses to seal a post that failed the gate', () => {
  const mk = makePostReceipt(HYPED, RECEIPT, { sealedAt: '2026-09-15T00:00:00Z' });
  assert.equal(mk.ok, false);
  assert.match(mk.why, /failed the gate/);
});

test('makePostReceipt needs a sealedAt', () => {
  assert.equal(makePostReceipt(GOOD, RECEIPT, {}).ok, false);
});

test('verifyPostReceipt: a tampered field breaks the seal', () => {
  const mk = makePostReceipt(GOOD, RECEIPT, { sealedAt: '2026-09-15T00:00:00Z' });
  const tampered = { ...mk.receipt, url: 'https://sjgant80-hub.github.io/evil/' };
  assert.equal(verifyPostReceipt(tampered).valid, false);
  assert.equal(verifyPostReceipt({ hash: 'x' }).ok, false);
});

test('appendPostLedger chains gate decisions; verifyPostLedger confirms the chain', () => {
  let chain = [];
  chain = appendPostLedger(chain, GOOD, RECEIPT).chain;   // shipped
  chain = appendPostLedger(chain, HYPED, RECEIPT).chain;   // refused, still ledgered
  assert.equal(chain.length, 2);
  assert.equal(chain[0].entry.shipped, true);
  assert.equal(chain[1].entry.shipped, false);
  assert.equal(verifyPostLedger(chain).valid, true);
});

test('verifyPostLedger: flipping a shipped verdict breaks the chain at that entry', () => {
  let chain = [];
  chain = appendPostLedger(chain, HYPED, RECEIPT).chain;
  chain = appendPostLedger(chain, GOOD, RECEIPT).chain;
  chain[0].entry.shipped = true;   // pretend the refused post shipped
  const v = verifyPostLedger(chain);
  assert.equal(v.valid, false);
  assert.equal(v.brokenAt, 0);
});

test('appendPostLedger needs a receipt url', () => {
  assert.equal(appendPostLedger([], GOOD, { live: true }).ok, false);
  assert.equal(appendPostLedger('nope', GOOD, RECEIPT).ok, false);
});

// ── kill-probes: pin the boundaries and isolate the guard clauses ───────────────────────────────

test('kill: postText falls through an EMPTY text to the hook/reveal/cta (length not >= 0)', () => {
  assert.equal(postText({ text: '', hook: 'a', cta: 'b' }), 'a\n\nb');   // empty text must not win
});

test('kill: postText excludes an EMPTY field from the join (filter is length > 0, not >= 0)', () => {
  assert.equal(postText({ hook: 'a', reveal: '', cta: 'b' }), 'a\n\nb');   // empty reveal dropped, no blank gap
});

test('kill: receiptValid refuses total below 1 even when killed is 0 (the < 1 clause alone)', () => {
  // killed:0,total:0 — killed>total does NOT fire, so witness.total<1 is the only refuser
  assert.equal(receiptValid({ url: 'https://x', live: true, ci: 'success', witness: { clean: true, killed: 0, total: 0 } }).ok, false);
});

test('kill: receiptValid isolates every facts-clause (non-object, typed key, typed value)', () => {
  const base = { url: 'https://x', live: true, ci: 'success', witness: null };
  assert.equal(receiptValid({ ...base, facts: [42] }).ok, false);                       // !isObj(f)
  assert.equal(receiptValid({ ...base, facts: [{ key: 42, value: 'b' }] }).ok, false);   // !isStr(f.key)
  assert.equal(receiptValid({ ...base, facts: [{ key: 'a', value: 42 }] }).ok, false);   // !isStr(f.value)
});

test('kill: a percent is backed by EITHER the raw or the bare value (the || is not an &&)', () => {
  // fact carries "31" but not "31%" — the raw ("31%") misses, the value ("31") hits: OR must pass
  const withValue = { url: 'https://x', live: true, ci: 'success', witness: null, facts: [{ key: 'g', value: 'grew 31 percent last year' }] };
  assert.equal(checkClaims('up 31% this quarter', withValue).ok, true);
});

test('kill: verifyPostLedger catches an ARRAY item with an honest hash (the !isObj(item) clause)', () => {
  let chain = appendPostLedger([], { text: GOOD }, RECEIPT).chain;
  const entry = { url: RECEIPT.url, postHash: sha256('x').hash, shipped: true, checked: 1, unbacked: 0 };
  const prevHash = chain[0].hash;
  const hash = sha256(prevHash + '|' + canon(entry)).hash;             // an HONEST hash, so the recompute passes
  const arrItem = Object.assign([], { seq: 1, prevHash, hash, entry }); // …but the item is an ARRAY, not an object
  const v = verifyPostLedger([chain[0], arrItem]);
  assert.equal(v.valid, false);
  assert.equal(v.brokenAt, 1);
});

test('kill: verifyPostLedger catches a STRING entry with an honest hash (the !isObj(item.entry) clause)', () => {
  let chain = appendPostLedger([], { text: GOOD }, RECEIPT).chain;
  const entry = 'not-an-object';
  const prevHash = chain[0].hash;
  const hash = sha256(prevHash + '|' + canon(entry)).hash;             // honest over the string entry
  const strItem = { seq: 1, prevHash, hash, entry };
  const v = verifyPostLedger([chain[0], strItem]);
  assert.equal(v.valid, false);
  assert.equal(v.brokenAt, 1);
});

// 2026-11-05, the fifth buyer walk: 100,000 digits in a row took 44 s to read (a percent could start at every digit of the
// run, each scanning to its end), and "green on " repeated grew the same way: a garbage or hostile post could stall a CI job.
test('extractClaims reads hostile input in linear time', () => {
  for (const text of ['9'.repeat(100000), '9'.repeat(100000) + 'x', '9'.repeat(100000) + '%', 'green on '.repeat(20000),
    ('1 / ').repeat(25000), ('1.').repeat(50000), ('1,000').repeat(20000)]) {
    const t0 = Date.now();
    extractClaims(text);
    assert.ok(Date.now() - t0 < 2000, text.slice(0, 12) + '… (' + text.length + ' chars) took ' + (Date.now() - t0) + ' ms');
  }
  assert.deepEqual(pcts('9'.repeat(5000) + '%').map((p) => p[0].length), [5001]);         // a long percent is still read whole
});

test('fuzz: pure and total — garbage never throws', () => {
  const junk = [null, undefined, 0, '', [], {}, NaN, true, { url: 5 }, { witness: [] }, Symbol.for('x')];
  for (const a of junk) for (const b of junk) {
    assert.doesNotThrow(() => { receiptValid(a); extractClaims(a); checkClaims(a, b); gatePost(a, b); makePostReceipt(a, b, a); verifyPostReceipt(a); appendPostLedger(a, b, a); verifyPostLedger(a); });
  }
});
