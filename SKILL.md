---
name: "claim-receipt-gate"
description: "Checks a draft post, release note, README or changelog against the build-receipt of what was actually shipped, and refuses it if any checkable claim (a link, live, CI green, verified or clean, a K/N score, a percent) is not backed by that receipt. Use before an agent publishes or announces anything about software it built, or when the user asks whether a launch post overclaims. Deterministic Node.js script with no LLM judge and no network."
summary: "Ship or refuse: pull every checkable claim out of a draft (links, live, CI green, verified, K/N scores, percents), check each against the build-receipt, and name every unbacked one with its reason. Seals passed posts. No LLM judge, no network, one Node.js file, mutation-tested."
version: "1.0.0"
tags: ["release-notes", "marketing", "claims", "verification", "deterministic", "receipts"]
use_cases: ["Stop an agent announcing a feature as live before a real 200 was seen", "Refuse a release note that quotes a test score or percent the build did not measure", "Seal every shipped post to the receipt that backed it, for audit"]
docs_url: "https://sjgant80-hub.github.io/post-proof/"
---

# claim-receipt-gate: does the post say only what the build proved?

An agent that writes about its own work tends to round up: "live" before anything answered, "all tests
pass" when CI failed, "50/50" when the gate caught 41. This skill is the step between the draft and the
publish button. It reads the draft and the build-receipt (what a real probe observed) and answers
**SHIP** only when every checkable claim in the draft is backed. Otherwise it answers **REFUSE** and lists
each unbacked claim with the reason, so the agent can fix or cut exactly those words.

## When to use it

- Before publishing a release note, changelog entry, README update, launch post or status update about
  software the agent built or changed.
- When the user asks "does this announcement overclaim?" and a receipt (URL check, CI result, test or
  mutation scores, measured facts) is available.
- Not for judging tone, persuasion or claims with no number, link or status in them; see "Where it stops".

## How to run it

```
node scripts/claim-receipt-gate.mjs input.json      # or - to read the input from stdin
```

The input is one JSON object:

```json
{
  "post": "the draft text",
  "receipt": {
    "url": "https://your-product.example",
    "live": true,
    "ci": "success",
    "witness": { "clean": true, "killed": 41, "total": 43 },
    "facts": [ { "key": "speed", "value": "parsed 1 GB in 12 s" }, { "key": "link", "value": "https://docs.example" } ]
  },
  "sealedAt": "2026-11-01T10:00:00Z"
}
```

- `post` may also be `{"text": ...}` or `{"hook", "reveal", "cta"}`.
- `receipt.live` is true only if a real HTTP 200 was observed; `ci` is `"success"`, `"failure"` or `null`;
  `witness` is a mutation-test result or `null`; `facts` are measured facts a post may quote. A fact with
  key `link` whitelists an outbound link that is not the product URL.
- `sealedAt` (optional): when the post passes, the report includes a content-addressed post-receipt that
  binds the post's SHA-256 to the receipt's SHA-256.

Exit code: **0 = SHIP**, **1 = REFUSE**, **2 = the input could not be used** (a reason on stderr).

Agent rule: run the gate before publishing; on REFUSE, change or remove each claim in `unbacked` and run
it again; never publish on REFUSE, and never edit the receipt to make a post pass.

## What it prints

A JSON report: `verdict` (SHIP or REFUSE), `why`, `receiptValid`, `checked` (how many checkable claims
were found), `backed` and `unbacked` (each with `type`, `claim` and `why`), and `postReceipt` when sealed.
`examples/refuse.json` gives a post with six unbacked claims (two links, `50/50`, `70%`, live, verified);
`examples/refuse.out.json` is the exact report. `examples/ship.json` is its honest twin: five claims, all
backed, sealed.

## Re-check this skill yourself

- **The examples:** `node scripts/claim-receipt-gate.mjs examples/refuse.json` prints exactly the report in
  `examples/refuse.out.json`.
- **The page:** https://sjgant80-hub.github.io/post-proof/ runs the same logic in a browser.
- **The source:** https://github.com/sjgant80-hub/post-proof (MIT). The script's KERNEL is the text of
  `kernel.mjs`, which the page also runs; CI fails if the script or the page drifts from it.
- **CI on every push:** https://github.com/sjgant80-hub/post-proof/actions runs the tests (the kernel, and
  this script run alone in an empty folder on the examples), the drift check, the receipt check, the witness
  mutation gate and the ZIP build.
- **The mutation gate:** witness v0.6 (https://github.com/sjgant80-hub/witness, tag `v0.6`) made
  91 single-operator changes (mutants) to the kernel and the tests caught 89 of them. The other 2 were reviewed as equivalent (they cannot change any output) and baselined with a written reason each. The receipt is
  `receipts/witness.json` in the repository, for kernel SHA-256 `f873849968b1f1bb7550cb270cb7377a08f9ec907da7907e5e349da62f06a807`. With the repository
  checked out, `node gate.mjs --witness tools/witness.mjs` re-runs it.

## Where it stops

- It does not fetch anything. Whoever builds the receipt must probe for real; a false receipt gets a false
  pass. It proves the post matches the receipt, not that the receipt is true.
- It checks only checkable claims: URLs, K/N scores, percents, live / shipped / deployed / in production,
  CI green / tests pass, verified / clean. "Fastest on the market" is not caught.
- A percent or a K/N score is backed by a fact only when the fact states the same whole number: "3%" is
  not backed by a fact saying "30%", nor "1/4" by "11/40". Write a percent in a fact as a percent ("30%" or
  "30 percent") and a score as K/N ("41/43"); it does not convert units or round.
- Numbers written as words ("fifty out of fifty", "a hundred percent") are not parsed: it stops habitual
  rounding-up, not a writer deliberately evading it.
- A bare number that is not a score or a percent ("seven layers") is left alone by design.

---

MIT licence: see `LICENSE`.
