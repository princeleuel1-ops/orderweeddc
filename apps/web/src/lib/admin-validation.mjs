const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const DISPUTE_DECISIONS = new Set(['APPROVE', 'REJECT']);

export class AdminValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AdminValidationError';
    this.code = 'INVALID_ADMIN_INPUT';
  }
}

export function validateAdminIdentifier(value, label) {
  if (typeof value !== 'string') {
    throw new AdminValidationError(`${label} is required.`);
  }

  const identifier = value.trim();
  if (!IDENTIFIER_PATTERN.test(identifier)) {
    throw new AdminValidationError(`${label} has an invalid format.`);
  }
  return identifier;
}

export function validateReviewDecision(value) {
  if (typeof value !== 'string' || !DISPUTE_DECISIONS.has(value)) {
    throw new AdminValidationError('Review decision must be APPROVE or REJECT.');
  }
  return value;
}

export const validateDisputeDecision = validateReviewDecision;
