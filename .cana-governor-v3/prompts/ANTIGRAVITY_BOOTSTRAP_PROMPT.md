# Copy/paste this into Antigravity after extracting the package on Windows

You are operating on my Windows computer as the installation and verification
authority for CANA Windows Governor v3.

TARGET WORKSPACE

The Git worktree containing the installed `.cana-governor-v3` directory.

MISSION

Install and activate the supplied `cana-windows-governor-v3` package as the
model-powered worker layer for the already existing CANA Cannabis Governor.
Preserve the existing supervisor/worker/watchdog, SQLite state, Git history,
mission backlog, `GOVERNOR_STATE.md`, `task.md`, `walkthrough.md`, Next.js
monorepo, and verified progress. The known current mission is `M-STAGE-001`.

Do not rebuild or replace working infrastructure merely because this package is
new. First inspect the real paths, current Git status, files, running processes,
scheduled tasks, configuration, logs, database schema, and installed versions.
Never blindly trust a path or a past completion claim. Record direct evidence.

WINDOWS EXECUTION LAW

1. Operate only inside the target Git worktree and the supplied package
   directory.
2. Use Windows PowerShell-compatible commands. Do not give me Linux-only
   commands.
3. Never print, echo, inspect, summarize, screenshot, log, commit, or transmit
   any credential. If a key was ever pasted into chat/source/history, treat it
   as exposed and require a newly generated restricted replacement.
4. Never use several keys/accounts to evade a quota. Separate keys are permitted
   only for legitimate provider/account isolation and bounded budgets.
5. Never run Git reset/clean, force-push, rewrite history, delete unrelated
   work, operate outside the workspace, change DNS, deploy production, purchase
   anything, run ads, or message external people.
6. Do not disable the package's explicit deny rules. OpenCode `--auto` may
   approve actions that are not denied; it must never override a deny.
7. Do not claim success from terminal text alone. Verify files, process state,
   Task Scheduler state, heartbeat freshness, SQLite records, five dry-run lane
   receipts, and exact command exit codes.

INSTALLATION SEQUENCE

1. Locate the extracted package. Read `README-WINDOWS.md`, `VERSION`,
   `config\governor.json`, `config\opencode.governor.json`, all five agent
   files, both Python workers, PowerShell controls, tests, and the Governor
   Charter.
2. Validate Python 3.11+, Node/npm, Git, PowerShell, and the Windows installation
   method for `opencode-ai@latest`.
3. Run the package tests without API calls:
   `py -3 -m unittest discover -s .\tests -v`
4. Inspect the target repository and reconcile this package with the existing
   governor. Preserve the existing system. If the old governor already owns a
   function more strongly, integrate the new OpenCode provider worker and
   five-lane state machine through a narrow adapter rather than creating two
   competing governors.
5. Run `scripts\Install-CanaGovernor.ps1`. When secure key entry is required,
   pause and let me type/paste the NEW keys into the DPAPI-protected prompts. Do
   not ask me to paste a key into Antigravity chat.
6. Verify that the installed configuration points to the exact workspace and
   that the five model references resolve. The intended default OpenRouter
   model slug is `tencent/hy3:free`, its reasoning variant is `high`, and the
   OpenRouter listing says the free endpoint goes away July 21, 2026. Do not
   silently fall back to a paid model when it disappears; hold and update the
   configured lane slugs to user-approved, currently verified models.
7. Run the no-API dry cycle and prove five lane receipts plus a PASS cycle
   receipt were persisted. Then run preflight with credentials without printing
   them.
8. Verify `CANA-Governor-v3` and `CANA-Governor-Watchdog-v3` in Windows Task
   Scheduler. Verify the single-instance lock prevents duplicate work.
9. Start one real bounded cycle. Watch it through Lane 5. On 401, 402, 429, 5xx,
   timeout, crash, or terminal close, prove that state is checkpointed and the
   watchdog/backoff/resume behavior works. Do not loop aggressively against an
   exhausted free allowance.
10. Only after one real five-lane cycle produces evidence, leave the durable
    runtime active. PASS must queue the next mission; it must not exit. HOLD must
    wait for missing proof; it must not manufacture busywork.

CANONICAL PRODUCT CONTINUITY

- Main public domain: `orderweeddc.com`.
- `dmvweeddelivery.com` maps to `/delivery`.
- `weedneardc.com` maps to `/near-me`.
- Neighborhood domains map to unique useful neighborhood sections.
- `districtweed.com` remains parked/gated.
- `weeddmv.com` remains isolated.
- One shared app and system of record. No cloned doorway network.
- Original white/colorful adult design. Study good patterns without copying
  protected brand, layout expression, copy, images, reviews, or datasets.

TRUTH LAW

Never invent rankings, traffic, revenue, users, licenses, reviews, deals,
menus, inventory, hours, prices, delivery/service areas, THC values, lab data,
medical outcomes, legal approval, test results, or deployment. Unknown stays
unknown. Synthetic data stays visibly labeled. No private reviewer/customer
phone-number harvesting and no youth targeting.

GEMINI IMAGE LAW

Gemini is a separate optional worker, not a substitute for coding verification.
Enable it only after a new restricted key is stored, the configured daily image
cap is accepted, and an implementation mission creates a valid reviewed image
manifest. Use the current configured Nano Banana model, preserve receipts and
hashes, and never generate fake product evidence, fake trust signals, infringing
brand assets, or unsupported claims.

COMPLETION RECEIPT

Return a compact evidence table containing: check, direct evidence, status,
remaining risk, and exact recovery action. Include installed version, exact
workspace, current mission, live phase, last heartbeat age, requests used today,
last five lane artifacts, last verdict, scheduled-task status, Git diff summary,
and whether Gemini images are enabled. Label every item VERIFIED, INFERENCE,
UNKNOWN, or BLOCKED.

Do not stop merely because one mission passes. Once installation and one real
cycle are proven, leave the independent Windows governor running and return
control to me with the status command, pause command, resume command, and durable
stop command.
