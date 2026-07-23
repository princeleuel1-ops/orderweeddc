// Release reproducibility gate — FAIL CLOSED before building a deployable artifact.
//
// Production incident 2026-07-23: the live artifact `orderweeddc-c1e8ac7` was built from commit
// c1e8ac7…4494, which is NOT reachable in the remote repository. An unreachable (or dirty) commit
// must never become a production artifact — otherwise the running code cannot be reproduced or
// audited. This guard refuses the build unless HEAD is a full 40-hex SHA, the working tree is clean
// (unless ALLOW_DIRTY=1 for throwaway local builds), and HEAD is reachable on the configured remote.
//
// The decision function is PURE so it can be unit-tested without a live git remote.

export function evaluateReleaseReproducibility({ workingTree, gitSha, remoteContains, allowDirty = false }) {
  const problems = [];
  if (typeof gitSha !== 'string' || !/^[0-9a-f]{40}$/.test(gitSha)) {
    problems.push('HEAD is not a full 40-hex commit SHA');
  }
  if (typeof workingTree === 'string' && workingTree.trim() !== '' && !allowDirty) {
    problems.push('working tree is not clean — commit or stash first (ALLOW_DIRTY=1 only for throwaway builds)');
  }
  if (!remoteContains) {
    problems.push(
      `HEAD (${gitSha || 'unknown'}) is not reachable on the remote — push it before building ` +
      '(prevents shipping an unpushed SHA like c1e8ac7)',
    );
  }
  return { ok: problems.length === 0, problems };
}

// Side-effecting wrapper for the builder. `capture(cmd, opts)` runs a shell command → trimmed stdout.
export function assertReleaseReproducible({ capture, repoRoot, remote = 'origin', workingTree, gitSha, allowDirty = false }) {
  let remoteContains = false;
  try {
    const ls = capture(`git ls-remote ${remote}`, { cwd: repoRoot }) || '';
    remoteContains = ls.split('\n').some((line) => line.slice(0, 40) === gitSha);
    if (!remoteContains) {
      const contains = (capture(`git branch -r --contains ${gitSha}`, { cwd: repoRoot }) || '').trim();
      remoteContains = contains !== '';
    }
  } catch {
    remoteContains = false;
  }
  const verdict = evaluateReleaseReproducibility({ workingTree, gitSha, remoteContains, allowDirty });
  if (!verdict.ok) {
    throw new Error('Release reproducibility gate FAILED:\n- ' + verdict.problems.join('\n- '));
  }
  return { remote, remoteReachable: remoteContains };
}
