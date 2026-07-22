import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  CORRECTION_FIELDS,
  SubmissionValidationError,
  validateClaimSubmission,
  validateCorrectionSubmission,
  validateEvidenceUrl,
} from '../src/lib/submission-validation.mjs';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(testDirectory, '..');

test('claim submissions are normalized and retain only constrained values', () => {
  const submission = validateClaimSubmission({
    name: '  Example   Retailer  ',
    address: '100 Example Avenue NW, Washington, DC',
    email: 'OWNER@EXAMPLE.COM',
    phone: '(202) 555-0100',
    licenseNumber: 'abca-12345',
    evidenceUrl: 'https://records.example.gov/licenses/abca-12345.pdf',
    password: 'StrongClaim!2026',
    passwordConfirmation: 'StrongClaim!2026',
  });

  assert.equal(submission.name, 'Example Retailer');
  assert.equal(submission.email, 'owner@example.com');
  assert.equal(submission.licenseNumber, 'ABCA-12345');
  assert.equal(submission.password, 'StrongClaim!2026');
  assert.equal(
    submission.evidenceUrl,
    'https://records.example.gov/licenses/abca-12345.pdf',
  );
});

test('claim account passwords require strength and exact confirmation', () => {
  const validClaim = {
    name: 'Example Retailer',
    address: '100 Example Avenue',
    email: 'owner@example.com',
    phone: '202-555-0100',
    licenseNumber: 'ABC-123',
    evidenceUrl: 'https://records.example.gov/license.pdf',
    password: 'StrongClaim!2026',
    passwordConfirmation: 'StrongClaim!2026',
  };

  assert.equal(
    validateClaimSubmission(validClaim).password,
    'StrongClaim!2026',
  );
  assert.throws(
    () =>
      validateClaimSubmission({
        ...validClaim,
        password: 'weakpassword',
        passwordConfirmation: 'weakpassword',
      }),
    /uppercase, lowercase, number, and symbol/,
  );
  assert.throws(
    () =>
      validateClaimSubmission({
        ...validClaim,
        passwordConfirmation: 'Different!2026',
      }),
    /confirmation does not match/,
  );
});

test('license numbers are database-unique under concurrent claim submissions', () => {
  const schema = fs.readFileSync(
    path.join(webRoot, 'prisma/schema.prisma'),
    'utf8',
  );
  assert.match(schema, /licenseNumber\s+String\?\s+@unique/);
});

test('evidence references reject insecure, local, credentialed, and unsupported URLs', () => {
  const rejectedUrls = [
    'http://records.example.gov/license.pdf',
    'https://localhost/license.pdf',
    'https://127.0.0.1/license.pdf',
    'https://user:password@records.example.gov/license.pdf',
    'https://records.example.gov/license.txt',
    'https://records.example.gov/../license.pdf',
    '/evidence/fake-upload.pdf',
  ];

  for (const value of rejectedUrls) {
    assert.throws(() => validateEvidenceUrl(value), SubmissionValidationError);
  }
});

test('corrections constrain fields, contact data, values, and reasons', () => {
  assert.deepEqual(CORRECTION_FIELDS, [
    'address',
    'phone',
    'hours',
    'licenseNumber',
    'name',
  ]);

  const correction = validateCorrectionSubmission({
    filedBy: 'reviewer@example.org',
    fieldName: 'phone',
    newValue: '202-555-0199',
    evidenceUrl: 'https://records.example.gov/business/contact.png',
    reason: 'The linked public record shows a different contact number.',
  });
  assert.equal(correction.newValue, '202-555-0199');

  assert.throws(
    () => validateCorrectionSubmission({ ...correction, fieldName: 'dataStatus' }),
    /Unsupported correction field/,
  );
  assert.throws(
    () => validateCorrectionSubmission({ ...correction, reason: 'too short' }),
    /between 10 and 1000/,
  );
  assert.throws(
    () => validateCorrectionSubmission({ ...correction, newValue: '555' }),
    /10 to 15 digits/,
  );
});

test('oversized and control-character inputs are rejected', () => {
  assert.throws(
    () =>
      validateClaimSubmission({
        name: 'x'.repeat(121),
        address: '100 Example Avenue',
        email: 'owner@example.com',
        phone: '202-555-0100',
        licenseNumber: 'ABC-123',
        evidenceUrl: 'https://records.example.gov/license.pdf',
        password: 'StrongClaim!2026',
        passwordConfirmation: 'StrongClaim!2026',
      }),
    /Business name must be between/,
  );

  assert.throws(
    () =>
      validateClaimSubmission({
        name: 'Example\u0000Retailer',
        address: '100 Example Avenue',
        email: 'owner@example.com',
        phone: '202-555-0100',
        licenseNumber: 'ABC-123',
        evidenceUrl: 'https://records.example.gov/license.pdf',
        password: 'StrongClaim!2026',
        passwordConfirmation: 'StrongClaim!2026',
      }),
    /unsupported characters/,
  );
});
