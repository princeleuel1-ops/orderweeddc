import { hashPassword } from './auth/password.mjs';
import {
  PublicSubmissionDuplicateError,
  PUBLIC_SUBMISSION_SURFACES,
  reservePublicSubmission,
} from './public-submission.mjs';
import {
  validateClaimSubmission,
  validateCorrectionSubmission,
} from './submission-validation.mjs';
import { tenantRetailerWhere } from './tenant-retailer.mjs';

export class PublicSubmissionTargetError extends Error {
  constructor() {
    super('The public submission target was not found.');
    this.name = 'PublicSubmissionTargetError';
    this.code = 'PUBLIC_SUBMISSION_TARGET_NOT_FOUND';
  }
}

function validTimestamp(now) {
  const value = now ?? new Date();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new TypeError('Public submission time must be a valid date.');
  }
  return new Date(value);
}

async function findPendingClaimDuplicate(db, submission) {
  return db.claimRequest.findFirst({
    where: {
      status: 'PENDING',
      OR: [
        { email: submission.email },
        {
          retailer: {
            is: { licenseNumber: submission.licenseNumber },
          },
        },
      ],
    },
    select: { id: true },
  });
}

export async function submitBusinessClaim(
  db,
  { input, clientIdentity, now = undefined },
) {
  const submission = validateClaimSubmission(input);
  if (await findPendingClaimDuplicate(db, submission)) {
    throw new PublicSubmissionDuplicateError();
  }

  const requestedPasswordHash = await hashPassword(submission.password);
  const submittedAt = validTimestamp(now);

  return db.$transaction(async (transaction) => {
    await reservePublicSubmission(transaction, {
      clientIdentity,
      surface: PUBLIC_SUBMISSION_SURFACES.CLAIM,
      subject: `${submission.email}\n${submission.licenseNumber}`,
      now: submittedAt,
    });

    if (await findPendingClaimDuplicate(transaction, submission)) {
      throw new PublicSubmissionDuplicateError();
    }

    const retailer = await transaction.retailer.create({
      data: {
        name: submission.name,
        address: submission.address,
        email: submission.email,
        phone: submission.phone,
        licenseStatus: 'PENDING',
        licenseNumber: submission.licenseNumber,
        licenseSource: 'Business-submitted evidence reference',
        lat: 38.9072,
        lng: -77.0369,
        hours: 'Not submitted',
        hoursSource: 'No hours submitted',
        dataStatus: 'AWAITING_VERIFICATION',
        dataSource: 'Business claim submission',
        retrievedAt: submittedAt,
        verifiedAt: null,
        freshnessExpiresAt: null,
        confidence: null,
        reviewedBy: null,
        isDemonstration: false,
      },
    });

    const claim = await transaction.claimRequest.create({
      data: {
        retailerId: retailer.id,
        email: submission.email,
        phone: submission.phone,
        requestedPasswordHash,
        status: 'PENDING',
      },
    });

    const evidence = await transaction.licenseEvidence.create({
      data: {
        retailerId: retailer.id,
        documentUrl: submission.evidenceUrl,
        verificationStatus: 'PENDING',
        notes: 'Public evidence reference submitted with listing claim.',
        dataStatus: 'AWAITING_VERIFICATION',
        dataSource: 'Business claim submission',
        sourceUrl: submission.evidenceUrl,
        retrievedAt: submittedAt,
        confidence: null,
        reviewedBy: null,
        isDemonstration: false,
      },
    });

    await transaction.auditLog.create({
      data: {
        action: 'SUBMIT_RETAILER_CLAIM',
        details: `claimId=${claim.id} retailerId=${retailer.id} evidenceId=${evidence.id}`,
      },
    });

    return {
      claimId: claim.id,
      evidenceId: evidence.id,
      retailerId: retailer.id,
    };
  });
}

export async function submitRetailerCorrection(
  db,
  {
    brandId,
    retailerId,
    input,
    clientIdentity,
    now = undefined,
  },
) {
  const submission = validateCorrectionSubmission(input);
  const submittedAt = validTimestamp(now);

  return db.$transaction(async (transaction) => {
    await reservePublicSubmission(transaction, {
      clientIdentity,
      surface: PUBLIC_SUBMISSION_SURFACES.CORRECTION,
      subject: [
        retailerId,
        submission.filedBy,
        submission.fieldName,
        submission.newValue,
      ].join('\n'),
      now: submittedAt,
    });

    const currentRetailer = await transaction.retailer.findFirst({
      where: tenantRetailerWhere(brandId, retailerId),
    });
    if (!currentRetailer) {
      throw new PublicSubmissionTargetError();
    }

    const duplicate = await transaction.dispute.findFirst({
      where: {
        retailerId,
        fieldName: submission.fieldName,
        newValue: submission.newValue,
        status: 'PENDING',
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new PublicSubmissionDuplicateError();
    }

    const currentValues = {
      address: currentRetailer.address,
      phone: currentRetailer.phone || '',
      hours: currentRetailer.hours,
      licenseNumber: currentRetailer.licenseNumber || '',
      name: currentRetailer.name,
    };

    const dispute = await transaction.dispute.create({
      data: {
        retailerId,
        filedBy: submission.filedBy,
        fieldName: submission.fieldName,
        oldValue: currentValues[submission.fieldName],
        newValue: submission.newValue,
        evidenceUrl: submission.evidenceUrl,
        reason: submission.reason,
        status: 'PENDING',
      },
    });

    await transaction.retailer.update({
      where: { id: retailerId },
      data: {
        dataStatus: currentRetailer.isDemonstration
          ? 'DEMONSTRATION_ONLY'
          : 'DISPUTED',
      },
    });

    await transaction.auditLog.create({
      data: {
        action: 'SUBMIT_CORRECTION_DISPUTE',
        details: `disputeId=${dispute.id} retailerId=${retailerId}`,
      },
    });

    return { disputeId: dispute.id, retailerId };
  });
}
