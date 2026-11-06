# post-proof

**LIVE: https://sjgant80-hub.github.io/post-proof/**  (start here, how it works, blueprint, for business, the cost case
and the white paper are all on the page)

A checker for announcements: a release note, launch post, README or changelog ships only if the record of what was built
backs every checkable claim it makes. The receipt-gate for AI-native marketing. **A post ships only if a verifiable build-receipt backs
every claim it makes.** No LLM judge. One inflated claim discredits the true ones beside it, so the gate
refuses the inflated one, and names the exact unproven words.

## Agent skill: claim-receipt-gate

The same kernel ships as one self-contained file an AI agent runs before it publishes:
`node scripts/claim-receipt-gate.mjs examples/refuse.json` (exit 0 = SHIP, 1 = REFUSE, 2 = bad input, 3 = internal error).
Skill layer built by Kar (weekly choosing-session, 2026-11-01). See [SKILL.md](SKILL.md). `node build-skill.mjs` regenerates the script from kernel.mjs + cli.mjs;
`skill.test.mjs` runs it alone in an empty folder on `examples/`; `node gate.mjs --witness tools/witness.mjs`
writes the uncapped witness v0.6 receipt to `receipts/witness.json`; `node make-zip.mjs` builds the
deterministic Agensi package in `dist/`.

## The cost case (For business, on the page)

`costcase.mjs` is a second gated kernel: what checking the claims in posts by hand costs a team in staff time, set
against assistant seats, a cloud model judging every post, and the gate. The reader's own figures go in; every external
figure comes from `vendor/sovereign-enterprise/data/basis.json` (ONS wage and CPI, DESNZ electricity, ECB exchange rate,
vendor list prices, each with its source), copied byte for byte from `sjgant80-hub/liveware` (recorded with its SHA-256 in
`vendor/SOURCES.json`; CI re-fetches the source and compares). Floors, never top ends; no price of ours. `make-page.mjs`
injects both kernels and the basis into the page, and fills every number the page states about the build from
`receipts/`, `examples/` and the test files, and last writes the page's Content-Security-Policy (no source allowed anywhere;
only the page's own inline scripts, each named by SHA-256), which `page.test.mjs` checks independently. CI rebuilds the
page and fails on any difference. The cost case counts the reader's set-up hours once, in the first year, for every route
that adds a step to the pipeline, and says how many weeks of posts pay them back.

## The problem it solves

AI-native companies market at the speed they build — and one puffed claim ("100% bulletproof",
"200/200", "live" before it's live) discredits every honest claim beside it. Our own rule
is *the receipt-audit applies to our own posts hardest*. post-proof makes that
rule **mechanical**: it sits between the post generators and the posting rail —
`draft → scrub → post-proof (on the scrubbed text) → the rail` (`postScrubbedProven` in `si-didy-loop/rail.mjs`) — and
refuses anything the proof doesn't back.

## What it does

- **gatePost(post, receipt)** — extracts the *checkable* claims from a draft (URLs, K/N witness
  scores, "CI green" (and "CI passed", "all checks passed", "the build is passing"), "live" and the words a launch
  is announced in ("launched", "out now", "now available"),
  percentages, multipliers such as "3x") and refuses any the build-receipt doesn't back, naming
  each one, as written. A number that isn't a score, a percent or a multiplier ("seven layers"), a date ("5/11/2026")
  and a link's own path are left alone; a link in Markdown or HTML is read without its brackets or quotes. It reads
  hostile input in linear time. **No model grades the copy.**
- **makePostReceipt / verifyPostReceipt** — a passed post seals a content-addressed receipt (the
  post's hash + the build-receipt's hash + the backed claims). It verifies anywhere, and the gate
  **refuses to seal a post that failed**.
- **appendPostLedger / verifyPostLedger** — every gate decision (shipped or refused) lands on a
  SHA-256 hash chain. Tamper with any entry and the chain breaks at that entry: the record you show when anyone
  asks what was claimed and what backed it. (The UK CAP Code rule 3.7 and the US FTC substantiation policy both expect the
  evidence for an objective claim to be held before it is published.)

The build-receipt is proof-of-play produced by **real probes**: a live 200, CI's conclusion, the
mutation-witness verdict, a whitelist of measured facts. The kernel is pure and never fetches — the
rail's runner does the probing and hands the receipt here to adjudicate the draft against.

The live page runs all of it in your browser (the gated `kernel.mjs`, injected verbatim), using
agent-proof's **own real receipt** (130/133 witness-clean, live, CI green) as the fixture: watch an
honest draft pass and a hyped draft get refused claim by claim.

## Where it fits (it composes, it doesn't replace)

Our own pipeline already **generates** posts (`fallpost`, `fallgravity`) and already has the sanctioned
Meta Graph **rail** (`si-didy-loop/rail.mjs` — rate-disciplined, token-redacted, whole except a
one-time Page Access Token the owner pastes themselves). post-proof is the **gate** that makes that
rail's posts *provable*. It is wired in front of the rail's `postable` check (`postableProven`): no receipt, no post.

## Run it

```bash
node --test kernel.test.mjs costcase.test.mjs skill.test.mjs page.test.mjs
node gate.mjs --witness tools/witness.mjs                                               # kernel.mjs → receipts/witness.json
node gate.mjs --witness tools/witness.mjs --kernel costcase.mjs --tests costcase.test.mjs   # → receipts/witness-costcase.json
node gate.mjs --verify && node gate.mjs --verify --kernel costcase.mjs --tests costcase.test.mjs
node make-page.mjs
```

CI (`.github/workflows/gate.yml`) runs on every push on GitHub's runner: witness cloned fresh at its `v0.6` tag (and
`tools/` checked to be the same bytes), the vendored basis checked against its source, all tests (the page's
Content-Security-Policy included), both receipts, the
Agensi ZIP, the witness mutation gate on both kernels (must be clean), and the page fixpoint.

## Honest limits (v1)

Checkable claims only — it backs facts a receipt can carry; it does not fact-check free prose or
judge tone (the one-line "what it does" rides on trust, capped and visible). Tamper-evident and **not signed, by
design**: the seals and the ledger show any change, not who sealed them; proving that needs a key, and this tool needs none
(sign the sealed post-receipt with your existing release-signing key if you must). A fact backs a percent or a K/N score
only when it states the same whole number ("3%" is not backed by "30%", nor "1/4" by "11/40"). A score or percent of any
length is read ("1000%", "12345/12345"), and a percent written "70 percent" too, and a multiplier ("3x", "10×") is backed the
same way ("3x" is not backed by "13x" or "3.5x"); numbers written as words ("twice", "tenfold") are not. A date with its year is
not a score, but "24/7" and a date without a year ("11/05") read as K/N scores and need a fact. Certification and compliance
claims ("SOC 2 certified", "GDPR compliant") are not read: no build probe can prove them. You bring the receipt (the
probes live in the rail's runner). (In our own pipeline the rail's live send to a real page also needs the owner's one-time channel connect;
that is the rail's, not this gate's.) Not audited. Mutation-witnessed in CI (survivors carry a written equivalence
argument). MIT.

## Supplier and support

Supplied by AI Native Solutions (https://www.ai-nativesolutions.com; contact through that site). Support, SLA, warranty and
liability are agreed per deployment, in each deployment's agreement. MIT: it keeps running without us.

Powered by the Konomi architecture, created by Thomas Frumkin.
