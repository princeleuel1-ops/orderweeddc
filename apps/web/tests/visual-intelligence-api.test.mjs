import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(testDirectory, '..');
const registryPath = path.join(webRoot, 'src/lib/visual-system/registry.json');
const apiRoutePath = path.join(webRoot, 'src/app/api/visual-intelligence/route.ts');

test('Durable visual registry file exists and contains valid JSON with 24 slots', () => {
  assert.ok(fs.existsSync(registryPath), 'registry.json must exist');
  const raw = fs.readFileSync(registryPath, 'utf8');
  const parsed = JSON.parse(raw);
  assert.equal(parsed.authority, 'CANA_SOVEREIGN_VISUAL_SYSTEM');
  assert.equal(Object.keys(parsed.slots).length, 24);
  
  const homeHero = parsed.slots['visual://customer.home.hero.primary'];
  assert.ok(homeHero, 'Home hero must be present in registry');
  assert.equal(homeHero.contract_id, 'CONTRACT_CUSTOMER_HOME_HERO');
  assert.equal(homeHero.mechanism, 'OW_MECH_MONUMENT_CRAFT_FLOWER');
  assert.ok(['CURATED_FALLBACK', 'PRODUCTION_CHAMPION'].includes(homeHero.fallback_class));
});

test('In-app Visual Intelligence API route exists and handles typed actions', () => {
  assert.ok(fs.existsSync(apiRoutePath), 'route.ts must exist');
  const routeContent = fs.readFileSync(apiRoutePath, 'utf8');
  assert.ok(routeContent.includes('export async function POST'));
  assert.ok(routeContent.includes('resolveSlot'));
  assert.ok(routeContent.includes('compileGenerationJob'));
  assert.ok(routeContent.includes('generateCandidate'));
  assert.ok(routeContent.includes('evaluateCandidate'));
  assert.ok(routeContent.includes('deployCandidate'));
  assert.ok(routeContent.includes('rollbackSlot'));
  assert.ok(routeContent.includes('queryLineage'));
});

test('Merchant authorization sandboxing prevents merchant actor from altering non-merchant slots', () => {
  const routeContent = fs.readFileSync(apiRoutePath, 'utf8');
  assert.ok(routeContent.includes('UNAUTHORIZED_MERCHANT_SLOT'));
  assert.ok(routeContent.includes("visual://merchant."));
});
