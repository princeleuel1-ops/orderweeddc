import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { destroySession, getSession } from '@/lib/auth/session';
import {
  formRedirectUrl,
  isSameOriginFormRequest,
} from '@/lib/auth/request-policy.mjs';

export async function POST(request: NextRequest) {
  if (!isSameOriginFormRequest(request)) {
    return new Response(null, { status: 403 });
  }

  const session = await getSession();
  if (session?.role === 'CUSTOMER') {
    await destroySession();
  }

  return NextResponse.redirect(
    formRedirectUrl(request, '/customer/login'),
    303,
  );
}
