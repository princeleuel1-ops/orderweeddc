/**
 * Builds the Namecheap/cPanel deployment artifact OFF-SERVER.
 *
 * Shared hosting must never run `npm install` or `next build` (memory
 * limits kill both). This script produces a self-contained artifact:
 *
 *   dist/namecheap/orderweeddc-<shortsha>/
 *     app.js              Passenger startup file
 *     server.js           Next standalone server
 *     .next/              standalone runtime + static assets
 *     node_modules/       pruned runtime deps (from standalone tracing)
 *     public/             static assets incl. restored fonts/art
 *     prisma/             schema (for reference; client is pre-generated)
 *     scripts/            init-production-db.mjs + seed-abca-retailers.mjs
 *     docs/competitive/dc-merchant-universe.json   (seed input)
 *     receipt.json        git sha, build time, verification manifest
 *   dist/namecheap/orderweeddc-<shortsha>.zip
 *
 * Run from the repo root:  node deploy/namecheap/build-artifact.mjs
 */
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const webRoot = path.join(repoRoot, 'apps/web');

function run(command, options = {}) {
  console.log(`\n$ ${command}`);
  execSync(command, { stdio: 'inherit', ...options });
}

function assertExists(target, label) {
  if (!fs.existsSync(target)) {
    throw new Error(`Artifact verification failed: missing ${label} (${target})`);
  }
}

function copyDir(from, to) {
  fs.cpSync(from, to, { recursive: true });
}

const gitSha = execSync('git rev-parse HEAD', { cwd: repoRoot }).toString().trim();
const shortSha = gitSha.slice(0, 7);
const artifactName = `orderweeddc-${shortSha}`;
const distRoot = path.join(repoRoot, 'dist/namecheap');
const artifactRoot = path.join(distRoot, artifactName);

// 0. Clean slate for this artifact id.
fs.rmSync(artifactRoot, { recursive: true, force: true });
fs.mkdirSync(artifactRoot, { recursive: true });

// 1. Restore binary brand assets (fonts, icons, artwork) — they live in
//    git as base64 and must exist before the build.
run('node scripts/restore-brand-assets.mjs', { cwd: webRoot });

// 2. Generate the Prisma client with RHEL engines for CloudLinux.
run('npx prisma generate', { cwd: webRoot });

// 3. Standalone production build.
run('npx next build', {
  cwd: webRoot,
  env: { ...process.env, NEXT_OUTPUT: 'standalone', NODE_ENV: 'production' },
});

// 4. Assemble. Next writes standalone output for the workspace layout:
//    .next/standalone/<monorepo>/apps/web/server.js
const standaloneRoot = path.join(webRoot, '.next/standalone');
assertExists(standaloneRoot, 'standalone output');
const nestedWeb = path.join(standaloneRoot, 'apps/web');
const serverDir = fs.existsSync(path.join(nestedWeb, 'server.js'))
  ? nestedWeb
  : standaloneRoot;
assertExists(path.join(serverDir, 'server.js'), 'standalone server.js');

copyDir(serverDir, artifactRoot);
// Root-level node_modules from workspace hoisting (present when Next
// nests the app dir inside the standalone output).
const hoistedModules = path.join(standaloneRoot, 'node_modules');
if (serverDir !== standaloneRoot && fs.existsSync(hoistedModules)) {
  copyDir(hoistedModules, path.join(artifactRoot, 'node_modules'));
}

// Static chunks and public assets are NOT included in standalone tracing.
copyDir(path.join(webRoot, '.next/static'), path.join(artifactRoot, '.next/static'));
copyDir(path.join(webRoot, 'public'), path.join(artifactRoot, 'public'));

// Passenger startup file.
fs.copyFileSync(
  path.join(repoRoot, 'deploy/namecheap/app.js'),
  path.join(artifactRoot, 'app.js'),
);

// Database bootstrap tooling + schema + seed input for first-run setup.
fs.mkdirSync(path.join(artifactRoot, 'scripts'), { recursive: true });
for (const script of [
  'scripts/init-production-db.mjs',
  'scripts/seed-abca-retailers.mjs',
  'scripts/restore-brand-assets.mjs',
  'scripts/brand-assets.b64.json',
]) {
  fs.copyFileSync(path.join(webRoot, script), path.join(artifactRoot, script));
}
fs.mkdirSync(path.join(artifactRoot, 'prisma'), { recursive: true });
fs.copyFileSync(
  path.join(webRoot, 'prisma/schema.prisma'),
  path.join(artifactRoot, 'prisma/schema.prisma'),
);
fs.mkdirSync(path.join(artifactRoot, 'docs/competitive'), { recursive: true });
fs.copyFileSync(
  path.join(repoRoot, 'docs/competitive/dc-merchant-universe.json'),
  path.join(artifactRoot, 'docs/competitive/dc-merchant-universe.json'),
);

