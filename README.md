# post-proof

**LIVE: https://sjgant80-hub.github.io/post-proof/**  (start here, how it works, blueprint, for business, the cost case
and the white paper are all on the page)

A checker for announcements: a release note, launch post, README or changelog ships only if the record of what was built
backs every checkable claim it makes. The receipt-gate for AI-native marketing. **A post ships only if a verifiable build-receipt backs
every claim it makes.** No LLM judge. One inflated claim discredits the true ones beside it, so the gate
refuses the inflated one, and names the exact unproven words.

## Agent skill: claim-receipt-gate

The same kernel ships as one self-contained file an AI agent runs before it publishes:
`node scripts/claim-receipt-gate.mjs examples/refuse.json` (exit 0 = SHIP, 1 = REFUSE, 2 = bad input).
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
`receipts/`, `examples/` and the test files; CI rebuilds the page and fails on any difference.

## The problem it solves

AI-native companies market at the speed they build — and one puffed claim ("100% bulletproof",
"200/200", "live" before it's live) discredits every honest claim beside it. Our own rule
is *the receipt-audit applies to our own posts hardest*. post-proof makes that
rule **mechanical**: it sits between the post generators and the posting rail —
`draft → scrub → post-proof (on the scrubbed text) → the rail` (`postScrubbedProven` in `si-didy-loop/rail.mjs`) — and
refuses anything the proof doesn't back.

## What it does

- **gatePost(post, receipt)** — extracts the *checkable* claims from a draft (URLs, K/N witness
  scores, "CI green", "live", percentages) and refuses any the build-receipt doesn't back, naming
  each one. A number that isn't a score or a percent ("seven layers") is left alone. **No model
  grades the copy.**
- **makePostReceipt / verifyPostReceipt** — a passed post seals a content-addressed receipt (the
  post's hash + the build-receipt's hash + the backed claims). It verifies anywhere, and the gate
  **refuses to seal a post that failed**.
- **appendPostLedger / verifyPostLedger** — every gate decision (shipped or refused) lands on a
  SHA-256 hash chain. Tamper with any entry and the chain breaks. This is the audit trail a
  regulator (EU AI Act transparency, 2 Aug 2026) — or your own future self — asks for.

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
node --test kernel.test.mjs costcase.test.mjs skill.test.mjs
node gate.mjs --witness tools/witness.mjs                                               # kernel.mjs → receipts/witness.json
node gate.mjs --witness tools/witness.mjs --kernel costcase.mjs --tests costcase.test.mjs   # → receipts/witness-costcase.json
node gate.mjs --verify && node gate.mjs --verify --kernel costcase.mjs --tests costcase.test.mjs
node make-page.mjs
```

CI (`.github/workflows/gate.yml`) runs on every push on GitHub's runner: witness cloned fresh at its `v0.6` tag (and
`tools/` checked to be the same bytes), the vendored basis checked against its source, all tests, both receipts, the
Agensi ZIP, the witness mutation gate on both kernels (must be clean), and the page fixpoint.

## Honest limits (v1)

Checkable claims only — it backs facts a receipt can carry; it does not fact-check free prose or
judge tone (the one-line "what it does" rides on trust, capped and visible). Tamper-evident, **not
yet signed/anchored** (Ed25519 issuer signing + external anchor is v2). You bring the receipt (the
probes live in the rail's runner). The live send to a real page needs the one-time channel connect —
it can't be faked. Not audited. Mutation-witnessed in CI (survivors carry a written equivalence
argument). MIT.

## Supplier and support

Supplied by AI Native Solutions (https://www.ai-nativesolutions.com; contact through that site). Support, SLA, warranty and
liability are agreed per deployment, in each deployment's agreement. MIT: it keeps running without us.

Powered by the Konomi architecture, created by Thomas Frumkin.
