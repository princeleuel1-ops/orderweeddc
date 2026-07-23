# Namecheap Stellar Business — Next.js 16 feasibility evidence

Compiled 2026-07-23 from primary sources (Namecheap KB, cPanel docs, Phusion
Passenger docs, npm registry, Next.js docs) plus live header probes.

| # | Question | Finding | Confidence | Source |
|---|---|---|---|---|
| 1 | Node.js versions in cPanel Node Selector | Namecheap shared offers Node 6.17 → **24.13**, incl. 20.20 / 22.22 / 24.13. Page updated 2026-02-19. | Documented | namecheap KB 129/22; KB 10047 |
| 2 | Passenger startup / port / app root | Startup file default `app.js` (else `PassengerStartupFile`). Passenger **reverse-binds** the socket — the app's requested port is ignored; app must `.listen()` once. App root must be **outside `public_html`**. | Documented | docs.cpanel.net node install; phusionpassenger reverse_port_binding; namecheap KB 10686 |
| 3 | LVE limits (Stellar Business) | CPU 100% (burst 400%), **PMEM 2 GB**, maxEntryProc 40, IO 50 MB/s. | Documented | namecheap KB 1127/103 |
| 4 | `next build` OOM / local-build | Namecheap's own KB instructs building **locally**, uploading, and installing runtime deps only — tacit admission in-place builds are unreliable on shared. | Documented (Namecheap guidance) | namecheap KB 10686 |
| 5 | PostgreSQL / SQLite | **Correction:** PostgreSQL 10.23 IS listed for Stellar Plus/Business (alongside MariaDB 11.4.9). No documented prohibition on file SQLite on the `/home` filesystem. | Documented (PG) / Inferred (SQLite allowed) | namecheap KB 129/22 |
| 6 | Prisma binaryTarget / OpenSSL | Passenger backend = AlmaLinux/Rocky 8 or 9 (OpenSSL 1.1.x / 3.0.x). No CloudLinux row in Prisma table → set `binaryTargets` explicitly; auto-`native` mismatches when built off-server. | Documented (OS) / Inferred (mapping) | docs.cpanel.net; prisma schema reference |
| 7 | Cron | Supported. Min interval **5 min**, ≤5 simultaneous jobs. | Documented | namecheap KB 9453/29 |
| 8 | Env vars | Set in Setup Node.js App UI; config-driven, re-injected on each Passenger spawn → persist across restarts. | Documented (set) / Inferred (persistence) | namecheap KB 10047 |
| 9 | SSL apex + www | Free automatic AutoSSL / web-based SSL-proxy on shared (WHM AutoSSL is VPS/Dedicated only). | Documented (free/auto) / Not confirmed (dual-coverage specifics) | namecheap KB 10504, 10743, 10728 |
| 10 | `tmp/restart.txt` restart | Confirmed: touch `tmp/restart.txt` restarts mod_passenger app; `tmp` must be created manually. | Documented | docs.cpanel.net node install |
| 11 | Long-running / websockets | No explicit prohibition; constrained by 40-proc / 2 GB LVE and active-process-management policy. Under-documented. | Inferred | namecheap KB 10656, 1127 |
| 12 | Next.js on Passenger | Namecheap's flagship guide predates Next 15/16 (custom `server.js`). Next `output:'standalone'` `server.js` reads PORT/HOSTNAME, `.listen()` once → Passenger-compatible; **must copy `public` + `.next/static` manually** (our builder does). | Documented / caveat from Next docs | namecheap KB 10686; nextjs output docs |
| 13 | Next.js 16 min Node | `engines.node >=20.9.0` across next@16.x. | Documented | npm registry `next`; nextjs install docs |
| 14 | Edge stack / Pingora | Origin = LiteSpeed 6.2.2. Live probe 2026-07-23: `namecheaphosting.com`, `cp.`, `webmail.`, and `orderweeddc.com` all returned 502 via `Server: Pingora` → provider-side edge layer erroring zone-wide, independent of the app. | Documented (LiteSpeed) / First-hand live (Pingora 502) | namecheap KB 129/22; live curl probes |

## Verdict

A Next.js 16 `output:'standalone'` build + Prisma (explicit `binaryTargets`) +
SQLite on the persistent home filesystem is **feasible but operationally
fragile** on Stellar Business. Every required primitive is documented-supported.
Top three risks: (1) in-place build OOM — mitigated by off-server artifact;
(2) Prisma engine/OpenSSL mismatch — mitigated by bundling both RHEL targets;
(3) Namecheap's Pingora edge proxy can 502 independently of the app — diagnose
host-side first. The current `orderweeddc.com` 502 coincided with a provider-wide
Pingora outage on 2026-07-23, so it is likely host-side, not the application.
