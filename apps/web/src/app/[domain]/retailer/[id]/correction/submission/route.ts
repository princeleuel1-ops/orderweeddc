import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  authenticationClientIdentity,
  isSameOriginFormRequest,
} from '@/lib/auth/request-policy.mjs';
import {
  checkPublicSubmissionThrottle,
  PUBLIC_SUBMISSION_SURFACES,
  publicSubmissionErrorCode,
} from '@/lib/public-submission.mjs';
import {
  PublicSubmissionTargetError,
  submitRetailerCorrection,
} from '@/lib/public-submission-mutations.mjs';
import {
  publicWriteRateLimitResponse,
  publicWriteRedirect,
  publicWriteResponse,
  readBoundedPublicForm,
  singleFormValue,
} from '@/lib/public-write-policy';

type RouteContext = {
  params: Promise<{ domain: string; id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isSameOriginFormRequest(request)) {
    return publicWriteResponse(403);
  }

  const formResult = await readBoundedPublicForm(request);
  if (!formResult.ok) {
    return publicWriteResponse(formResult.status);
  }

  const { domain, id } = await context.params;
  const brand = await prisma.brand.findUnique({
    where: { domain },
    select: { id: true },
  });
  if (!brand) {
    return publicWriteResponse(404);
  }

  const clientIdentity = authenticationClientIdentity(request);
  const throttle = await checkPublicSubmissionThrottle(prisma, {
    clientIdentity,
    surface: PUBLIC_SUBMISSION_SURFACES.CORRECTION,
  });
  if (!throttle.allowed) {
    return publicWriteRateLimitResponse(throttle.retryAfterSeconds);
  }

  try {
    await submitRetailerCorrection(prisma, {
      brandId: brand.id,
      retailerId: id,
      clientIdentity,
      input: {
        filedBy: singleFormValue(formResult.form, 'filedBy'),
        fieldName: singleFormValue(formResult.form, 'fieldName'),
        newValue: singleFormValue(formResult.form, 'newValue'),
        evidenceUrl: singleFormValue(formResult.form, 'evidenceUrl'),
        reason: singleFormValue(formResult.form, 'reason'),
      },
    });
  } catch (error) {
    if (error instanceof PublicSubmissionTargetError) {
      return publicWriteResponse(404);
    }
    if (publicSubmissionErrorCode(error) === 'failed') {
      console.error('[Retailer Correction] Unexpected submission failure.');
    }
    return publicWriteRedirect(
      request,
      `/retailer/${id}/correction?error=${publicSubmissionErrorCode(error)}`,
    );
  }

  return publicWriteRedirect(
    request,
    `/retailer/${id}/correction?submitted=1`,
  );
}
