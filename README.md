# post-proof

**LIVE: https://sjgant80-hub.github.io/post-proof/**

The receipt-gate for AI-native marketing. **A post ships only if a verifiable build-receipt backs
every claim it makes.** No LLM judge. One inflated receipt poisons six true ones — so the gate
refuses the inflated one, and names the exact unproven words.

## Agent skill: claim-receipt-gate

The same kernel ships as one self-contained file an AI agent runs before it publishes:
`node scripts/claim-receipt-gate.mjs examples/refuse.json` (exit 0 = SHIP, 1 = REFUSE, 2 = bad input).
Skill layer built by Kar (weekly choosing-session, 2026-11-01). See [SKILL.md](SKILL.md). `node build-skill.mjs` regenerates the script from kernel.mjs + cli.mjs;
`skill.test.mjs` runs it alone in an empty folder on `examples/`; `node gate.mjs --witness tools/witness.mjs`
writes the uncapped witness v0.6 receipt to `receipts/witness.json`; `node make-zip.mjs` builds the
deterministic Agensi package in `dist/`.

## The problem it solves

AI-native companies market at the speed they build — and one puffed claim ("100% bulletproof",
"200/200", "live" before it's live) discredits every honest claim beside it. The estate's own law
(`ai-native-doctrine`) is *the receipt-audit applies to our own posts hardest*. post-proof makes that
law **mechanical**: it sits between the post generators and the posting rail —
`draft → post-proof → fallscrub → the rail` — and refuses anything the proof doesn't back.

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

The estate already **generates** posts (`fallpost`, `fallgravity`) and already has the sanctioned
Meta Graph **rail** (`si-didy-loop/rail.mjs` — rate-disciplined, token-redacted, whole except a
one-time Page Access Token the owner pastes themselves). post-proof is the **gate** that makes that
rail's posts *provable*. It is wired into the rail's `postable` check: no receipt, no post.

## Run it

```bash
node --test kernel.test.mjs
node tools/witness.mjs mutate kernel.mjs --timeout 20000 --cap 600 --baseline witness.baseline.json --test node --test kernel.test.mjs
node make-page.mjs
```

## Honest limits (v1)

Checkable claims only — it backs facts a receipt can carry; it does not fact-check free prose or
judge tone (the one-line "what it does" rides on trust, capped and visible). Tamper-evident, **not
yet signed/anchored** (Ed25519 issuer signing + external anchor is v2). You bring the receipt (the
probes live in the rail's runner). The live send to a real page needs the one-time channel connect —
it can't be faked. Not audited. Mutation-witnessed in CI (survivors carry a written equivalence
argument). MIT.
