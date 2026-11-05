// costcase.test.mjs — the For-business cost case: every figure from the sourced basis, floors not top ends, like for
// like, every boundary pinned, never a throw.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DEFAULTS, BASIS_KEYS, sourcesOf, over, costCase } from './costcase.mjs';

const RAW = readFileSync(new URL('./vendor/sovereign-enterprise/data/basis.json', import.meta.url));
const BASIS = JSON.parse(RAW.toString('utf8'));
const base = (patch) => ({ ...BASIS, ...patch });
const r2 = (x) => Math.round(x * 100) / 100;

test('the basis is the vendored file, byte for byte (the hash vendor/SOURCES.json records)', () => {
  const src = JSON.parse(readFileSync(new URL('./vendor/SOURCES.json', import.meta.url), 'utf8'));
  const entry = src.files.find((f) => f.path === 'vendor/sovereign-enterprise/data/basis.json');
  assert.equal(createHash('sha256').update(RAW).digest('hex'), entry.sha256);
});

test('costCase · the default case, every line from the sourced basis', () => {
  const r = costCase(BASIS, {});
  assert.equal(r.ok, true);
  assert.deepEqual(r.inputs, DEFAULTS);
  assert.deepEqual(r.hours, { checking: 130, takenOff: 65 });
  assert.deepEqual(r.lines, { staff: 2557.1, takenOff: 1278.55, seats: 554.4, apiFrontier: 4.31, apiBedrock: 0.45, power: 0, setup: 78.68 });
  assert.deepEqual(r.perYear, { today: 2557.1, rentSeats: 3111.5, cloudFrontier: 1282.86, cloudBedrock: 1279, gate: 1278.55 });
  assert.deepEqual(r.over, { today: 7911.57, rentSeats: 9626.86, cloudFrontier: 4047.8, cloudBedrock: 4035.86, gate: 4034.46 });
  assert.deepEqual([r.savingPerYear, r.savingOver, r.versusSeatsOver, r.paybackWeeks], [1278.55, 3877.11, 5592.4, 4]);
  assert.deepEqual(r.versusCloudOver, { frontier: 13.34, bedrock: 1.4 });
});

test('costCase · no input at all is the default case', () => {
  assert.deepEqual(costCase(BASIS), costCase(BASIS, {}));
  assert.deepEqual(costCase(BASIS, null), costCase(BASIS, {}));
});

test('costCase · the reader\'s inputs are used, not the defaults', () => {
  const r = costCase(BASIS, { postsPerWeek: 4, minutesPerPost: 30, share: 0.25, reviewers: 1, years: 1 });
  assert.deepEqual(r.hours, { checking: 104, takenOff: 26 });
  assert.equal(r.lines.staff, r2(4 * 52 * 30 / 60 * 19.67));
  assert.equal(r.lines.takenOff, r2(r.lines.staff * 0.25));
  assert.equal(r.lines.seats, r2(1 * 12 * 23.1));
  assert.equal(r.over.today, r.perYear.today);
});

test('costCase · like for like: rented seats take nothing off; a cloud judge and the gate take the same share off', () => {
  const r = costCase(BASIS, { share: 0.8, reviewers: 3, postsPerWeek: 40, tokensIn: 2000, tokensOut: 800, secondsPerRun: 30 });
  assert.equal(r.perYear.today, r.lines.staff);
  assert.equal(r.perYear.rentSeats, r2(r.lines.staff + r.lines.seats));
  assert.equal(r.perYear.cloudFrontier, r2(r.lines.staff - r.lines.takenOff + r.lines.apiFrontier));
  assert.equal(r.perYear.cloudBedrock, r2(r.lines.staff - r.lines.takenOff + r.lines.apiBedrock));
  assert.equal(r.perYear.gate, r2(r.lines.staff - r.lines.takenOff + r.lines.power));
  assert.equal(r.lines.takenOff, r2(r.lines.staff * 0.8));
  assert.equal(r.lines.seats, r2(3 * 12 * BASIS['seat.copilot'].value));
  assert.equal(r.lines.apiFrontier, r2(40 * 52 * (2000 * 2 + 800 * 10) / 1e6 * 0.75396));
  assert.equal(r.lines.apiBedrock, r2(40 * 52 * (2000 * 0.23 + 800 * 0.93) / 1e6 * 0.75396));
  assert.equal(r.lines.power, r2(40 * 52 * 30 / 3600 * 15 / 1000 * 24.51 / 100));
  assert.equal(r.savingPerYear, r2(r.perYear.today - r.perYear.gate));
  assert.equal(r.savingOver, r2(r.over.today - r.over.gate));
  assert.equal(r.versusSeatsOver, r2(r.over.rentSeats - r.over.gate));
  assert.deepEqual(r.versusCloudOver, { frontier: r2(r.over.cloudFrontier - r.over.gate), bedrock: r2(r.over.cloudBedrock - r.over.gate) });
});

