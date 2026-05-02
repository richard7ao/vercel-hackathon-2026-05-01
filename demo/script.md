# Bridge Demo Recording Script (3 minutes)

## Pre-recording checklist

- [ ] Run `bash scripts/reset-demo.sh` to reset demo state
- [ ] Open browser to `http://localhost:3000` (or Vercel deploy URL)
- [ ] Verify war room shows ALL CLEAR with 47 deploys
- [ ] OBS/QuickTime set to 1080p
- [ ] Audio check — mic levels good

## Script

### 0:00-0:20 — Hook

> "Every team has a Slack channel where deploys go to die. Bridge replaces
> it with a war room that *investigates* pushes for you."

Show the calm war room. Point out the timeline, the 5 idle agents, the ALL CLEAR status.

### 0:20-0:50 — The push

Trigger the demo (click RUN DEMO or push the staged commit live).

Watch status flip: ALL CLEAR -> MONITORING -> CRITICAL.

> "A push just landed. Bridge scores it instantly — 0.91 risk. Five
> investigator agents spin up in parallel."

Five agent cards animate from IDLE to DISPATCHED to INVESTIGATING.

### 0:50-1:30 — The investigation

Talk through each agent's finding as it streams in:

> "History agent: this author has never touched auth code.
> Diff agent: there's a new external fetch to a domain not in the allowlist.
> Trace agent finds no anomalies yet — the code hasn't been deployed.
> Dependency agent: clean, no new packages.
> Runtime agent: too early to tell, but provisional."

Point out the budget ticking down as agents consume tokens.

### 1:30-2:00 — The synthesis

Verdict modal appears with CRITICAL.

> "The synthesizer collapses all five findings into a single verdict.
> It recommends holding the deploy at 0% rollout and paging security."

Read the suggested action. Point out the 3 concerns listed.

### 2:00-2:30 — Durability moment

> "While I've been talking, this workflow has been paused — waiting for
> a human to acknowledge. This is real WDK signal/wait."

Show the SUSPENDED overlay with elapsed time.

Click Acknowledge (in Discord or the UI). War room updates — green flash.

### 2:30-3:00 — Close

> "Built on Vercel Workflow Development Kit. Each investigator is a
> durable sub-workflow. The whole investigation survives crashes,
> redeploys, and pauses for as long as humans need to decide.
> Thanks for watching."

## Post-recording

- [ ] Trim dead air (no fancy cuts)
- [ ] Save screen-only as `demo/take1-screen.mp4`
- [ ] Record Take 2 with PiP face cam as `demo/take2-final.mp4`
- [ ] Upload to YouTube (unlisted) + Loom
- [ ] Save URLs to `.demo-video-urls`
