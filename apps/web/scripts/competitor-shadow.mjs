/**
 * Competitor Shadow Engine — fingerprint the incumbents' public surfaces,
 * diff against the previous snapshot, and emit a triage-ready delta report.
 *
 * The loop this powers (docs/competitive/shadow/SHADOW_LOOP.md): they ship a
 * change -> we detect it within one cycle -> classify ADOPT-BETTER / COUNTER /
 * IGNORE / ESCALATE -> every ADOPT-BETTER lands as a superior implementation
 * with named better-than deltas. They pay to A/B-test ideas on their traffic;
 * we harvest the validated winners.
 *
 * Honesty + legality rails:
 * - Public, robots-permitted surfaces only (robots.txt, llm(s).txt, sitemap
 *   indexes, marketing/business pages, page titles). No scraping walls, no
 *   auth, no personal data, minimal request volume (one GET per surface).
 * - We fingerprint (hash/counts/titles) rather than archive competitor
 *   content; adopted ideas are re-implemented, never copied.
 *
 * Usage:
 *   node scripts/competitor-shadow.mjs                 # snapshot + diff
 *   node scripts/competitor-shadow.mjs --dir <outdir>  # custom snapshot dir
 *
 * Snapshots: docs/competitive/shadow/YYYY-MM-DD.json (repo-committed history).
 * Exit code: 0 always for successful runs (deltas are data, not failures).
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../..');

export const SHADOW_TARGETS = Object.freeze([
  // Leafly
  { competitor: 'leafly', surface: 'robots', url: 'https://www.leafly.com/robots.txt', kind: 'text' },
  { competitor: 'leafly', surface: 'llms-txt', url: 'https://www.leafly.com/llms.txt', kind: 'text' },
  { competitor: 'leafly', surface: 'sitemap-index', url: 'https://www.leafly.com/leafly-sitemaps/sitemap-index.xml', kind: 'sitemap' },
  { competitor: 'leafly', surface: 'business-pitch', url: 'https://success.leafly.com/retail', kind: 'title' },
  { competitor: 'leafly', surface: 'dc-listing-title', url: 'https://www.leafly.com/dispensaries/district-of-columbia/washington', kind: 'title' },
  // Weedmaps
  { competitor: 'weedmaps', surface: 'robots', url: 'https://weedmaps.com/robots.txt', kind: 'text' },
  { competitor: 'weedmaps', surface: 'llm-txt', url: 'https://weedmaps.com/llm.txt', kind: 'text' },
  { competitor: 'weedmaps', surface: 'sitemap-index', url: 'https://weedmaps.com/sitemap.xml.gz', kind: 'sitemap-gz' },
  { competitor: 'weedmaps', surface: 'business-pitch', url: 'https://weedmaps.com/business/', kind: 'title' },
  { competitor: 'weedmaps', surface: 'dc-listing-status', url: 'https://weedmaps.com/dispensaries/in/united-states/district-of-columbia/washington', kind: 'status' },
  // Where's Weed
  { competitor: 'wheresweed', surface: 'robots', url: 'https://wheresweed.com/robots.txt', kind: 'text' },
  { competitor: 'wheresweed', surface: 'sitemap-index', url: 'https://wheresweed.com/sitemap.xml', kind: 'sitemap' },
  { competitor: 'wheresweed', surface: 'dc-hub', url: 'https://wheresweed.com/washington-dc', kind: 'title+jsonld' },
  { competitor: 'wheresweed', surface: 'add-business', url: 'https://wheresweed.com/add-business', kind: 'status' },
  { competitor: 'wheresweed', surface: 'advertising', url: 'https://wheresweed.com/advertising', kind: 'title' },
]);

const UA =
  'Mozilla/5.0 (compatible; orderweeddc-shadow/1.0; competitive parity monitor; contact via orderweeddc.com)';

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function normalizeBody(text) {
  // Strip volatile tokens so hashes represent CONTENT changes, not noise.
  return text
    .replace(/\d{4}-\d{2}-\d{2}T[0-9:.]+Z?/g, 'TS')
    .replace(/cf-ray[^"\s]*/gi, 'CFRAY')
    .replace(/nonce="[^"]*"/g, 'nonce=X')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractTitle(html) {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? match[1].trim().slice(0, 200) : null;
}

export function extractSitemapChildren(xml) {
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  return locs.map((u) => u.replace(/^https?:\/\/[^/]+/, '')).sort();
}

export function extractJsonLdTypes(html) {
  const types = new Set();
  for (const match of html.matchAll(/"@type"\s*:\s*"([A-Za-z]+)"/g)) {
    types.add(match[1]);
  }
  return [...types].sort();
}

