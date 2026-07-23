/**
 * Read-only database inspector. Prints a compact JSON receipt and never
 * mutates anything. Used by bootstrap-production-db.sh to decide, with
 * evidence, whether a database is schema-empty, healthy, or unknown.
 *
 * Usage:
 *   DATABASE_URL=file:/path/prod.db node scripts/db-inspect.mjs
 *   ... --assert-core   exit 2 unless Organization+Brand tables exist
 *
 * Exit codes: 0 ok · 2 core tables missing (with --assert-core)
 */
import { PrismaClient } from '@prisma/client';

const assertCore = process.argv.includes('--assert-core');

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }
  const prisma = new PrismaClient();
  const receipt = { databaseUrl: process.env.DATABASE_URL.replace(/^file:/, 'file:…/') };
  try {
    const tables = await prisma.$queryRawUnsafe(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%' ORDER BY name",
    );
    receipt.tableCount = tables.length;
    receipt.tables = tables.map((row) => row.name);
    const coreTablesPresent =
      receipt.tables.includes('Organization') && receipt.tables.includes('Brand');
    receipt.coreTablesPresent = coreTablesPresent;

    if (coreTablesPresent) {
      const [organizations, brands, canonicalBrands] = await Promise.all([
        prisma.organization.count(),
        prisma.brand.count(),
        prisma.brand.count({ where: { domain: 'orderweeddc.localhost' } }),
      ]);
      receipt.counts = { organizations, brands, canonicalBrands };
      if (receipt.tables.includes('Retailer')) {
        const [retailers, demoRetailers, awaiting] = await Promise.all([
          prisma.retailer.count(),
          prisma.retailer.count({ where: { isDemonstration: true } }),
          prisma.retailer.count({
            where: { dataStatus: 'AWAITING_VERIFICATION', isDemonstration: false },
          }),
        ]);
        receipt.counts.retailers = retailers;
        receipt.counts.demonstrationRetailers = demoRetailers;
        receipt.counts.awaitingVerification = awaiting;
      }
    }
    console.log(JSON.stringify(receipt));
    if (assertCore && !coreTablesPresent) process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