test('costCase · the figures move with the basis, not with anything typed', () => {
  const dear = costCase(base({ wageMedianHourly: { ...BASIS.wageMedianHourly, value: 30 } }), {});
  assert.equal(dear.lines.staff, 130 * 30);
  const seat = costCase(base({ 'seat.copilot': { ...BASIS['seat.copilot'], value: 10 } }), {});
  assert.equal(seat.lines.seats, 2 * 12 * 10);
  const fx = costCase(base({ fxGbpPerUsd: { ...BASIS.fxGbpPerUsd, value: 1 } }), { postsPerWeek: 100 });
  assert.equal(fx.lines.apiFrontier, r2(100 * 52 * (3000 * 2 + 500 * 10) / 1e6));
  assert.equal(fx.lines.apiBedrock, r2(100 * 52 * (3000 * 0.23 + 500 * 0.93) / 1e6));
  const frontier = costCase(base({ frontier: { ...BASIS.frontier, inPerM: 20, outPerM: 100 } }), {});
  assert.equal(frontier.lines.apiFrontier, r2(520 * (3000 * 20 + 500 * 100) / 1e6 * 0.75396));
  const bedrock = costCase(base({ bedrockGptOss120b: { ...BASIS.bedrockGptOss120b, inPerM: 5, outPerM: 9 } }), {});
  assert.equal(bedrock.lines.apiBedrock, r2(520 * (3000 * 5 + 500 * 9) / 1e6 * 0.75396));
  const power = costCase(base({ laptopExtraWatts: { ...BASIS.laptopExtraWatts, value: 1000 }, electricityPencePerKwh: { ...BASIS.electricityPencePerKwh, value: 100 } }), { secondsPerRun: 3600 });
  assert.equal(power.lines.power, 520);
  const flat = costCase(base({ cpi: { ...BASIS.cpi, value: 0 } }), {});
  assert.equal(flat.over.today, r2(2557.1 * 3));
});

// 2026-11-05, the fourth buyer walk (CFO): the case priced the running cost but not the hours it takes to add the step.
test('costCase · set-up is staff time, once, in the first year, for every route that adds a step (the gate and a cloud judge alike)', () => {
  const none = costCase(BASIS, { setupHours: 0 }), r = costCase(BASIS, { setupHours: 10, years: 2 });
  assert.equal(r.lines.setup, r2(10 * 19.67));
  assert.equal(none.lines.setup, 0);
  const plain = costCase(BASIS, { setupHours: 0, years: 2 });
  assert.deepEqual(r.perYear, plain.perYear);                                         // a yearly cost, it is not
  for (const k of ['gate', 'cloudFrontier', 'cloudBedrock']) assert.equal(r.over[k], r2(plain.over[k] + r.lines.setup), k);
  for (const k of ['today', 'rentSeats']) assert.equal(r.over[k], plain.over[k], k);  // nothing added to the seats: their floor
  assert.equal(r.savingOver, r2(plain.savingOver - r.lines.setup));
  assert.deepEqual(r.versusCloudOver, plain.versusCloudOver);                           // like for like
  assert.equal(r.versusSeatsOver, r2(plain.versusSeatsOver - r.lines.setup));
  assert.equal(costCase(BASIS, { setupHours: 0, years: 1 }).over.gate, costCase(BASIS, { setupHours: 0, years: 1 }).perYear.gate);
});

