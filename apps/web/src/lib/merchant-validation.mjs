const UNSUPPORTED_CONTROL_CHARACTER =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const PHONE_PATTERN = /^[+()\d.\-\s]+$/;
const PROMO_CODE_PATTERN = /^[A-Za-z0-9_-]+$/;
const PRICE_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const WHOLE_NUMBER_PATTERN = /^(?:0|[1-9]\d*)$/;

export const MERCHANT_LIMITS = Object.freeze({
  price: Object.freeze({ minimum: 0.01, maximum: 10_000 }),
  quantity: Object.freeze({ minimum: 0, maximum: 100_000 }),
  dealDurationDays: Object.freeze({ minimum: 1, maximum: 90 }),
});

export class MerchantValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MerchantValidationError';
    this.code = 'INVALID_MERCHANT_INPUT';
  }
}

function normalizedText(value, label, minimumLength, maximumLength) {
  if (typeof value !== 'string') {
    throw new MerchantValidationError(`${label} is required.`);
  }
  if (value.length > maximumLength) {
    throw new MerchantValidationError(
      `${label} must be between ${minimumLength} and ${maximumLength} characters.`,
    );
  }
  if (UNSUPPORTED_CONTROL_CHARACTER.test(value)) {
    throw new MerchantValidationError(`${label} contains unsupported characters.`);
  }

  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length < minimumLength || normalized.length > maximumLength) {
    throw new MerchantValidationError(
      `${label} must be between ${minimumLength} and ${maximumLength} characters.`,
    );
  }
  return normalized;
}

function optionalText(value, label, maximumLength) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return normalizedText(value, label, 1, maximumLength);
}

export function validateMerchantIdentifier(value, label) {
  const identifier = normalizedText(value, label, 1, 64);
  if (!IDENTIFIER_PATTERN.test(identifier)) {
    throw new MerchantValidationError(`${label} has an invalid format.`);
  }
  return identifier;
}

function price(value) {
  const raw = normalizedText(value, 'Price', 1, 16);
  if (!PRICE_PATTERN.test(raw)) {
    throw new MerchantValidationError('Price must be a dollar amount with at most two decimals.');
  }

  const parsed = Number(raw);
  if (
    !Number.isFinite(parsed) ||
    parsed < MERCHANT_LIMITS.price.minimum ||
    parsed > MERCHANT_LIMITS.price.maximum
  ) {
    throw new MerchantValidationError(
      `Price must be between $${MERCHANT_LIMITS.price.minimum.toFixed(2)} and $${MERCHANT_LIMITS.price.maximum.toFixed(2)}.`,
    );
  }
  return parsed;
}

function boundedWholeNumber(value, label, minimum, maximum) {
  const raw = normalizedText(value, label, 1, String(maximum).length);
  if (!WHOLE_NUMBER_PATTERN.test(raw)) {
    throw new MerchantValidationError(`${label} must be a whole number.`);
  }

  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new MerchantValidationError(
      `${label} must be between ${minimum} and ${maximum}.`,
    );
  }
  return parsed;
}

function quantity(value) {
  return boundedWholeNumber(
    value,
    'Quantity',
    MERCHANT_LIMITS.quantity.minimum,
    MERCHANT_LIMITS.quantity.maximum,
  );
}

function phoneNumber(value) {
  const normalized = optionalText(value, 'Phone', 32);
  if (normalized === null) {
    return null;
  }

  const digitCount = normalized.replace(/\D/g, '').length;
  if (!PHONE_PATTERN.test(normalized) || digitCount < 10 || digitCount > 15) {
    throw new MerchantValidationError(
      'Phone must contain 10 to 15 digits and only standard phone punctuation.',
    );
  }
  return normalized;
}

function promoCode(value) {
  const normalized = optionalText(value, 'Promo code', 32);
  if (normalized === null) {
    return null;
  }
  if (!PROMO_CODE_PATTERN.test(normalized)) {
    throw new MerchantValidationError(
      'Promo code may contain only letters, numbers, hyphens, and underscores.',
    );
  }
  return normalized.toUpperCase();
}

export function validateProfileMutation(input) {
  return {
    name: normalizedText(input?.name, 'Business name', 2, 120),
    address: normalizedText(input?.address, 'Address', 5, 240),
    phone: phoneNumber(input?.phone),
    hours: normalizedText(input?.hours, 'Operating hours', 1, 120),
    hoursSource: normalizedText(input?.hoursSource, 'Hours source', 2, 120),
  };
}

export function validateMenuEntryMutation(input) {
  return {
    menuEntryId: validateMerchantIdentifier(input?.menuEntryId, 'Menu entry ID'),
    price: price(input?.price),
    quantity: quantity(input?.quantity),
  };
}

export function validateAddMenuItemMutation(input) {
  return {
    productId: validateMerchantIdentifier(input?.productId, 'Product ID'),
    price: price(input?.price),
    quantity: quantity(input?.quantity),
  };
}

export function validateDealMutation(input) {
  return {
    title: normalizedText(input?.title, 'Deal title', 2, 120),
    discount: normalizedText(input?.discount, 'Discount label', 1, 80),
    code: promoCode(input?.code),
    days: boundedWholeNumber(
      input?.days,
      'Deal duration',
      MERCHANT_LIMITS.dealDurationDays.minimum,
      MERCHANT_LIMITS.dealDurationDays.maximum,
    ),
    description: optionalText(input?.description, 'Deal description', 1000) ?? '',
  };
}
