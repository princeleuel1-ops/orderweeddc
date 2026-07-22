async function run() {
  const [
    { default: assert },
    { default: fs },
    { default: path },
    { isPubliclyVerified },
    { tenantRetailerWhere },
    { validateClaimSubmission },
    { executeParallelPrompts },
  ] = await Promise.all([
    import('node:assert/strict'),
    import('node:fs'),
    import('node:path'),
    import('../src/lib/data-status.mjs'),
    import('../src/lib/tenant-retailer.mjs'),
    import('../src/lib/submission-validation.mjs'),
    import('../../../packages/ai/src/gateway.mjs'),
  ]);

  const now = new Date('2026-07-17T20:00:00.000Z');
  assert.equal(
    isPubliclyVerified({
      isDemonstration: true,
      dataStatus: 'VERIFIED_CURRENT',
      verifiedAt: now,
      freshnessExpiresAt: new Date('2026-07-18T20:00:00.000Z'),
    }, now),
    false,
  );
  assert.equal(
    isPubliclyVerified({
      isDemonstration: false,
      dataStatus: 'VERIFIED_CURRENT',
      verifiedAt: now,
      freshnessExpiresAt: new Date('2026-07-18T20:00:00.000Z'),
    }, now),
    true,
  );

  assert.deepEqual(tenantRetailerWhere('brand-one', 'retailer-one', now), {
    id: 'retailer-one',
    OR: [
      { isDemonstration: true },
      {
        isDemonstration: false,
        verifiedAt: { not: null, lte: now },
      },
    ],
    menus: {
      some: {
        brandMenus: {
          some: { brandId: 'brand-one' },
        },
      },
    },
  });

  assert.throws(
    () =>
      validateClaimSubmission({
        name: 'Example Retailer',
        address: '100 Example Avenue NW',
        email: 'owner@example.com',
        phone: '202-555-0100',
        licenseNumber: 'ABCA-1234',
        evidenceUrl: 'http://localhost/private.pdf',
      }),
    /public HTTPS URL/,
  );

  const firstReceipt = await executeParallelPrompts(['same bounded check']);
  const secondReceipt = await executeParallelPrompts(['same bounded check']);
  assert.deepEqual(firstReceipt, secondReceipt);
  const parsedReceipt = JSON.parse(firstReceipt[0]);
  assert.equal(parsedReceipt.mode, 'LOCAL_DETERMINISTIC');
  assert.equal(parsedReceipt.externalModelExecution, false);
  assert.equal(parsedReceipt.externallyVerified, false);

  const healthSource = fs.readFileSync(
    path.join(__dirname, '../src/app/api/health/route.ts'),
    'utf8',
  );
  assert.match(healthSource, /status: 'DIRECT_LOCAL'/);
  assert.doesNotMatch(
    healthSource,
    /OPENROUTER_API_KEY|getKeyFingerprintSuffix|resolveLaneKey|api\.openrouter\.ai/i,
  );

  console.log(
    JSON.stringify(
      {
        status: 'PASS',
        checks: {
          demonstrationTruthOverride: 'PASS',
          tenantRetailerBoundary: 'PASS',
          publicEvidenceValidation: 'PASS',
          deterministicLocalReceipt: 'PASS',
          providerFreeHealthRuntime: 'PASS',
        },
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
