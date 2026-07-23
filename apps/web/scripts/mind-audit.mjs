/**
 * Growing Mind auditor — enforces the integrity of the Mistake Ledger so the
 * mind actually LEARNS instead of merely collecting anecdotes.
 *
 * Doctrine (docs/mind/GROWING_MIND.md): every observed failure — especially
 * someone else's — must convert into (1) a law and (2) a guard, and vicarious
 * lessons must outnumber own-incident lessons. This script is the deterministic
 * check the EVOLVE cycle runs; it is pure and offline (imports = safe).
 *
 * Exit code (when run directly): 0 if the ledger is sound, 1 otherwise.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../..');
const LEDGER_PATH = path.join(repoRoot, 'docs/mind/mistake-ledger.json');

export const VALID_SOURCES = Object.freeze(['competitor', 'industry', 'own']);
export const VALID_GUARD_STATUS = Object.freeze(['SHIPPED', 'DRAFT', 'BACKLOG']);

/**
 * Audit a ledger object. Returns { ok, errors, stats }. Never throws on
 * content problems — it reports them, so the caller decides severity.
 */
export function auditLedger(ledger) {
  const errors = [];
  const entries = Array.isArray(ledger?.entries) ? ledger.entries : null;
  if (!entries) {
    return { ok: false, errors: ['ledger.entries must be an array'], stats: {} };
  }

  const ids = new Set();
  const bySource = { competitor: 0, industry: 0, own: 0 };
  let guardedShipped = 0;

  for (const entry of entries) {
    const label = entry?.id ?? '(missing id)';
    if (!entry?.id) errors.push('entry missing id');
    else if (ids.has(entry.id)) errors.push(`duplicate id ${entry.id}`);
    else ids.add(entry.id);

    if (!VALID_SOURCES.includes(entry?.source)) {
      errors.push(`${label}: source must be one of ${VALID_SOURCES.join('/')}`);
    } else {
      bySource[entry.source] += 1;
    }

    // The core discipline: a mistake with no law or no guard is an unlearned
    // lesson — forbidden.
    for (const field of ['actor', 'mistake', 'evidence', 'law']) {
      if (typeof entry?.[field] !== 'string' || entry[field].trim().length < 4) {
        errors.push(`${label}: ${field} is required and must be substantive`);
      }
    }
    if (!entry?.guard || !VALID_GUARD_STATUS.includes(entry.guard.status)) {
      errors.push(`${label}: guard.status must be ${VALID_GUARD_STATUS.join('/')}`);
    } else if (
      typeof entry.guard.reference !== 'string' ||
      entry.guard.reference.trim().length < 4
    ) {
      errors.push(`${label}: guard.reference must cite where the guard lives`);
    } else if (entry.guard.status === 'SHIPPED') {
      guardedShipped += 1;
    }
  }

  const vicarious = bySource.competitor + bySource.industry;
  const own = bySource.own;

  // The founder's mandate: learn from others' mistakes MORE than our own.
  if (vicarious <= own) {
    errors.push(
      `vicarious lessons (${vicarious}) must outnumber own-incident lessons (${own})`,
    );
  }

  const stats = {
    total: entries.length,
    vicarious,
    own,
    vicariousRatio: entries.length ? +(vicarious / entries.length).toFixed(3) : 0,
    guardedShipped,
    guardedShippedRatio: entries.length
      ? +(guardedShipped / entries.length).toFixed(3)
      : 0,
    bySource,
  };
  return { ok: errors.length === 0, errors, stats };
}

export function loadLedger(ledgerPath = LEDGER_PATH) {
  return JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const result = auditLedger(loadLedger());
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
