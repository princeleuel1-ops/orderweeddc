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
import { submitBusinessClaim } from '@/lib/public-submission-mutations.mjs';
import {
  publicWriteRateLimitResponse,
  publicWriteRedirect,
  publicWriteResponse,
  readBoundedPublicForm,
  singleFormValue,
} from '@/lib/public-write-policy';

export async function POST(request: NextRequest) {
  if (!isSameOriginFormRequest(request)) {
    return publicWriteResponse(403);
  }

  const formResult = await readBoundedPublicForm(request);
  if (!formResult.ok) {
    return publicWriteResponse(formResult.status);
  }

  const clientIdentity = authenticationClientIdentity(request);
  const throttle = await checkPublicSubmissionThrottle(prisma, {
    clientIdentity,
    surface: PUBLIC_SUBMISSION_SURFACES.CLAIM,
  });
  if (!throttle.allowed) {
    return publicWriteRateLimitResponse(throttle.retryAfterSeconds);
  }

  try {
    await submitBusinessClaim(prisma, {
      clientIdentity,
      input: {
        name: singleFormValue(formResult.form, 'name'),
        address: singleFormValue(formResult.form, 'address'),
        email: singleFormValue(formResult.form, 'email'),
        phone: singleFormValue(formResult.form, 'phone'),
        licenseNumber: singleFormValue(formResult.form, 'licenseNumber'),
        evidenceUrl: singleFormValue(formResult.form, 'evidenceUrl'),
        password: singleFormValue(formResult.form, 'password'),
        passwordConfirmation: singleFormValue(
          formResult.form,
          'passwordConfirmation',
        ),
      },
    });
  } catch (error) {
    if (publicSubmissionErrorCode(error) === 'failed') {
      console.error('[Business Claim] Unexpected submission failure.');
    }
    return publicWriteRedirect(
      request,
      `/business/claim?error=${publicSubmissionErrorCode(error)}`,
    );
  }

  return publicWriteRedirect(request, '/business/claim?submitted=1');
}