// 4b. Server-fit pruning (probe-evidence driven). The cPanel probe on
//     business194.web-hosting.com (2026-07-23) reported OpenSSL 1.1.1k on
//     glibc, so the rhel-openssl-3.0.x Prisma engine and the musl sharp
//     binaries are dead bytes on that host. Opt-in via SERVER_OPENSSL=1.1
//     so default builds keep every engine.
const pruned = [];
if (process.env.SERVER_OPENSSL === '1.1') {
  const pruneTargets = [
    'node_modules/.prisma/client/libquery_engine-rhel-openssl-3.0.x.so.node',
    'node_modules/@img/sharp-libvips-linuxmusl-x64',
    'node_modules/@img/sharp-linuxmusl-x64',
  ];
  for (const target of pruneTargets) {
    const full = path.join(artifactRoot, target);
    if (fs.existsSync(full)) {
      fs.rmSync(full, { recursive: true, force: true });
      pruned.push(target);
    }
  }
}

// 5. Verify the artifact before packaging. Every check is a hard stop.
const checks = {};
checks['server.js present'] = fs.existsSync(path.join(artifactRoot, 'server.js'));
checks['app.js present'] = fs.existsSync(path.join(artifactRoot, 'app.js'));
checks['.next/static present'] = fs.existsSync(path.join(artifactRoot, '.next/static'));
checks['fonts restored'] = fs.existsSync(
  path.join(artifactRoot, 'public/fonts/inter-var-latin.woff2'),
);
checks['artwork restored'] = fs.existsSync(
  path.join(artifactRoot, 'public/art/hero-dc.jpg'),
);
const prismaClientDir = path.join(artifactRoot, 'node_modules/.prisma/client');
const engineFiles = fs.existsSync(prismaClientDir)
  ? fs.readdirSync(prismaClientDir).filter((file) => file.includes('engine'))
  : [];
checks['prisma rhel engine bundled'] = engineFiles.some((file) =>
  file.includes('rhel'),
);
checks['prisma engines found'] = engineFiles.length > 0;
if (process.env.SERVER_OPENSSL === '1.1') {
  checks['rhel-openssl-1.1.x engine present (probe: OpenSSL 1.1.1k)'] =
    engineFiles.some((file) => file.includes('rhel-openssl-1.1.x'));
}

const failed = Object.entries(checks).filter(([, ok]) => !ok);
console.log('\nArtifact verification:');
for (const [name, ok] of Object.entries(checks)) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
}
if (failed.length > 0) {
  throw new Error(
    `Artifact verification failed: ${failed.map(([name]) => name).join(', ')}`,
  );
}

// 6. Receipt: the deployment's identity document.
const receipt = {
  artifact: artifactName,
  gitSha,
  builtAt: new Date().toISOString(),
  nodeVersion: process.version,
  nextOutput: 'standalone',
  prismaEngines: engineFiles,
  serverFitPruned: pruned,
  checks,
};
fs.writeFileSync(
  path.join(artifactRoot, 'receipt.json'),
  JSON.stringify(receipt, null, 2),
);

// 7. Package as tar.gz (available on every Linux box on both sides;
//    cPanel File Manager and Terminal both extract it).
run(
  `tar -czf ${JSON.stringify(`${artifactName}.tar.gz`)} -C ${JSON.stringify(distRoot)} ${JSON.stringify(artifactName)}`,
  { cwd: distRoot },
);
const tarPath = path.join(distRoot, `${artifactName}.tar.gz`);
const tarSha256 = createHash('sha256')
  .update(fs.readFileSync(tarPath))
  .digest('hex');
fs.writeFileSync(
  path.join(distRoot, `${artifactName}.tar.gz.sha256`),
  `${tarSha256}  ${artifactName}.tar.gz\n`,
);

console.log(`\nArtifact ready: ${tarPath}`);
console.log(`sha256: ${tarSha256}`);
console.log(`Receipt: ${path.join(artifactRoot, 'receipt.json')}`);
