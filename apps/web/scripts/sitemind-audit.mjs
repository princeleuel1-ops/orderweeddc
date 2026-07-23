/**
 * SiteMind Marketing Audit Script
 *
 * Runs the SiteMind marketing audit against the local database and prints the
 * full JSON receipt to stdout.
 *
 * Usage:
 *   node scripts/sitemind-audit.mjs [--min-score=N]
 *
 * Exit codes:
 *   0 — success (or score >= min-score if flag is provided)
 *   1 — score below --min-score threshold, or fatal error
 *
 * No network calls. No LLM calls. No Date.now() randomness.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import {
  collectSitemindCounts,
  buildSitemindReceipt,
} from '../src/lib/sitemind.mjs';
import { NEIGHBORHOOD_SLUGS } from '../src/lib/neighborhood-configs.mjs';
import { STRAIN_SLUGS } from '../src/lib/strain-content.mjs';
import { LEGAL_FAQ_COUNT } from '../src/lib/legal-faq.mjs';
import { CANONICAL_TENANT_DOMAIN } from '../src/lib/tenant-host.mjs';

// ---------------------------------------------------------------------------
// Resolve paths
// ---------------------------------------------------------------------------

const scriptPath = fileURLToPath(import.meta.url);
const webRoot = path.resolve(path.dirname(scriptPath), '..');

// ---------------------------------------------------------------------------
// Load DATABASE_URL from apps/web/.env if not already set in the environment.
// The repo does not use dotenv; we parse the file manually — same pattern as
// the benchmark script that reads `.env` for isolated runs.
// ---------------------------------------------------------------------------

if (!process.env.DATABASE_URL) {
  const envPath = path.join(webRoot, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (key === 'DATABASE_URL' && !process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Parse CLI flags
// ---------------------------------------------------------------------------

let minScore = null;
for (const arg of process.argv.slice(2)) {
  const match = arg.match(/^--min-score=(\d+(?:\.\d+)?)$/);
  if (match) {
    minScore = Number(match[1]);
  }
}

// ---------------------------------------------------------------------------
// Read git revision from .git/HEAD (deterministic, no child_process needed)
// Falls back to 'UNKNOWN' if the chain cannot be resolved.
// ---------------------------------------------------------------------------

function resolveGitRevision() {
  try {
    // Look for .git starting at webRoot and walking up
    let dir = webRoot;
    let dotGitPath;
    for (let i = 0; i < 5; i++) {
      const candidate = path.join(dir, '.git');
      if (fs.existsSync(candidate)) {
        dotGitPath = candidate;
        break;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    if (!dotGitPath) return 'UNKNOWN';

    const stat = fs.statSync(dotGitPath);
    let gitDir;
    if (stat.isDirectory()) {
      gitDir = dotGitPath;
    } else {
      // Linked worktree — parse gitdir pointer
      const content = fs.readFileSync(dotGitPath, 'utf8').trim();
      if (!content.startsWith('gitdir: ')) return 'UNKNOWN';
      gitDir = path.resolve(dir, content.slice('gitdir: '.length).trim());
    }

    const headPath = path.join(gitDir, 'HEAD');
    if (!fs.existsSync(headPath)) return 'UNKNOWN';
    const head = fs.readFileSync(headPath, 'utf8').trim();

    // Detached HEAD: HEAD contains the SHA directly
    if (/^[0-9a-f]{40}$/.test(head)) return head;

    // Symbolic ref: e.g. "ref: refs/heads/main"
    if (head.startsWith('ref: ')) {
      const refPath = path.join(gitDir, head.slice('ref: '.length).trim());
      if (fs.existsSync(refPath)) {
        const sha = fs.readFileSync(refPath, 'utf8').trim();
        if (/^[0-9a-f]{40}$/.test(sha)) return sha;
      }
    }

    return 'UNKNOWN';
  } catch {
    return 'UNKNOWN';
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const prisma = new PrismaClient();

try {
  const asOf = new Date();
  const gitRevision = resolveGitRevision();

  // Resolve canonical brand ID
  const canonicalBrand = await prisma.brand.findUnique({
    where: { domain: CANONICAL_TENANT_DOMAIN },
    select: { id: true },
  });

  if (!canonicalBrand) {
    process.stderr.write(
      `[sitemind-audit] WARN: No brand found with domain="${CANONICAL_TENANT_DOMAIN}". Using empty brandId — counts will be zero.\n`,
    );
  }

  const brandId = canonicalBrand?.id ?? '';

  const counts = brandId
    ? await collectSitemindCounts(prisma, { brandId, asOf })
    : {
        retailersTotal: 0,
        retailersVerifiedCurrent: 0,
        retailersStale: 0,
        retailersAwaiting: 0,
        retailersDemo: 0,
        menuEntriesTotal: 0,
        menuEntriesVerifiedCurrent: 0,
        dealsActive: 0,
        dealsExpiringSoon: 0,
        dealsExpiredStillActiveFlag: 0,
        articlesTotal: 0,
        articlesVerifiedCurrent: 0,
        articlesStaleFreshness: 0,
        retailersMissingPhone: 0,
        retailersMissingWebsite: 0,
        sitemapEligibleRetailers: 0,
        neighborhoodPagesConfigured: NEIGHBORHOOD_SLUGS.length,
        strainGuidesConfigured: STRAIN_SLUGS.length,
        legalFaqCount: LEGAL_FAQ_COUNT,
      };

  const receipt = buildSitemindReceipt({ counts, asOf, gitRevision });

  process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');

  if (minScore !== null && receipt.score < minScore) {
    process.stderr.write(
      `[sitemind-audit] FAIL: score ${receipt.score} is below required minimum ${minScore}.\n`,
    );
    process.exitCode = 1;
  }
} catch (err) {
  process.stderr.write(`[sitemind-audit] ERROR: ${err.message}\n`);
  if (err.stack) process.stderr.write(err.stack + '\n');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
