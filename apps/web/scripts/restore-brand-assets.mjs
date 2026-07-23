// One-time helper: writes the binary brand assets (fonts, icons, OG image)
// that GitHub's text-based API commit could not carry. Run once from the
// REPOSITORY ROOT after checking out this branch:
//
//   node apps/web/scripts/restore-brand-assets.mjs
//
// Afterwards you may delete this script and brand-assets.b64.json, or keep
// them for reproducibility. The app runs without these files (system font
// fallbacks apply); they restore the intended premium presentation.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..', '..', '..',
);
const payloadPath = path.join(
  repoRoot, 'apps', 'web', 'scripts', 'brand-assets.b64.json',
);
const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
for (const [relativePath, base64Content] of Object.entries(payload)) {
  const target = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, Buffer.from(base64Content, 'base64'));
  console.log('restored', relativePath);
}
console.log('All brand assets restored.');
