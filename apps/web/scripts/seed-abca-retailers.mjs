// Production data pipeline: ingest the official DC GIS/ABCA retailer universe
// (docs/competitive/dc-merchant-universe.json) as REAL records with honest
// truth labels: isDemonstration=false, dataStatus=AWAITING_VERIFICATION.
// Records earn VERIFIED_CURRENT only through admin review with evidence.
//
// This script NEVER touches demonstration data and is idempotent (upserts by
// name+address). Run against the production DATABASE_URL:
//   node scripts/seed-abca-retailers.mjs [--universe=path.json] [--dry-run]
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(webRoot, '..', '..');

const argument = (name, fallback) => {
  const found = process.argv.find((value) => value.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};
const DRY_RUN = process.argv.includes('--dry-run');
const universePath = argument(
  'universe',
  path.join(repoRoot, 'docs', 'competitive', 'dc-merchant-universe.json'),
);

const prisma = new PrismaClient();

function normalized(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function main() {
  const raw = JSON.parse(fs.readFileSync(universePath, 'utf8'));
  const rows = Array.isArray(raw) ? raw : raw.retailers ?? raw.records ?? [];
  const vintage = (Array.isArray(raw) ? null : raw.meta?.vintage) ?? 'unknown';
  const retailers = rows.filter((row) => {
    const type = normalized(row.licenseType || row.license_type || row.type).toLowerCase();
    return type.includes('retail') || type.includes('internet') || type === '';
  });
  console.log(`universe: ${rows.length} entities, ${retailers.length} retail candidates (vintage: ${vintage})`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  for (const row of retailers) {
    const name =
      normalized(row.trade_name) || normalized(row.tradeName) || normalized(row.name);
    const address = normalized(row.address || row.fullAddress || row.full_address);
    if (!name || !address) {
      skipped += 1;
      continue;
    }
    const lat = Number(row.lat ?? row.latitude);
    const lng = Number(row.lng ?? row.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      skipped += 1;
      continue;
    }
    const licenseTypeRaw = normalized(row.licenseType || row.license_type || row.type).toLowerCase();
    const endorsements = Array.isArray(row.endorsements) ? row.endorsements.map((value) => String(value).toLowerCase()) : [];
    const type = licenseTypeRaw.includes('internet')
      ? 'delivery'
      : endorsements.includes('delivery') && !licenseTypeRaw.includes('retail')
        ? 'delivery'
        : 'storefront';
    const data = {
      name,
      address,
      city: 'Washington',
      state: 'DC',
      zip: normalized(row.zip || row.zipcode) || null,
      lat,
      lng,
      type,
      website: normalized(row.website) || null,
      phone: normalized(row.phone) || null,
      licenseNumber:
        normalized(row.abca_number) ||
        normalized(row.licenseNumber || row.license_number) ||
        undefined,
      licenseStatus: 'PENDING',
      licenseSource: 'DC ABCA Registry (DC GIS open data)',
      dataStatus: 'AWAITING_VERIFICATION',
      dataSource: `DC GIS/ABCA registry export (vintage ${vintage})`,
      isDemonstration: false,
      retrievedAt: new Date(),
    };
    const existing = await prisma.retailer.findFirst({
      where: { name, address, isDemonstration: false },
      select: { id: true },
    });
    if (DRY_RUN) {
      console.log(`${existing ? 'would update' : 'would create'}: ${name}`);
      continue;
    }
    if (existing) {
      await prisma.retailer.update({ where: { id: existing.id }, data });
      updated += 1;
    } else {
      await prisma.retailer.create({ data });
      created += 1;
    }
  }
  console.log(JSON.stringify({ created, updated, skipped, dryRun: DRY_RUN }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