test('costCase · payback: whole weeks of posts until the saving has paid for the set-up', () => {
  assert.equal(costCase(BASIS, {}).paybackWeeks, Math.ceil(78.68 * 52 / 1278.55));     // 3.2 weeks: the 4th week pays it
  assert.equal(costCase(BASIS, {}).paybackWeeks, 4);
  assert.equal(costCase(BASIS, { setupHours: 0 }).paybackWeeks, 0);                     // nothing to pay back
  assert.equal(costCase(BASIS, { setupHours: 0, share: 0 }).paybackWeeks, 0);           // nothing to pay back, nothing saved
  assert.equal(costCase(BASIS, { share: 0 }).paybackWeeks, null);                       // nothing saved: it never pays back
  assert.equal(costCase(BASIS, { postsPerWeek: 0 }).paybackWeeks, null);
  const slow = costCase(BASIS, { setupHours: 1000, postsPerWeek: 1, minutesPerPost: 1, share: 0.1 });
  assert.equal(slow.paybackWeeks, Math.ceil(slow.lines.setup * 52 / slow.savingPerYear));
  assert.ok(slow.paybackWeeks > 52 * 10);                                               // it can take longer than the case runs
});

test('over · CPI is applied to every year after the first, and only the years asked for', () => {
  assert.equal(over(100, 0.1, 1), 100);
  assert.equal(over(100, 0.1, 2), 210);
  assert.equal(over(100, 0.1, 3), 331);
  assert.equal(over(1000, 0.031, 3), r2(1000 + 1031 + 1000 * 1.031 * 1.031));
});

test('costCase · boundaries hold at both ends of every input', () => {
  for (const ok of [
    { postsPerWeek: 0 }, { postsPerWeek: 10000 }, { minutesPerPost: 0 }, { minutesPerPost: 480 },
    { share: 0 }, { share: 1 }, { reviewers: 0 }, { tokensIn: 0, tokensOut: 0 }, { secondsPerRun: 0 }, { secondsPerRun: 3600 },
    { setupHours: 0 }, { setupHours: 1000 }, { years: 1 }, { years: 10 },
  ]) assert.equal(costCase(BASIS, ok).ok, true, JSON.stringify(ok));
  assert.equal(costCase(BASIS, { share: 1 }).perYear.gate, costCase(BASIS, { share: 1 }).lines.power);
  assert.equal(costCase(BASIS, { setupHours: 1000 }).lines.setup, r2(1000 * 19.67));
  assert.equal(costCase(BASIS, { share: 0 }).savingPerYear, 0);
  assert.equal(costCase(BASIS, { postsPerWeek: 0 }).perYear.today, 0);
  assert.equal(costCase(BASIS, { years: 1 }).over.today, 2557.1);
  assert.equal(costCase(BASIS, { years: 10 }).over.today, over(2557.1, 0.031, 10));
});

