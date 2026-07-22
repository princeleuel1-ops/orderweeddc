import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🧪 RUNNING LAB VERIFICATION SUITE: SECURITY, ACCESSIBILITY, AND PERFORMANCE...\n');

// 1. SECURITY AUDIT
function runSecurityChecks() {
  console.log('🛡️  1. Running Security Audit...');
  let failed = false;
  
  const filesToScan = [];
  function recScan(dir) {
    if (dir.includes('node_modules') || dir.includes('.next') || dir.includes('.git')) return;
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const full = path.join(dir, file);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        recScan(full);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.json')) {
        filesToScan.push(full);
      }
    }
  }
  
  recScan(path.resolve(__dirname, '../src'));
  
  // Search for any sk- openrouter key exposure patterns in code files
  const keyPattern = /sk-or-v1-[a-fA-F0-9]{64}/;
  
  for (const f of filesToScan) {
    const content = fs.readFileSync(f, 'utf8');
    if (keyPattern.test(content)) {
      console.error(`❌ SECURITY WARNING: Plaintext openrouter key exposure found in code file: ${f}`);
      failed = true;
    }
  }
  
  if (!failed) {
    console.log('✅ PASS: No plaintext API secrets found in tracking code paths.');
  }
  return !failed;
}

// 2. ACCESSIBILITY (a11y) CHECK
function runAccessibilityChecks() {
  console.log('\n♿ 2. Running Accessibility (a11y) Check...');
  let failed = false;
  
  // Verify main layout lang attribute and semantic elements
  const layoutPath = path.resolve(__dirname, '../src/app/layout.tsx');
  const tenantLayoutPath = path.resolve(__dirname, '../src/app/[domain]/layout.tsx');
  
  if (fs.existsSync(layoutPath)) {
    const layout = fs.readFileSync(layoutPath, 'utf8');
    if (!layout.includes('lang="en"')) {
      console.error('❌ a11y FAIL: layout.tsx is missing lang="en" declaration.');
      failed = true;
    } else {
      console.log('✅ PASS: lang="en" exists on RootLayout html tag.');
    }
  }

  if (fs.existsSync(tenantLayoutPath)) {
    const tLayout = fs.readFileSync(tenantLayoutPath, 'utf8');
    const hasHeader = tLayout.includes('<header') && tLayout.includes('</header>');
    const hasMain = tLayout.includes('<main') && tLayout.includes('</main>');
    const hasFooter = tLayout.includes('<footer') && tLayout.includes('</footer>');
    
    if (hasHeader && hasMain && hasFooter) {
      console.log('✅ PASS: TenantLayout layout uses semantic <header>, <main>, and <footer> tags.');
    } else {
      console.error('❌ a11y FAIL: TenantLayout missing semantic layouts elements.');
      failed = true;
    }
  }
  
  return !failed;
}

// Helper to make HTTP request with custom Host header
function requestTarget(urlPath, hostHeader) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: urlPath,
      method: 'GET',
      headers: {
        'Host': hostHeader
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        const latency = Date.now() - start;
        resolve({
          statusCode: res.statusCode,
          latency
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

// 3. PERFORMANCE LABORATORY TARGETS CHECK
async function runPerformanceChecks() {
  console.log('\n⚡ 3. Running Performance Laboratory Targets...');
  
  const targets = [
    { path: '/api/health', host: 'orderweeddc.localhost:3000' },
    { path: '/', host: 'orderweeddc.localhost:3000' },
    { path: '/products', host: 'orderweeddc.localhost:3000' },
    { path: '/neighborhoods/georgetown', host: 'orderweeddc.localhost:3000' }
  ];

  console.log('Warming up Next.js compile cache (Round 1)...');
  for (const target of targets) {
    try { await requestTarget(target.path, target.host); } catch {}
  }
  await new Promise(r => setTimeout(r, 1000));
  
  console.log('Warming up Next.js compile cache (Round 2)...');
  for (const target of targets) {
    try { await requestTarget(target.path, target.host); } catch {}
  }
  await new Promise(r => setTimeout(r, 1000));

  let passed = true;

  for (const target of targets) {
    try {
      const res = await requestTarget(target.path, target.host);
      
      console.log(`- Request to ${target.path} [Host: ${target.host}] returned Status ${res.statusCode} in ${res.latency}ms`);
      
      if (res.statusCode !== 200) {
        console.error(`❌ HTTP Error: Expected Status 200, got ${res.statusCode}`);
        passed = false;
      }
      
      if (res.latency > 2000) {
        console.warn(`⚠️  WARNING: Latency of ${res.latency}ms is higher than target limit of 2000ms.`);
        passed = false;
      }
    } catch (err) {
      console.error(`❌ Request failed: ${err.message}`);
      passed = false;
    }
  }

  if (passed) {
    console.log('✅ PASS: All HTTP requests resolved under the 2000ms development target.');
  } else {
    console.log('⚠️  NOTICE: Some requests failed or exceeded the 2000ms development target.');
  }

  return passed;
}

async function runAll() {
  const security = runSecurityChecks();
  const a11y = runAccessibilityChecks();
  const perf = await runPerformanceChecks();
  
  console.log('\n--- LAB SUITE SUMMARY ---');
  if (security && a11y && perf) {
    console.log('🎉 ALL INTEGRATION ASSURANCES VERIFIED!');
    process.exit(0);
  } else {
    console.error('❌ SOME CHECKS FAILED COMPLIANCE ASSURANCES.');
    process.exit(1);
  }
}

runAll();
