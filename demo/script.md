# Bridge Demo — Full Screenplay

Total runtime target: **2:45 - 3:00**

---

## PRE-RECORDING SETUP

### Environment

- [ ] Terminal: `cd` into bridge project root
- [ ] Run `bash scripts/reset-demo.sh` — wait for "demo reset" confirmation
- [ ] Start dev server: `npm run dev` (or use Vercel deploy URL)
- [ ] Open Chrome/Arc to `http://localhost:3000`
- [ ] Browser: full-screen, hide bookmarks bar, clean tab bar
- [ ] Zoom browser to ~90% so the full war room fits without scroll
- [ ] Verify: war room shows `[ ALL CLEAR ]`, timeline has 47 green dots, 5 agents say "standing by"

### Recording setup

- [ ] OBS or QuickTime — 1080p, 30fps minimum
- [ ] Audio: external mic preferred, test levels (speak a sentence, check waveform)
- [ ] If PiP: webcam in bottom-right, small (15% of frame), round mask if OBS
- [ ] Close all notifications (Do Not Disturb on Mac)
- [ ] Close other apps visible in dock (keeps frame clean)

### Practice run

- [ ] Read the entire script below out loud once with a timer
- [ ] Click RUN DEMO and practice talking over the animation
- [ ] Hit RESET and do it again — should feel natural by take 3

---

## THE SCRIPT

### BEAT 1 — HOOK (0:00 - 0:20)

**SCREEN:** War room is calm. ALL CLEAR. Green timeline. Idle agents.

**MOUSE:** Slowly drift over the timeline dots (shows tooltips with past deploys). Then rest on the status block.

**SAY:**
> "Every engineering team has a channel where deploys go to die. A push lands, CI goes green, and if something's wrong — you find out from users, hours later."
>
> *[brief pause]*
>
> "Bridge replaces that with a war room that investigates pushes for you."

**TIMING NOTE:** Don't rush the hook. Let the calm war room sell itself. The contrast with what comes next is the whole point.

---

### BEAT 2 — THE PUSH (0:20 - 0:50)

**ACTION:** Click the `RUN DEMO` button.

**SCREEN:** Immediately:
- Feed panel: "demo scenario armed" message appears
- ~2s: "dev-3" chat message: "pushing the auth refactor real quick before standup"
- ~3s: Status flips `ALL CLEAR` → `MONITORING`. New deploy appears on timeline (score 0.05 briefly).
- ~4s: Score snaps to `0.91`. Status flips to `CRITICAL`. Risk arc fills red. Budget starts at 92%.

**MOUSE:** As the deploy appears, mouse over to the new red dot on the timeline.

**SAY:**
> "A push just landed from dev-3 — a developer who's never touched the auth code before."
>
> *[status flips to CRITICAL]*
>
> "Bridge scores it: 0.91 risk. That's structural signals — an external fetch injected into the auth path — combined with behavioral signals — a novel author in a critical area, pushing at 3 AM."
>
> "Five investigator agents spin up in parallel."

**TIMING NOTE:** The status flip to CRITICAL happens at ~4 seconds. Time your "0.91 risk" line to land right as it flips.

---

### BEAT 3 — THE INVESTIGATION (0:50 - 1:35)

**SCREEN:** Five agent cards animate:
- `DISPATCHED` → `INVESTIGATING` (scan-line shimmer starts)
- Stream text appears line by line in each card
- TOK and STEPS counters roll up smoothly
- Budget ticks down: 92% → 78% → 61% → 44%

**MOUSE:** Move to each agent card as you mention it. Point to the stream text.

**SAY:**
> "Each agent is a durable sub-workflow running on Vercel's Workflow Development Kit."
>
> *[point to HISTORY card as it shows "0 prior commits to lib/auth by dev-3"]*
>
> "History agent checks git — this author has zero prior commits to the auth path. They're not in CODEOWNERS."
>
> *[point to DIFF card as it shows "new fetch() at line 247"]*
>
> "Diff agent walks the AST and finds a new external fetch to stats-collector.io — a domain that's not in the allowlist."
>
> *[point to TRACE card completing]*
>
> "Trace agent finds no anomalies yet — the code hasn't been deployed, so there's nothing to see in observability."
>
> *[gesture toward DEPENDENCY completing]*
>
> "Dependencies are clean — no new packages, lockfile integrity checks out."
>
> *[point to budget in status block]*
>
> "You can see the budget ticking down as agents consume tokens. Each step is metered."

