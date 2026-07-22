import {
  chmodSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

const PASSWORD_ENVIRONMENTS = Object.freeze({
  ADMIN: 'CANA_DEMO_ADMIN_PASSWORD',
  RETAILER_MANAGER: 'CANA_DEMO_RETAILER_PASSWORD',
  CUSTOMER: 'CANA_DEMO_CUSTOMER_PASSWORD',
});

export const DEMONSTRATION_ACCOUNTS = Object.freeze([
  Object.freeze({
    key: 'ADMIN',
    email: 'admin@orderweeddc.com',
    name: 'System Admin',
    role: 'ADMIN',
  }),
  Object.freeze({
    key: 'RETAILER_MANAGER',
    email: 'retailer@orderweeddc.com',
    name: 'Demo Retailer Manager',
    role: 'RETAILER_MANAGER',
  }),
  Object.freeze({
    key: 'CUSTOMER',
    email: 'customer@orderweeddc.com',
    name: 'Jane Doe',
    role: 'CUSTOMER',
  }),
]);

export class BootstrapCredentialError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'BootstrapCredentialError';
    this.code = code;
  }
}

function assertStrongBootstrapPassword(password, environmentName) {
  if (
    typeof password !== 'string' ||
    password.length < 16 ||
    password.length > 128 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password) ||
    /[\u0000-\u001f\u007f]/.test(password)
  ) {
    throw new BootstrapCredentialError(
      `${environmentName} must be 16-128 characters and include uppercase, lowercase, number, and symbol characters.`,
      'WEAK_BOOTSTRAP_PASSWORD',
    );
  }
  return password;
}

function generatedPassword(randomBytesFunction) {
  return `A!a1-${randomBytesFunction(24).toString('base64url')}`;
}

export function createBootstrapCredentials(
  environment = process.env,
  randomBytesFunction = randomBytes,
) {
  const credentials = {};

  for (const account of DEMONSTRATION_ACCOUNTS) {
    const environmentName = PASSWORD_ENVIRONMENTS[account.key];
    const configured = environment[environmentName];
    const generated = configured === undefined || configured === '';
    const password = assertStrongBootstrapPassword(
      generated ? generatedPassword(randomBytesFunction) : configured,
      environmentName,
    );
    credentials[account.key] = Object.freeze({
      ...account,
      password,
      generated,
      environmentName,
    });
  }

  const uniquePasswords = new Set(
    Object.values(credentials).map((credential) => credential.password),
  );
  if (uniquePasswords.size !== DEMONSTRATION_ACCOUNTS.length) {
    throw new BootstrapCredentialError(
      'Every demonstration account must use a distinct password.',
      'DUPLICATE_BOOTSTRAP_PASSWORD',
    );
  }

  return Object.freeze(credentials);
}

export function defaultBootstrapCredentialPath(cwd = process.cwd()) {
  return path.resolve(
    cwd,
    process.env.CANA_BOOTSTRAP_CREDENTIALS_PATH ||
      '.cana-local/bootstrap-credentials.json',
  );
}

function restrictCredentialAccess(parent, destination) {
  if (process.platform !== 'win32') {
    chmodSync(parent, 0o700);
    chmodSync(destination, 0o600);
    return;
  }

  let identity;
  try {
    identity = execFileSync('whoami.exe', [], {
      encoding: 'utf8',
      windowsHide: true,
    }).trim();
    if (!identity) throw new Error('Current Windows identity is empty.');

    execFileSync(
      'icacls.exe',
      [
        parent,
        '/inheritance:r',
        '/grant:r',
        `${identity}:(OI)(CI)(F)`,
      ],
      { stdio: 'ignore', windowsHide: true },
    );
    execFileSync(
      'icacls.exe',
      [
        destination,
        '/inheritance:r',
        '/grant:r',
        `${identity}:(R,W)`,
      ],
      { stdio: 'ignore', windowsHide: true },
    );
  } catch {
    throw new BootstrapCredentialError(
      'Unable to restrict the local bootstrap credential file to the current Windows user.',
      'CREDENTIAL_FILE_PERMISSION_FAILURE',
    );
  }
}

export function writeBootstrapCredentialFile(
  credentials,
  {
    credentialPath = defaultBootstrapCredentialPath(),
    generatedAt = new Date(),
  } = {},
) {
  if (
    !(generatedAt instanceof Date) ||
    !Number.isFinite(generatedAt.getTime())
  ) {
    throw new BootstrapCredentialError(
      'Credential generation time must be a valid date.',
      'INVALID_GENERATION_TIME',
    );
  }

  const destination = path.resolve(credentialPath);
  const parent = path.dirname(destination);
  mkdirSync(parent, { recursive: true, mode: 0o700 });

  const document = {
    warning:
      'LOCAL DEMONSTRATION CREDENTIALS. Do not commit, publish, or reuse these passwords.',
    generatedAt: generatedAt.toISOString(),
    accounts: DEMONSTRATION_ACCOUNTS.map((account) => {
      const credential = credentials[account.key];
      return {
        email: account.email,
        role: account.role,
        password: credential.generated ? credential.password : null,
        passwordSource: credential.generated
          ? 'generated-local-file'
          : credential.environmentName,
      };
    }),
  };

  writeFileSync(destination, `${JSON.stringify(document, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  restrictCredentialAccess(parent, destination);
  return destination;
}
