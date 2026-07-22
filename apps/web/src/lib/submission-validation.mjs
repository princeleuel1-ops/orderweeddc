const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^[+()\d.\-\s]+$/;
const LICENSE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 .#/-]*$/;
const EVIDENCE_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg']);
const PASSWORD_MAX_LENGTH = 128;

export const CORRECTION_FIELDS = Object.freeze([
  'address',
  'phone',
  'hours',
  'licenseNumber',
  'name',
]);

export class SubmissionValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SubmissionValidationError';
  }
}

function requiredText(value, label, minimumLength, maximumLength) {
  if (typeof value !== 'string') {
    throw new SubmissionValidationError(`${label} is required.`);
  }

  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length < minimumLength || normalized.length > maximumLength) {
    throw new SubmissionValidationError(
      `${label} must be between ${minimumLength} and ${maximumLength} characters.`,
    );
  }
  if (CONTROL_CHARACTER.test(normalized)) {
    throw new SubmissionValidationError(`${label} contains unsupported characters.`);
  }
  return normalized;
}

function emailAddress(value, label = 'Email') {
  const normalized = requiredText(value, label, 5, 254).toLowerCase();
  if (!EMAIL_PATTERN.test(normalized)) {
    throw new SubmissionValidationError(`${label} must be a valid email address.`);
  }
  return normalized;
}

function phoneNumber(value) {
  const normalized = requiredText(value, 'Phone', 1, 32);
  const digitCount = normalized.replace(/\D/g, '').length;
  if (!PHONE_PATTERN.test(normalized) || digitCount < 10 || digitCount > 15) {
    throw new SubmissionValidationError(
      'Phone must contain 10 to 15 digits and only standard phone punctuation.',
    );
  }
  return normalized;
}

function licenseNumber(value) {
  const normalized = requiredText(value, 'License number', 3, 64).toUpperCase();
  if (!LICENSE_PATTERN.test(normalized)) {
    throw new SubmissionValidationError(
      'License number contains unsupported characters.',
    );
  }
  return normalized;
}

function accountPassword(value, confirmation) {
  if (
    typeof value !== 'string' ||
    value.length < 12 ||
    value.length > PASSWORD_MAX_LENGTH
  ) {
    throw new SubmissionValidationError(
      `Account password must be between 12 and ${PASSWORD_MAX_LENGTH} characters.`,
    );
  }
  if (CONTROL_CHARACTER.test(value)) {
    throw new SubmissionValidationError(
      'Account password contains unsupported characters.',
    );
  }
  if (
    !/[a-z]/.test(value) ||
    !/[A-Z]/.test(value) ||
    !/\d/.test(value) ||
    !/[^A-Za-z0-9]/.test(value)
  ) {
    throw new SubmissionValidationError(
      'Account password must include uppercase, lowercase, number, and symbol characters.',
    );
  }
  if (value !== confirmation) {
    throw new SubmissionValidationError('Account password confirmation does not match.');
  }
  return value;
}

function isPrivateOrLocalHostname(hostname) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    !normalized.includes('.') ||
    normalized.includes(':')
  ) {
    return true;
  }

  const octets = normalized.split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) {
    return false;
  }

  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19))
  );
}

export function validateEvidenceUrl(value) {
  const raw = requiredText(value, 'Evidence URL', 12, 2048);
  if (raw.includes('..')) {
    throw new SubmissionValidationError('Evidence URL cannot contain path traversal.');
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new SubmissionValidationError('Evidence URL must be a valid public HTTPS URL.');
  }

  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    isPrivateOrLocalHostname(parsed.hostname)
  ) {
    throw new SubmissionValidationError('Evidence URL must be a public HTTPS URL.');
  }

  const pathname = parsed.pathname.toLowerCase();
  const extension = [...EVIDENCE_EXTENSIONS].find((candidate) =>
    pathname.endsWith(candidate),
  );
  if (!extension) {
    throw new SubmissionValidationError(
      'Evidence URL must reference a PDF, PNG, JPG, or JPEG file.',
    );
  }

  return parsed.toString();
}

export function validateClaimSubmission(input) {
  return {
    name: requiredText(input?.name, 'Business name', 2, 120),
    address: requiredText(input?.address, 'Address', 5, 240),
    email: emailAddress(input?.email, 'Contact email'),
    phone: phoneNumber(input?.phone),
    licenseNumber: licenseNumber(input?.licenseNumber),
    evidenceUrl: validateEvidenceUrl(input?.evidenceUrl),
    password: accountPassword(input?.password, input?.passwordConfirmation),
  };
}

export function validateCorrectionSubmission(input) {
  const fieldName = requiredText(input?.fieldName, 'Correction field', 2, 32);
  if (!CORRECTION_FIELDS.includes(fieldName)) {
    throw new SubmissionValidationError('Unsupported correction field.');
  }

  let newValue;
  if (fieldName === 'phone') {
    newValue = phoneNumber(input?.newValue);
  } else if (fieldName === 'licenseNumber') {
    newValue = licenseNumber(input?.newValue);
  } else {
    const maximumLength = fieldName === 'address' ? 240 : 120;
    newValue = requiredText(input?.newValue, 'Corrected value', 1, maximumLength);
  }

  return {
    filedBy: emailAddress(input?.filedBy, 'Contact email'),
    fieldName,
    newValue,
    evidenceUrl: validateEvidenceUrl(input?.evidenceUrl),
    reason: requiredText(input?.reason, 'Correction reason', 10, 1000),
  };
}
