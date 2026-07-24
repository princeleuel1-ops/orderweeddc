// Select a Prisma query-engine compatible with the machine RUNNING THE ISOLATION TEST.
//
// The PRODUCTION artifact ships and uses the Linux RHEL OpenSSL 1.1 engine
// (libquery_engine-rhel-openssl-1.1.x.so.node) on Namecheap/CloudLinux — that is
// NEVER changed. But the off-server isolation test may run on Apple Silicon macOS,
// where dlopen() of the Linux .so.node fails ("slice is not valid mach-o file").
// This picks the correct NATIVE engine from the artifact's own generated
// .prisma/client directory for the current platform/arch. Test-only; pure.

const PLATFORM_MATCHERS = {
  'darwin:arm64': (f) => /libquery_engine-darwin-arm64\b.*\.(dylib\.node|node)$/.test(f),
  'darwin:x64': (f) => /libquery_engine-darwin(?!-arm64)\b.*\.(dylib\.node|node)$/.test(f),
  'linux:x64': (f) => /libquery_engine-(rhel|debian|linux-musl)(?!.*arm64).*\.so\.node$/.test(f),
  'linux:arm64': (f) => /libquery_engine-(linux-arm64|linux-musl-arm64|debian-openssl.*arm64).*\.so\.node$/.test(f),
};

/**
 * @param {string[]} engineFiles  filenames found in node_modules/.prisma/client
 * @param {string} platform       process.platform (e.g. 'darwin', 'linux')
 * @param {string} arch           process.arch (e.g. 'arm64', 'x64')
 * @returns {string}              the single compatible engine filename
 * Fails closed (throws) when there is no compatible engine, or when the match is
 * ambiguous (must be exactly one).
 */
export function selectTestPrismaEngine(engineFiles, platform, arch) {
  const key = `${platform}:${arch}`;
  const matcher = PLATFORM_MATCHERS[key];
  if (!matcher) {
    throw new Error(`No Prisma test-engine matcher for platform '${key}'`);
  }
  const matches = [...new Set(engineFiles.filter((f) => f.includes('engine') && matcher(f)))];
  if (matches.length === 0) {
    throw new Error(
      `No bundled Prisma engine compatible with '${key}'. ` +
      `The production artifact intentionally ships the Linux RHEL engine; ` +
      `build on ${platform}/${arch} so a native test engine is generated. ` +
      `Found: ${engineFiles.join(', ') || '(none)'}`,
    );
  }
  if (matches.length > 1) {
    throw new Error(`Ambiguous Prisma test engine for '${key}' (expected exactly one): ${matches.join(', ')}`);
  }
  return matches[0];
}