async function fingerprintTarget(target, fetchImpl = fetch) {
  const result = {
    competitor: target.competitor,
    surface: target.surface,
    url: target.url,
    kind: target.kind,
  };
  try {
    const response = await fetchImpl(target.url, {
      headers: { 'User-Agent': UA, Accept: '*/*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    });
    result.status = response.status;
    if (target.kind === 'status') return result; // status code IS the fingerprint

    const buffer = Buffer.from(await response.arrayBuffer());
    let text;
    if (target.kind === 'sitemap-gz' || target.url.endsWith('.gz')) {
      const { gunzipSync } = await import('node:zlib');
      try {
        text = gunzipSync(buffer).toString('utf8');
      } catch {
        text = buffer.toString('utf8'); // some servers pre-decompress
      }
    } else {
      text = buffer.toString('utf8');
    }

    if (target.kind === 'text') {
      result.hash = sha256(normalizeBody(text));
      result.bytes = buffer.length;
    } else if (target.kind === 'sitemap' || target.kind === 'sitemap-gz') {
      const children = extractSitemapChildren(text);
      result.childCount = children.length;
      result.childrenHash = sha256(children.join('\n'));
      result.children = children.slice(0, 40);
    } else if (target.kind === 'title') {
      result.title = extractTitle(text);
    } else if (target.kind === 'title+jsonld') {
      result.title = extractTitle(text);
      result.jsonLdTypes = extractJsonLdTypes(text);
    }
  } catch (error) {
    result.status = 'FETCH_ERROR';
    result.error = String(error?.message ?? error).slice(0, 200);
  }
  return result;
}

/** Compare two snapshots; every difference becomes a triage-ready delta. */
export function diffSnapshots(previous, current) {
  const deltas = [];
  const prevByKey = new Map(
    (previous?.results ?? []).map((r) => [`${r.competitor}:${r.surface}`, r]),
  );
  for (const next of current.results) {
    const key = `${next.competitor}:${next.surface}`;
    const prev = prevByKey.get(key);
    if (!prev) {
      deltas.push({ key, change: 'surface-added', after: summarize(next) });
      continue;
    }
    prevByKey.delete(key);
    const fields = ['status', 'hash', 'childCount', 'childrenHash', 'title', 'jsonLdTypes'];
    for (const field of fields) {
      const before = JSON.stringify(prev[field] ?? null);
      const after = JSON.stringify(next[field] ?? null);
      if (before !== after) {
        deltas.push({
          key,
          change: `${field}-changed`,
          before: prev[field] ?? null,
          after: next[field] ?? null,
          triage: 'TRIAGE_REQUIRED', // ADOPT-BETTER | COUNTER | IGNORE | ESCALATE
        });
      }
    }
  }
  for (const [key, prev] of prevByKey) {
    deltas.push({ key, change: 'surface-removed', before: summarize(prev) });
  }
  return deltas;
}

function summarize(result) {
  const { competitor, surface, status, hash, childCount, title } = result;
  return { competitor, surface, status, hash, childCount, title };
}

export function latestSnapshotPath(dir) {
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();
  return files.length ? path.join(dir, files[files.length - 1]) : null;
}

async function main() {
  const dirArg = process.argv.find((a) => a.startsWith('--dir='));
  const outDir = dirArg
    ? path.resolve(dirArg.slice(6))
    : path.join(repoRoot, 'docs/competitive/shadow');
  fs.mkdirSync(outDir, { recursive: true });

  const previousPath = latestSnapshotPath(outDir);
  const previous = previousPath
    ? JSON.parse(fs.readFileSync(previousPath, 'utf8'))
    : null;

  console.error(`shadow: fingerprinting ${SHADOW_TARGETS.length} surfaces…`);
  const results = [];
  for (const target of SHADOW_TARGETS) {
    results.push(await fingerprintTarget(target));
  }
  const snapshot = { takenAt: new Date().toISOString(), results };

  const today = new Date().toISOString().slice(0, 10);
  const outPath = path.join(outDir, `${today}.json`);
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
  console.error(`shadow: snapshot written -> ${outPath}`);

  const deltas =
    previous && previousPath !== outPath ? diffSnapshots(previous, snapshot) : [];
  console.log(
    JSON.stringify(
      {
        snapshot: outPath,
        comparedAgainst: previousPath && previousPath !== outPath ? previousPath : null,
        deltaCount: deltas.length,
        deltas,
      },
      null,
      2,
    ),
  );
}

// Only run the network path when invoked directly (tests import pure fns).
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
