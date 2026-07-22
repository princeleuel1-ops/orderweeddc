import 'server-only';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  authenticateCredentials,
  type AppRole,
  type AuthenticatedUser,
} from '@/lib/auth/credentials';
import {
  authenticationClientIdentity,
  formRedirectUrl,
  isSameOriginFormRequest,
} from '@/lib/auth/request-policy.mjs';
import { createSession } from '@/lib/auth/session';
import {
  checkAuthenticationThrottle,
  clearAuthenticationFailures,
  recordAuthenticationFailure,
} from '@/lib/auth/throttle.mjs';

const MAX_LOGIN_BODY_BYTES = 8 * 1024;

type LoginConfiguration = {
  role: AppRole;
  surface: 'ADMIN' | 'BUSINESS' | 'CUSTOMER';
  successPath: string;
  failurePath: string;
  validateUser?: (user: AuthenticatedUser) => Promise<boolean>;
};

async function readBoundedUrlEncodedForm(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.startsWith('application/x-www-form-urlencoded')) {
    return null;
  }

  const declaredLength = Number(request.headers.get('content-length'));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_LOGIN_BODY_BYTES
  ) {
    return null;
  }

  const reader = request.body?.getReader();
  if (!reader) return new URLSearchParams();

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_LOGIN_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const body = Buffer.concat(chunks, totalBytes).toString('utf8');
  return new URLSearchParams(body);
}

function throttledResponse(retryAfterSeconds: number) {
  return new Response(
    'Sign-in is temporarily unavailable after repeated unsuccessful attempts. Try again later.',
    {
      status: 429,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8',
        'Retry-After': String(retryAfterSeconds),
      },
    },
  );
}

function redirectWithoutCaching(request: NextRequest, pathname: string) {
  const response = NextResponse.redirect(formRedirectUrl(request, pathname), 303);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function handleCredentialLogin(
  request: NextRequest,
  configuration: LoginConfiguration,
) {
  if (!isSameOriginFormRequest(request)) {
    return new Response(null, {
      status: 403,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const form = await readBoundedUrlEncodedForm(request);
  if (!form) {
    return new Response(null, {
      status: 413,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const emailValues = form.getAll('email');
  const passwordValues = form.getAll('password');
  const email = emailValues.length === 1 ? emailValues[0] : '';
  const password = passwordValues.length === 1 ? passwordValues[0] : '';
  const clientIdentity = authenticationClientIdentity(request);

  const throttle = await checkAuthenticationThrottle(prisma, {
    email,
    clientIdentity,
  });
  if (!throttle.allowed) {
    return throttledResponse(throttle.retryAfterSeconds);
  }

  const boundedInput =
    email.length > 0 &&
    email.length <= 254 &&
    password.length > 0 &&
    password.length <= 256;
  const user = boundedInput
    ? await authenticateCredentials(email, password, configuration.role)
    : null;
  if (
    !user ||
    (configuration.validateUser &&
      !(await configuration.validateUser(user)))
  ) {
    const failure = await recordAuthenticationFailure(prisma, {
      email,
      clientIdentity,
      surface: configuration.surface,
    });
    if (!failure.allowed) {
      return throttledResponse(failure.retryAfterSeconds);
    }
    return redirectWithoutCaching(request, configuration.failurePath);
  }

  await clearAuthenticationFailures(prisma, { email });
  await createSession(user.id);
  return redirectWithoutCaching(request, configuration.successPath);
}
