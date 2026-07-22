# CANA Windows Governor v3

This package adds a real model-powered worker layer to the existing CANA
supervisor. It is built for Windows and resolves the project workspace from
the parent of the installed `.cana-governor-v3` directory by default.

It does **not** require an Antigravity conversation to remain open. Antigravity
can install, start, inspect, pause, resume, or stop it, while Windows Task
Scheduler and the watchdog keep the process alive.

## What it preserves

- Canonical public domain: `orderweeddc.com`.
- `dmvweeddelivery.com` maps to `/delivery`.
- `weedneardc.com` maps to `/near-me`.
- Neighborhood domains map to genuinely useful neighborhood sections.
- `districtweed.com` stays parked/gated.
- `weeddmv.com` stays isolated until separately repaired and reviewed.
- One shared application and system of record; no doorway-site network.
- Existing Git history, working files, `GOVERNOR_STATE.md`, `task.md`, and
  `walkthrough.md` are inspected and preserved.

## What is new

1. OpenCode supplies the actual coding-agent runtime. It is open source, works
   on Windows, supports OpenRouter, and can run non-interactively.
2. Five lanes use separate prompts, model IDs, credentials, quotas, and powers.
3. SQLite stores every cycle, lane result, quota debit, backoff, and verdict.
4. The loop survives a terminal closing, Windows logon, stale workers, 401/402/
   429/5xx responses, and daily free-tier exhaustion.
5. Gemini image generation is an optional, separately budgeted worker. It only
   consumes reviewed image-request manifests and never invents product photos,
   licenses, reviews, availability, prices, medical outcomes, or trust signals.
6. PASS queues the next mission. It does not terminate the governor.

## Important truth about “free forever”

The included default model is `tencent/hy3:free`. OpenRouter currently marks
that free endpoint as **going away July 21, 2026**. Free endpoints also have
daily request and provider-capacity limits. This runner never tries to evade
those limits with duplicate accounts or key rotation. When the allowance is
exhausted, it saves state, sleeps, and resumes after the configured reset. If a
model is removed, the governor holds rather than silently switching to paid
usage; replace each affected lane's model reference with another verified model.

Five lanes can share one OpenRouter key, or each lane can use a legitimately
separate key. Separate keys are for accounting/isolation—not rate-limit evasion.

One lane launch is not necessarily one provider request: an agent can call the
model again after a tool result. The package therefore caps OpenCode `steps` at
2/3/8/5/2 for the five roles and reserves the full 20-turn worst case before a
mission begins. With the conservative 45-turn daily cap, no more than two full
missions start per day. Unused reservations favor reliability over quota burn.

## Before installing

1. Revoke and replace any API key ever pasted into a chat, screenshot, source
   file, terminal history, or public issue. Do not reuse an exposed key.
2. Create restricted keys with hard spending limits. Start at `$0` paid spend
   if free-only operation is required.
3. Confirm that Python 3.11+, Node.js/npm, and Git are installed.
4. Keep a normal backup of the project. The installer does not reset, clean, or
   delete the repository.

## One-time Windows setup

