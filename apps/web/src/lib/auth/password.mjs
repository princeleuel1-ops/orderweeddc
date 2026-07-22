import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = Object.freeze({
  N: 16_384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024,
});

function scrypt(password, salt) {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, KEY_LENGTH, SCRYPT_OPTIONS, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    });
  });
}

function parsePasswordHash(storedPassword) {
  if (typeof storedPassword !== 'string') return null;
  const [algorithm, nValue, rValue, pValue, saltValue, hashValue] =
    storedPassword.split('$');
  if (
    algorithm !== 'scrypt' ||
    Number(nValue) !== SCRYPT_OPTIONS.N ||
    Number(rValue) !== SCRYPT_OPTIONS.r ||
    Number(pValue) !== SCRYPT_OPTIONS.p ||
    !saltValue ||
    !hashValue
  ) {
    return null;
  }

  try {
    const salt = Buffer.from(saltValue, 'base64url');
    const expected = Buffer.from(hashValue, 'base64url');
    if (salt.length !== 16 || expected.length !== KEY_LENGTH) return null;
    return { salt, expected };
  } catch {
    return null;
  }
}

export function isPasswordHash(storedPassword) {
  return parsePasswordHash(storedPassword) !== null;
}

export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12) {
    throw new Error('Password must contain at least 12 characters.');
  }

  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt);
  return [
    'scrypt',
    SCRYPT_OPTIONS.N,
    SCRYPT_OPTIONS.r,
    SCRYPT_OPTIONS.p,
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(password, storedPassword) {
  if (typeof password !== 'string') return false;
  const parsed = parsePasswordHash(storedPassword);
  if (!parsed) return false;

  try {
    const actual = await scrypt(password, parsed.salt);
    return timingSafeEqual(parsed.expected, actual);
  } catch {
    return false;
  }
}
