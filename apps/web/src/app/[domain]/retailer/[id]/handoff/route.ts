import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  HandoffError,
  recordVerifiedHandoff,
} from '@/lib/handoff.mjs';
import { isSameOriginFormRequest } from '@/lib/auth/request-policy.mjs';

type RouteContext = {
  params: Promise<{ domain: string; id: string }>;
};

function unavailable(status: number) {
  return new Response('Retailer handoff is unavailable.', {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isSameOriginFormRequest(request)) {
    return unavailable(403);
  }

  const { domain, id } = await context.params;
  const brand = await prisma.brand.findUnique({
    where: { domain },
    select: { id: true },
  });
  if (!brand) {
    return unavailable(404);
  }

  try {
    const handoff = await recordVerifiedHandoff(prisma, {
      brandId: brand.id,
      retailerId: id,
    });
    const response = NextResponse.redirect(handoff.destination, 303);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    if (error instanceof HandoffError) {
      return unavailable(409);
    }
    console.error('[Retailer Handoff] Unexpected failure.');
    return unavailable(500);
  }
}
