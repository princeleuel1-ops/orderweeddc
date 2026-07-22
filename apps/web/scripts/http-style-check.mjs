import assert from 'node:assert/strict';
import http from 'node:http';

const host = process.env.CANA_HTTP_HOST || 'orderweeddc.localhost:3000';
const port = Number(process.env.CANA_HTTP_PORT || '3000');

function request(pathname) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port,
        path: pathname,
        headers: { Host: host },
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          resolve({
            statusCode: response.statusCode,
            contentType: response.headers['content-type'] || '',
            body,
          });
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

const page = await request('/admin/login');
assert.equal(page.statusCode, 200);
const stylesheet = page.body.match(
  /<link rel="stylesheet" href="([^"]+\.css)"/,
);
assert.ok(stylesheet, 'The production page did not link a compiled stylesheet.');

const css = await request(stylesheet[1]);
assert.equal(css.statusCode, 200);
assert.match(css.contentType, /^text\/css\b/);
assert.ok(
  Buffer.byteLength(css.body) >= 20_000,
  'The compiled stylesheet is unexpectedly small.',
);
for (const requiredUtility of [
  /\.grid\{display:grid\}/,
  /\.flex\{display:flex\}/,
  /\.bg-brand-surface(?:,|\{)/,
  /\.text-brand-primary/,
  /\.sm\\:grid-cols-2\{/,
]) {
  assert.match(css.body, requiredUtility);
}
assert.doesNotMatch(css.body, /@tailwind\s+(?:base|components|utilities)/);

console.log(
  JSON.stringify(
    {
      status: 'PASS',
      checks: {
        productionStylesheetLinked: 'PASS',
        tailwindUtilitiesCompiled: 'PASS',
        dynamicBrandUtilitiesCompiled: 'PASS',
        responsiveUtilitiesCompiled: 'PASS',
      },
      stylesheetBytes: Buffer.byteLength(css.body),
    },
    null,
    2,
  ),
);
