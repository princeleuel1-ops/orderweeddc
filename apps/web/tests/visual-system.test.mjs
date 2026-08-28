import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(testDirectory, '..');
const artRoot = path.join(webRoot, 'public/art');
const sdkPath = path.join(webRoot, 'src/lib/visual-system/index.ts');
const registryPath = path.join(webRoot, 'src/lib/visual-system/registry.json');

test('Visual System SDK and canonical registry exist with complete 24-slot coverage', () => {
  assert.ok(fs.existsSync(sdkPath), 'index.ts must exist');
  assert.ok(fs.existsSync(registryPath), 'registry.json must exist');
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  assert.equal(Object.keys(registry.slots).length, 24);
  assert.ok(registry.slots['visual://customer.home.hero.primary']);
  assert.ok(registry.slots['visual://customer.deals.hero']);
  assert.ok(registry.slots['visual://customer.strains.hero']);
  assert.ok(registry.slots['visual://customer.compare.terpenes']);
  assert.ok(registry.slots['visual://merchant.dashboard.hero']);
  assert.ok(registry.slots['visual://owner.command.hero']);
});

test('All 24 referenced fallback webp assets exist physically on disk in public/art/', () => {
  const requiredFallbacks = [
    'hero_monument_flower.webp',
    'bento_curated_flight.webp',
    'home_editorial_spotlight.webp',
    'products_catalog_hero.webp',
    'product_sku_tile_fallback.webp',
    'deals_hero_banner.webp',
    'strains_directory_hero.webp',
    'strain_type_hero_fallback.webp',
    'compare_terpenes.webp',
    'dc_neighborhoods_hero.webp',
    'neighborhood_detail_fallback.webp',
    'retailer_profile_fallback.webp',
    'retailer_map_fallback.webp',
    'education_portal_hero.webp',
    'education_article_fallback.webp',
    'customer_wallet_fallback.webp',
    'pricing_page_fallback.webp',
    'help_center_fallback.webp',
    'legal_compliance_fallback.webp',
    'merchant_dashboard_fallback.webp',
    'merchant_claim_fallback.webp',
    'campaign_creator_fallback.webp',
    'admin_command_fallback.webp',
    'admin_intelligence_fallback.webp'
  ];

  for (const file of requiredFallbacks) {
    const filePath = path.join(artRoot, file);
    assert.ok(fs.existsSync(filePath), `Asset ${file} must exist in public/art/`);
    const stat = fs.statSync(filePath);
    assert.ok(stat.size > 1000, `Asset ${file} must be non-empty (>1KB)`);
  }
});

test('VisualHero component is cleanly exported and contains required slot bindings', () => {
  const compPath = path.join(webRoot, 'src/components/visual-hero.tsx');
  assert.ok(fs.existsSync(compPath), 'visual-hero.tsx must exist');
  const compContent = fs.readFileSync(compPath, 'utf8');
  assert.ok(compContent.includes('export function VisualHero'));
  assert.ok(compContent.includes('VisualSystemClient.resolveSlot'));
  assert.ok(compContent.includes('next/image'));
});