**TIMING NOTE:** Agents complete between ~13s and ~17s into the demo. Don't try to catch every agent exactly as it completes — cover history and diff (the critical ones) first, then summarize the rest.

---

### BEAT 4 — THE SYNTHESIS (1:35 - 2:00)

**SCREEN:** At ~18s into demo:
- All 5 agents show `COMPLETE`
- Verdict modal slides in from bottom-right
- Level: `CRITICAL`
- 3 concerns listed
- Suggested action visible

**MOUSE:** Move to the verdict modal. Point at each concern.

**SAY:**
> "All five agents are done. The synthesizer collapses their findings into a single verdict."
>
> *[point to verdict level]*
>
> "CRITICAL. Three concerns:"
>
> *[read them naturally, not word-for-word]*
>
> "One — a new external fetch to a non-allowlisted domain, injected into the auth path. Two — the author has never modified this code. Three — pushed at 3:42 AM, outside the team's normal window."
>
> *[point to suggested action]*
>
> "Suggested action: hold at zero percent rollout, page the security oncall."

---

### BEAT 5 — THE DURABILITY MOMENT (2:00 - 2:30)

**SCREEN:**
- SUSPENDED overlay appears at bottom: `[ WORKFLOW · SUSPENDED · awaiting human · t+0:XX ]`
- Timer is ticking up

**MOUSE:** Point to the SUSPENDED bar.

**SAY:**
> "Here's the part that matters. While I've been talking, this workflow has been *paused*. Not polling. Not retrying. Paused — using WDK's signal-wait primitive."
>
> "It will stay paused for as long as the human needs. Minutes. Hours. Through redeploys, cold starts, server crashes. The state is durable in KV."

**ACTION:** If Discord is set up — show the Discord message with Acknowledge/Hold/Page buttons. Click Acknowledge.

If no Discord — click the acknowledge button in the UI verdict modal.

**SCREEN:** Green flash on the border (ResumePulse). SUSPENDED overlay disappears.

**SAY:**
> "And when someone acknowledges — the workflow resumes, the war room reflects it, and the team has a record of who decided what and when."

---

### BEAT 6 — CLOSE (2:30 - 2:50)

**MOUSE:** Slowly pan across the full war room one more time.

**SAY:**
> "Bridge is built entirely on the Vercel Workflow Development Kit. The webhook handler, the signal pipeline, each investigator, the synthesizer, the human pause — every step is a durable workflow."
>
> "The whole investigation survives crashes, redeploys, and pauses for as long as humans need to decide."
>
> *[brief pause]*
>
> "Thanks for watching."

**HOLD:** Keep the war room on screen for 3-5 more seconds of silence, then stop recording.

---

## POST-RECORDING

### Immediate

- [ ] Watch the recording once, end to end — check audio is clean, no notification popups
- [ ] Trim dead air at start/end (no fancy cuts needed)
- [ ] If under 2:30 or over 3:15, re-record — pacing matters more than perfection

### Save

- [ ] Screen-only take: `demo/take1-screen.mp4`
- [ ] PiP take (if recording with face cam): `demo/take2-final.mp4`

### Upload

- [ ] YouTube: upload as **Unlisted**. Title: "Bridge — Durable Multi-Agent Deploy War Room (Vercel WDK Hackathon)"
- [ ] Loom: upload as well (backup link for submission form)
- [ ] Save both URLs to `.demo-video-urls` (one per line)

### Screenshot

- [ ] During a recording or a separate run, pause/screenshot when the war room is in CRITICAL state
- [ ] Save as `docs/screenshot-critical.png` (1280px+ wide, PNG)
- [ ] This is the hero image for the README

---

## TIPS

- **Pacing over perfection.** A slightly stumbled word is fine. Dead air and rushing are not.
- **Let the UI breathe.** The animations are designed to be watched. Don't talk over every transition — let 1-2 seconds of the CRITICAL flip play in silence.
- **Point, don't click randomly.** Mouse movement tells the viewer where to look. Move deliberately.
- **Volume consistency.** Keep your voice at the same level throughout. The most common mistake is trailing off during the close.
- **The durability moment is the peak.** Slow down there. That's what wins the hackathon.
