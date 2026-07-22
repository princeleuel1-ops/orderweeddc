import { createHash } from 'node:crypto';

export const AUTH_THROTTLE_POLICY = Object.freeze({
  windowMs: 15 * 60 * 1000,
  retentionMs: 24 * 60 * 60 * 1000,
  accountFailureLimit: 5,
  clientFailureLimit: 20,
});

function validNow(now) {
  const value = now ?? new Date();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new TypeError('Authentication throttle time must be a valid date.');
  }
  return new Date(value);
}

function normalizedEmail(email) {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase().slice(0, 254);
}

function normalizedClientIdentity(clientIdentity) {
  if (typeof clientIdentity !== 'string') return 'unresolved';
  const normalized = clientIdentity.trim().toLowerCase();
  return normalized ? normalized.slice(0, 128) : 'unresolved';
}

function digest(namespace, value) {
  return createHash('sha256')
    .update(`cana-auth-v1:${namespace}:${value}`, 'utf8')
    .digest('hex');
}

function throttleKeys(email, clientIdentity) {
  return {
    accountDigest: digest('account', normalizedEmail(email)),
    clientDigest: digest('client', normalizedClientIdentity(clientIdentity)),
  };
}

async function throttleState(authFailure, keys, timestamp) {
  const cutoff = new Date(
    timestamp.getTime() - AUTH_THROTTLE_POLICY.windowMs,
  );
  const [accountFailures, clientFailures] = await Promise.all([
    authFailure.count({
      where: {
        accountDigest: keys.accountDigest,
        occurredAt: { gte: cutoff },
      },
    }),
    authFailure.count({
      where: {
        clientDigest: keys.clientDigest,
        occurredAt: { gte: cutoff },
      },
    }),
  ]);

  const accountBlocked =
    accountFailures >= AUTH_THROTTLE_POLICY.accountFailureLimit;
  const clientBlocked =
    clientFailures >= AUTH_THROTTLE_POLICY.clientFailureLimit;

  return {
    allowed: !accountBlocked && !clientBlocked,
    accountBlocked,
    clientBlocked,
    retryAfterSeconds: Math.ceil(AUTH_THROTTLE_POLICY.windowMs / 1000),
  };
}

export async function checkAuthenticationThrottle(
  db,
  { email, clientIdentity, now = undefined },
) {
  const timestamp = validNow(now);
  return throttleState(
    db.authFailure,
    throttleKeys(email, clientIdentity),
    timestamp,
  );
}

export async function recordAuthenticationFailure(
  db,
  { email, clientIdentity, surface, now = undefined },
) {
  const timestamp = validNow(now);
  if (
    typeof surface !== 'string' ||
    !/^[A-Z][A-Z_]{1,31}$/.test(surface)
  ) {
    throw new TypeError('Authentication surface is invalid.');
  }

  const keys = throttleKeys(email, clientIdentity);
  const expiresAt = new Date(
    timestamp.getTime() + AUTH_THROTTLE_POLICY.retentionMs,
  );

  return db.$transaction(async (transaction) => {
    await transaction.authFailure.deleteMany({
      where: { expiresAt: { lte: timestamp } },
    });
    await transaction.authFailure.create({
      data: {
        ...keys,
        surface,
        occurredAt: timestamp,
        expiresAt,
      },
    });
    return throttleState(transaction.authFailure, keys, timestamp);
  });
}

export async function clearAuthenticationFailures(db, { email }) {
  const { accountDigest } = throttleKeys(email, 'not-used');
  return db.authFailure.deleteMany({ where: { accountDigest } });
}
