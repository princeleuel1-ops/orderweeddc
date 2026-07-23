#!/usr/bin/env node
/**
 * Competitive loop harness — UI lane.
 *
 * Captures deterministic screenshots of this site's key public pages so a
 * reviewer (human or agent) can score them side-by-side against competitor
 * captures using the rubric in docs/COMPETITIVE_LOOP.md, then fix the
 * weakest areas and re-run. The marketing lane runs separately via
 * `node scripts/sitemind-audit.mjs` (deterministic, no browser needed).
 *
 * Requirements: a production server running locally (npm run start) and
 * playwright installed in a reachable node_modules (dev-only dependency —
 * this script is NOT part of the release gates and never runs in CI).
 *
 * Usage:
 *   node scripts/competitive-loop.mjs [--base=http://orderweeddc.localhost:3000] [--out=loop-shots]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const argument = (name, fallback) => {
  const found = process.argv.find((value) => value.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};

const BASE = argument('base', 'http://orderweeddc.localhost:3000');
const OUT = path.resolve(argument('out', 'loop-shots'));

const PAGES = [
  ['home', '/', false],
  ['home-full', '/', true],
  ['products', '/products', false],
  ['deals', '/deals', false],
  ['education', '/education', false],
  ['neighborhoods', '/neighborhoods', false],
  ['strains', '/strains', false],
  ['legal', '/legal', true],
];

async function main() {
  let chromium;
  try {
    const require = createRequire(import.meta.url);
    ({ chromium } = require('playwright'));
  } catch {
    console.error(
      'playwright is not installed. Run `npm install --no-save playwright && npx playwright install chromium --only-shell` first (dev machines only).',
    );
    process.exit(2);
  }

  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const results = [];

  for (const [viewportName, viewport, scale] of [
    ['desktop', { width: 1440, height: 960 }, 1.5],
    ['mobile', { width: 390, height: 844 }, 2],
  ]) {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: scale,
    });
    // The age gate must not block automated review runs.
    await context.addInitScript(() => {
      try {
        localStorage.setItem('owd:age-attested-at', String(Date.now()));
      } catch {
        // Storage unavailable — the gate will show; captures still succeed.
      }
    });
    const page = await context.newPage();
    const pages = viewportName === 'mobile' ? PAGES.slice(0, 3) : PAGES;
    for (const [name, route, fullPage] of pages) {
      const file = path.join(OUT, `${viewportName}-${name}.png`);
      try {
        await page.goto(BASE + route, {
          waitUntil: 'networkidle',
          timeout: 30_000,
        });
        await page.waitForTimeout(1000);
        await page.screenshot({ path: file, fullPage });
        results.push({ viewport: viewportName, name, route, file, ok: true });
        console.log('captured', viewportName, name);
      } catch (error) {
        results.push({
          viewport: viewportName,
          name,
          route,
          ok: false,
          error: error.message.split('\n')[0],
        });
        console.error('failed', viewportName, name, error.message.split('\n')[0]);
      }
    }
    await context.close();
  }
  await browser.close();

  const receipt = {
    schemaVersion: '1.0.0',
    module: 'COMPETITIVE_LOOP_UI_CAPTURE',
    base: BASE,
    generatedAt: new Date().toISOString(),
    captures: results,
    nextSteps: [
      'Score each capture against docs/COMPETITIVE_LOOP.md rubric (1-5 per axis).',
      'Compare against competitor captures (see competitors/ archive or re-run recon).',
      'Fix the two lowest-scoring axes, rebuild, and re-run this script.',
      'Run node scripts/sitemind-audit.mjs for the marketing lane score.',
    ],
  };
  fs.writeFileSync(
    path.join(OUT, 'capture-receipt.json'),
    JSON.stringify(receipt, null, 2),
  );
  console.log(`\nreceipt: ${path.join(OUT, 'capture-receipt.json')}`);
  process.exitCode = results.every((result) => result.ok) ? 0 : 1;
}

main();
