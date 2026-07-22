import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(testDirectory, '..');
const sourceRoot = path.join(webRoot, 'src');
const MOJIBAKE_PATTERN = /(?:Ã|Â|ðŸ|ï¸|â(?:€|†|€¢))/u;

function sourceFiles(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(entryPath);
      return /\.(?:js|mjs|ts|tsx)$/.test(entry.name) ? [entryPath] : [];
    });
}

test('user-facing source contains no double-encoded text', () => {
  for (const file of sourceFiles(sourceRoot)) {
    assert.doesNotMatch(
      fs.readFileSync(file, 'utf8'),
      MOJIBAKE_PATTERN,
      `Double-encoded text found in ${path.relative(webRoot, file)}`,
    );
  }
});

test('rendered pages do not hard-code local development navigation', () => {
  const appRoot = path.join(sourceRoot, 'app');
  for (const file of sourceFiles(appRoot)) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(
      source,
      /href=["']http:\/\/orderweeddc\.localhost:3000/,
      `Hard-coded local navigation found in ${path.relative(webRoot, file)}`,
    );
  }
});

test('public product surfaces use the orderweeddc identity', () => {
  const publicSources = [
    'app/layout.tsx',
    'app/[domain]/layout.tsx',
    'app/[domain]/page.tsx',
    'app/[domain]/products/page.tsx',
    'app/[domain]/compare/page.tsx',
    'app/admin/layout.tsx',
    'app/admin/site-intelligence/page.tsx',
    'lib/product-brand.ts',
  ].map((relativePath) =>
    fs.readFileSync(path.join(sourceRoot, relativePath), 'utf8'),
  );
  const combined = publicSources.join('\n');

  assert.match(combined, /PUBLIC_PRODUCT_NAME = 'orderweeddc'/);
  assert.match(combined, /orderweeddc Trust Lens/);
  assert.match(combined, /orderweeddc Evidence Explorer/);
  assert.match(combined, /orderweeddc Site Intelligence/);
  assert.doesNotMatch(
    combined,
    /CANA (?:Trust Lens|Evidence Explorer|Site Brain|Administrator)/,
  );
});

test('the unreachable duplicate root mockup has been removed', () => {
  assert.equal(fs.existsSync(path.join(sourceRoot, 'app/page.tsx')), false);
});
