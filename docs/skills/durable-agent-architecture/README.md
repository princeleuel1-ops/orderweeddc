# Durable Agent Architecture Skill

This package turns the talk's core idea into an installable, provider-neutral engineering skill: separate the durable execution layer from the fast-changing context layer and the replaceable compute layer.

## Install

Copy the entire `durable-agent-architecture-skill` folder into the skills directory used by your AI coding environment. Keep the folder name stable and activate the skill by name:

```text
durable-agent-architecture
```

Typical locations vary by tool. The only required file is `SKILL.md`; the remaining files add templates, audits, examples, and validation.

## Best invocation

```text
Activate the durable-agent-architecture skill. Inspect the real project before changing anything. Map execution, context, and compute; preserve verified progress; find coupling that causes rewrites; then implement durable state, resumability, adapters, full traces, outcome scoring, failure drills, and a safe migration plan. Do not confuse plans with built reality.
```

## Package map

- `SKILL.md` — complete operating skill.
- `templates/architecture-contract.json` — provider-neutral architecture contract.
- `templates/run-record.json` — durable run/checkpoint record.
- `templates/reviewer-report.md` — recursive evaluation report.
- `checklists/half-life-audit.md` — architecture audit checklist.
- `checklists/failure-drills.md` — reliability acceptance suite.
- `examples/health-triage-loop.md` — health-check, triage-agent, reviewer loop.
- `examples/autonomous-website-governor.md` — durable website-governor example.
- `scripts/validate_architecture.py` — zero-dependency contract validator.
- `references/source-notes.md` — source thesis and interpretation notes.
