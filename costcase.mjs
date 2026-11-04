// costcase.mjs — the cost case for the "For business" section of the post-proof page: what checking the claims in
// release notes, launch posts and READMEs by hand costs a team in staff time today, what the rented routes add, and
// what running the gate costs. Every external figure is read from the vendored, sourced basis
// (vendor/sovereign-enterprise/data/basis.json); the post count, the minutes, the share, the reviewer count, the token
// sizes and the run time are the reader's own (the defaults are an example to overwrite, not a measurement).
// Floors, never top ends: staff time at the UK median hourly wage with on-costs left out; CPI applied to every later
// year. Like for like: a cloud model judging every post is credited with the SAME share of the checking taken off as
// the gate, so the two differ only in the per-call bill (and in where the draft goes); rented assistant seats help
// each reviewer but take no checking off, so the staff time stays. No price of ours appears here: these are the
// buyer's own costs. Pure, total, deterministic: garbage in gives { ok: false, why }, never a throw.

export const DEFAULTS = Object.freeze({
  postsPerWeek: 10, minutesPerPost: 15, share: 0.5, reviewers: 2, tokensIn: 3000, tokensOut: 500, secondsPerRun: 1, years: 3,
});
export const BASIS_KEYS = Object.freeze([
  'wageMedianHourly', 'cpi', 'seat.copilot', 'frontier', 'bedrockGptOss120b', 'fxGbpPerUsd', 'electricityPencePerKwh', 'laptopExtraWatts',
]);

const isNum = (x) => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const r2 = (x) => Math.round(x * 100) / 100;

/** the basis entries the case reads, each a sourced number; null when one is missing or unreadable */
function figures(basis) {
  const b = basis || {}, f = (k) => b[k] || {};
  const out = {
    wage: f('wageMedianHourly').value, cpi: f('cpi').value, seat: f('seat.copilot').value,
    fIn: f('frontier').inPerM, fOut: f('frontier').outPerM, bIn: f('bedrockGptOss120b').inPerM, bOut: f('bedrockGptOss120b').outPerM,
    fx: f('fxGbpPerUsd').value, pence: f('electricityPencePerKwh').value, watts: f('laptopExtraWatts').value,
  };
  return Object.values(out).every(isNum) ? out : null;
}

/** where each figure came from, for the page to list beside the numbers */
export function sourcesOf(basis) {
  try { return BASIS_KEYS.map((k) => ({ key: k, what: basis[k].what || basis[k].product, source: basis[k].source })); } catch { return []; }
}

/** a yearly cost carried over `years`, rising by CPI each year after the first */
export function over(perYear, cpi, years) {
  let total = 0, factor = 1;
  for (let y = 0; y < years; y++) { total += perYear * factor; factor *= 1 + cpi; }
  return r2(total);
}

/** the case. input (all optional, defaults above): postsPerWeek, minutesPerPost, share (0 to 1), reviewers,
 *  tokensIn, tokensOut (what a cloud model would read and write to judge one post), secondsPerRun, years */
export function costCase(basis, input) {
  try {
    const f = figures(basis);
    if (!f) return { ok: false, why: 'a sourced basis with every figure the case reads' };
    const i = { ...DEFAULTS, ...(input || {}) };
    if (!isNum(i.postsPerWeek) || i.postsPerWeek > 10000) return { ok: false, why: 'posts a week: 0 to 10,000' };
    if (!isNum(i.minutesPerPost) || i.minutesPerPost > 480) return { ok: false, why: 'minutes checking each post: 0 to 480' };
    if (!isNum(i.share) || i.share > 1) return { ok: false, why: 'the share of the checking the gate takes off: 0 to 1' };
    if (!Number.isInteger(i.reviewers) || i.reviewers < 0) return { ok: false, why: 'reviewers: a whole number' };
    if (!isNum(i.tokensIn) || !isNum(i.tokensOut)) return { ok: false, why: 'tokens: numbers' };
    if (!isNum(i.secondsPerRun) || i.secondsPerRun > 3600) return { ok: false, why: 'seconds for one gate run: 0 to 3,600' };
    if (!Number.isInteger(i.years) || i.years < 1 || i.years > 10) return { ok: false, why: 'years: 1 to 10' };
    const runs = i.postsPerWeek * 52;                                                     // posts checked a year
    const hours = runs * i.minutesPerPost / 60;                                           // hours of checking a year
    const staff = r2(hours * f.wage);                                                     // that checking, in staff time
    const takenOff = r2(staff * i.share);                                                 // the share the gate (or a cloud judge) does
    const seats = r2(i.reviewers * 12 * f.seat);                                          // rented assistants: help, take nothing off
    const apiFrontier = r2(runs * (i.tokensIn * f.fIn + i.tokensOut * f.fOut) / 1e6 * f.fx);   // a frontier model judging every post
    const apiBedrock = r2(runs * (i.tokensIn * f.bIn + i.tokensOut * f.bOut) / 1e6 * f.fx);    // an open model on a cloud, every post
    const power = r2(runs * i.secondsPerRun / 3600 * f.watts / 1000 * f.pence / 100);     // the gate: a laptop's extra draw while it runs
    const perYear = {
      today: staff, rentSeats: r2(staff + seats),
      cloudFrontier: r2(staff - takenOff + apiFrontier), cloudBedrock: r2(staff - takenOff + apiBedrock),
      gate: r2(staff - takenOff + power),
    };
    const total = Object.fromEntries(Object.entries(perYear).map(([k, v]) => [k, over(v, f.cpi, i.years)]));
    return {
      ok: true, inputs: i,
      hours: { checking: r2(hours), takenOff: r2(hours * i.share) },
      lines: { staff, takenOff, seats, apiFrontier, apiBedrock, power },
      perYear, over: total,
      savingPerYear: r2(perYear.today - perYear.gate), savingOver: r2(total.today - total.gate),
      versusSeatsOver: r2(total.rentSeats - total.gate),
      versusCloudOver: { frontier: r2(total.cloudFrontier - total.gate), bedrock: r2(total.cloudBedrock - total.gate) },
    };
  } catch { return { ok: false, why: 'the inputs could not be read' }; }
}

export default costCase;
