import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDirectory, '../../..');
const statusPath = path.join(workspaceRoot, 'CANA_CONTROL_TOWER', 'LOCAL_LOOP_STATUS.json');
const requestedCycles = Number.parseInt(process.env.CANA_LOCAL_LOOP_MAX_CYCLES || '1', 10);
const maxCycles = Math.max(1, Math.min(Number.isFinite(requestedCycles) ? requestedCycles : 1, 10));
const delayMs = Math.max(
  1_000,
  Math.min(Number.parseInt(process.env.CANA_LOCAL_LOOP_DELAY_MS || '15000', 10) || 15_000, 300_000),
);

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const gates = Object.freeze([
  { name: 'tests', command: npmCommand, args: ['test'] },
  { name: 'lint', command: npmCommand, args: ['run', 'lint'] },
  { name: 'typecheck', command: npxCommand, args: ['tsc', '--noEmit', '-p', 'apps/web/tsconfig.json'] },
  { name: 'build', command: npmCommand, args: ['run', 'build'] },
]);

function delay(durationMs) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

async function runGate(gate) {
  const startedAt = new Date();
  try {
    const { stdout, stderr } = await execFileAsync(gate.command, gate.args, {
      cwd: workspaceRoot,
      timeout: 300_000,
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
    });
    return {
      name: gate.name,
      status: 'PASS',
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      command: [gate.command, ...gate.args].join(' '),
      outputTail: `${stdout}\n${stderr}`.trim().split(/\r?\n/).slice(-12),
    };
  } catch (error) {
    return {
      name: gate.name,
      status: 'FAIL',
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      command: [gate.command, ...gate.args].join(' '),
      exitCode: typeof error?.code === 'number' ? error.code : null,
      outputTail: `${error?.stdout || ''}\n${error?.stderr || ''}`.trim().split(/\r?\n/).slice(-20),
    };
  }
}

async function writeStatus(status) {
  await fs.mkdir(path.dirname(statusPath), { recursive: true });
  const temporaryPath = `${statusPath}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(status, null, 2)}\n`, 'utf8');
  await fs.rename(temporaryPath, statusPath);
}

const loopStartedAt = new Date().toISOString();
const cycles = [];

for (let cycleNumber = 1; cycleNumber <= maxCycles; cycleNumber += 1) {
  const cycle = {
    cycleNumber,
    startedAt: new Date().toISOString(),
    gates: [],
    status: 'RUNNING',
  };
  cycles.push(cycle);

  for (const gate of gates) {
    const result = await runGate(gate);
    cycle.gates.push(result);
    if (result.status !== 'PASS') {
      cycle.status = 'FAIL';
      break;
    }
  }

  if (cycle.status === 'RUNNING') {
    cycle.status = 'PASS';
  }
  cycle.finishedAt = new Date().toISOString();

  await writeStatus({
    schemaVersion: 1,
    mode: 'LOCAL_DETERMINISTIC',
    externalModelsUsed: false,
    startedAt: loopStartedAt,
    updatedAt: new Date().toISOString(),
    maxCycles,
    cycles,
  });

  if (cycle.status !== 'PASS') {
    process.exitCode = 1;
    break;
  }

  if (cycleNumber < maxCycles) {
    await delay(delayMs);
  }
}

console.log(
  JSON.stringify({
    mode: 'LOCAL_DETERMINISTIC',
    externalModelsUsed: false,
    cycles: cycles.map(({ cycleNumber, status, gates: results }) => ({
      cycleNumber,
      status,
      gates: results.map(({ name, status: gateStatus }) => ({ name, status: gateStatus })),
    })),
    statusPath,
  }),
);
