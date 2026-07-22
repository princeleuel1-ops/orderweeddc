import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildTenantTheme,
  DEFAULT_TENANT_THEME,
} from '../src/lib/tenant-theme.mjs';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(testDirectory, '..');

test('tenant theme accepts exact six-digit hexadecimal colors', () => {
  assert.deepEqual(
    buildTenantTheme({
      themePrimary: '#abcdef',
      themeSecondary: '#123456',
      themeBg: '#000000',
      themeSurface: '#A1B2C3',
      themeText: '#ffffff',
    }),
    {
      primary: '#abcdef',
      secondary: '#123456',
      background: '#000000',
      surface: '#A1B2C3',
      text: '#ffffff',
    },
  );
});

test('tenant theme rejects CSS and markup injection values', () => {
  const hostileValues = [
    'red',
    '#fff',
    '#00000000',
    'var(--attacker)',
    'url(https://attacker.example)',
    '</style><script>alert(1)</script>',
    '#000000;display:none',
    null,
  ];

  for (const hostileValue of hostileValues) {
    assert.deepEqual(
      buildTenantTheme({
        themePrimary: hostileValue,
        themeSecondary: hostileValue,
        themeBg: hostileValue,
        themeSurface: hostileValue,
        themeText: hostileValue,
      }),
      DEFAULT_TENANT_THEME,
    );
  }
});

test('tenant layout uses the escaped React style boundary', () => {
  const layoutSource = fs.readFileSync(
    path.join(webRoot, 'src/app/[domain]/layout.tsx'),
    'utf8',
  );

  assert.match(layoutSource, /buildTenantTheme\(brand\)/);
  assert.match(layoutSource, /style=\{themeStyle\}/);
  assert.doesNotMatch(layoutSource, /dangerouslySetInnerHTML/);
});
