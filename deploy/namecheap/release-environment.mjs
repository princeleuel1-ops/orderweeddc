import path from 'node:path';

export function createReleaseChildEnvironment({
  baseEnvironment = process.env,
  execPath = process.execPath,
} = {}) {
  const environment = { ...baseEnvironment };
  const exactNodeDirectory = path.dirname(execPath);
  const inheritedPath = String(environment.PATH ?? '')
    .split(path.delimiter)
    .filter((entry) => entry && entry !== exactNodeDirectory);

  environment.PATH = [exactNodeDirectory, ...inheritedPath].join(
    path.delimiter,
  );
  delete environment.RUST_LOG;
  return environment;
}