test('costCase · each bad input refused with its reason', () => {
  const why = (i) => costCase(BASIS, i).why;
  assert.equal(why({ postsPerWeek: 10000.5 }), 'posts a week: 0 to 10,000');
  assert.equal(why({ postsPerWeek: -1 }), 'posts a week: 0 to 10,000');
  assert.equal(why({ postsPerWeek: '10' }), 'posts a week: 0 to 10,000');
  assert.equal(why({ minutesPerPost: 480.5 }), 'minutes checking each post: 0 to 480');
  assert.equal(why({ minutesPerPost: -1 }), 'minutes checking each post: 0 to 480');
  assert.equal(why({ share: 1.01 }), 'the share of the checking the gate takes off: 0 to 1');
  assert.equal(why({ share: -0.1 }), 'the share of the checking the gate takes off: 0 to 1');
  assert.equal(why({ reviewers: 2.5 }), 'reviewers: a whole number');
  assert.equal(why({ reviewers: -1 }), 'reviewers: a whole number');
  assert.equal(why({ tokensIn: -1 }), 'tokens: numbers');
  assert.equal(why({ tokensIn: Infinity }), 'tokens: numbers');
  assert.equal(why({ tokensIn: NaN }), 'tokens: numbers');
  assert.equal(why({ tokensOut: 'x' }), 'tokens: numbers');
  assert.equal(why({ tokensOut: -1 }), 'tokens: numbers');
  assert.equal(why({ secondsPerRun: 3600.5 }), 'seconds for one gate run: 0 to 3,600');
  assert.equal(why({ secondsPerRun: -1 }), 'seconds for one gate run: 0 to 3,600');
  assert.equal(why({ setupHours: 1000.5 }), 'hours to set it up: 0 to 1,000');
  assert.equal(why({ setupHours: -1 }), 'hours to set it up: 0 to 1,000');
  assert.equal(why({ setupHours: '4' }), 'hours to set it up: 0 to 1,000');
  assert.equal(why({ years: 0 }), 'years: 1 to 10');
  assert.equal(why({ years: 11 }), 'years: 1 to 10');
  assert.equal(why({ years: 2.5 }), 'years: 1 to 10');
});

test('costCase · a basis missing any figure it reads is refused, never guessed', () => {
  const need = 'a sourced basis with every figure the case reads';
  for (const k of BASIS_KEYS) {
    const b = { ...BASIS }; delete b[k];
    assert.equal(costCase(b, {}).why, need, k);
  }
  assert.equal(costCase(base({ frontier: { ...BASIS.frontier, outPerM: undefined } }), {}).why, need);
  assert.equal(costCase(base({ bedrockGptOss120b: { ...BASIS.bedrockGptOss120b, inPerM: '0.23' } }), {}).why, need);
  assert.equal(costCase(base({ bedrockGptOss120b: { ...BASIS.bedrockGptOss120b, outPerM: -1 } }), {}).why, need);
  assert.equal(costCase(base({ cpi: { ...BASIS.cpi, value: NaN } }), {}).why, need);
  assert.equal(costCase(null, {}).why, need);
  assert.equal(costCase(undefined, {}).why, need);
  assert.equal(costCase(base({ cpi: { ...BASIS.cpi, value: 0 } }), {}).ok, true);
});

test('sourcesOf · every figure is listed with what it is and where it came from', () => {
  const s = sourcesOf(BASIS);
  assert.deepEqual(s.map((x) => x.key), [...BASIS_KEYS]);
  for (const x of s) {
    assert.match(x.source, /^https:\/\//, x.key);
    assert.ok(typeof x.what === 'string' && x.what.length > 0, x.key);
  }
  assert.equal(s.find((x) => x.key === 'cpi').what, BASIS.cpi.what);
  assert.equal(s.find((x) => x.key === 'frontier').what, BASIS.frontier.product);
  assert.deepEqual(sourcesOf(null), []);
  assert.deepEqual(sourcesOf({}), []);
});

test('fuzz: pure and total — garbage never throws', () => {
  const toxic = {}; Object.defineProperty(toxic, 'postsPerWeek', { enumerable: true, get() { throw new Error('boom'); } });
  const toxicBasis = {}; Object.defineProperty(toxicBasis, 'cpi', { get() { throw new Error('boom'); } });
  const junk = [null, undefined, 0, -1, NaN, Infinity, '', 'x', [], {}, true, 10n, () => {}, toxic, toxicBasis, { years: 10n }, { share: {} }];
  for (const a of [BASIS, ...junk]) for (const b of junk) {
    const r = costCase(a, b);
    assert.equal(typeof r, 'object');
    assert.equal(typeof r.ok, 'boolean');
    if (!r.ok) assert.equal(typeof r.why, 'string');
  }
  assert.equal(costCase(BASIS, toxic).why, 'the inputs could not be read');
  assert.equal(costCase(toxicBasis, {}).why, 'the inputs could not be read');
  assert.deepEqual(sourcesOf(toxicBasis), []);
  assert.equal(typeof over('x', null, 2), 'number');
});
