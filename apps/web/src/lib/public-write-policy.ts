import 'server-only';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { formRedirectUrl } from '@/lib/auth/request-policy.mjs';

export const MAX_PUBLIC_WRITE_BODY_BYTES = 8 * 1024;

type FormReadResult =
  | { ok: true; form: URLSearchParams }
  | { ok: false; status: 413 | 415 };

export async function readBoundedPublicForm(
  request: NextRequest,
): Promise<FormReadResult> {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.startsWith('application/x-www-form-urlencoded')) {
    return { ok: false, status: 415 };
  }

  const declaredLength = Number(request.headers.get('content-length'));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_PUBLIC_WRITE_BODY_BYTES
  ) {
    return { ok: false, status: 413 };
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return { ok: true, form: new URLSearchParams() };
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_PUBLIC_WRITE_BODY_BYTES) {
      await reader.cancel();
      return { ok: false, status: 413 };
    }
    chunks.push(value);
  }

  return {
    ok: true,
    form: new URLSearchParams(
      Buffer.concat(chunks, totalBytes).toString('utf8'),
    ),
  };
}

export function singleFormValue(form: URLSearchParams, name: string) {
  const values = form.getAll(name);
  return values.length === 1 ? values[0] : null;
}

export function publicWriteResponse(status: number, message: string | null = null) {
  return new Response(message, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...(message
        ? { 'Content-Type': 'text/plain; charset=utf-8' }
        : {}),
    },
  });
}

export function publicWriteRateLimitResponse(retryAfterSeconds: number) {
  const response = publicWriteResponse(
    429,
    'Too many submissions were received. Please try again later.',
  );
  response.headers.set('Retry-After', String(retryAfterSeconds));
  return response;
}

export function publicWriteRedirect(
  request: NextRequest,
  pathname: string,
) {
  const response = NextResponse.redirect(
    formRedirectUrl(request, pathname),
    303,
  );
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