Open **PowerShell** (not Command Prompt), go to this extracted folder, and run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\Install-CanaGovernor.ps1
```

The installer:

- verifies the exact workspace instead of assuming it exists;
- installs `opencode-ai@latest` only if OpenCode is missing;
- copies this package to `.cana-governor-v3` inside the project;
- keeps the Governor OpenCode configuration separate from any existing config;
- adds runtime exclusions to `.gitignore` without replacing existing entries;
- prompts for secrets using Windows secure input and encrypts them with DPAPI;
- runs a dry preflight; and
- installs two per-user tasks: governor-at-logon and a five-minute watchdog.

The encrypted secret file can only be decrypted by the same Windows account on
the same computer. The secrets are injected into the child process and are not
put in command-line arguments or logs.

## Controls

Run these from the installed `.cana-governor-v3` directory:

```powershell
.\scripts\Control-CanaGovernor.ps1 status
.\scripts\Control-CanaGovernor.ps1 pause
.\scripts\Control-CanaGovernor.ps1 resume
.\scripts\Control-CanaGovernor.ps1 stop
.\scripts\Control-CanaGovernor.ps1 start
```

`stop` is a durable global stop. `start` clears STOP before starting. `pause`
finishes the current atomic action, checkpoints, and waits. No control deletes
work or rewrites Git history.

## Five model/API lanes

Edit `config\governor.json` to change a model. OpenCode model references use
`provider/model`; the default aliases are:

| Lane | Purpose | Default reference |
| --- | --- | --- |
| 1 | strategy/product/architecture | `cana_lane_1/tencent/hy3:free` |
| 2 | truth/research/SEO/AEO/compliance | `cana_lane_2/tencent/hy3:free` |
| 3 | implementation/engineering | `cana_lane_3/tencent/hy3:free` |
| 4 | testing/security/accessibility/adversarial QA | `cana_lane_4/tencent/hy3:free` |
| 5 | independent review/integration/release receipt | `cana_lane_5/tencent/hy3:free` |

All five Hy3 lanes request the model's `high` reasoning variant. Change this in
`config\governor.json` if a replacement model uses different variant names.

Use the same key for all five when they are all accessed through one OpenRouter
account. To isolate legitimate separate keys, rerun:

```powershell
.\scripts\Set-CanaSecrets.ps1 -SeparateLaneKeys
```

## Gemini image worker

Gemini images are disabled until a new Gemini key is stored. The secure setup
script enables the worker when you enter a new Gemini key, disables it when you
skip that field, and the installer adds the current `google-genai` package only
when enabled.

The implementation lane may place JSON requests in:

`.governor\image-requests\pending`

Each request must include:

```json
{
  "id": "hero-2026-001",
  "prompt": "Original, adult-oriented editorial cannabis discovery artwork...",
  "aspect_ratio": "16:9",
  "image_size": "1K",
  "target_relative_path": "public/generated/hero-2026-001.png",
  "rationale": "Improves the home-page explanation without product claims.",
  "rights_confirmed": true,
  "safety_reviewed": true
}
```

The worker rejects traversal paths, absolute paths, unsupported sizes/ratios,
unreviewed requests, duplicate IDs, and requests above the daily cap. Generated
files receive a receipt containing the prompt hash, model, timestamp, output
hash, and target path.

## What the loop will never do automatically

- expose, print, commit, or transmit API keys in prompts;
- rotate accounts/keys to evade a provider limit;
- deploy to production, change DNS, purchase services, message people, or run
  paid ads without an explicitly configured external gate;
- erase files, reset Git, force-push, rewrite history, or operate outside the
  exact workspace;
- invent rankings, traffic, reviews, licenses, legal approval, deals, menus,
  inventory, pricing, delivery availability, revenue, users, or test results;
- use private reviewer/customer information or create trademark-confusing
  content;
- call a build “done” merely because a model said so.

## Evidence and status

Runtime state is local under `.governor`:

- `state.sqlite3` — cycles, lanes, quotas, verdicts, and retries.
- `status.json` — current mission and last receipt.
- `heartbeat.json` — watchdog heartbeat.
- `artifacts\` — raw lane responses and compact evidence receipts.
- `logs\` — sanitized process output.
- `control\STOP` and `control\PAUSE` — durable controls.

The project files `GOVERNOR_STATE.md`, `task.md`, and `walkthrough.md` remain the
human-readable source of truth. Models must update them only when the relevant
facts have actually been verified.

## First run behavior

The first seeded mission is `M-STAGE-001`, carried forward from the existing
state. Before editing, the agents inspect the repository, Git status, current
tests, `GOVERNOR_STATE.md`, `task.md`, and `walkthrough.md`. If the repository
cannot prove what `M-STAGE-001` means, Lane 1 reconstructs the smallest truthful
mission contract from direct evidence rather than inventing completion.
