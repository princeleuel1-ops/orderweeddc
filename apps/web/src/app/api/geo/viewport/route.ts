/**
 * GET /api/geo/viewport?south=&west=&north=&east=&kind=
 *
 * Viewport-scoped geo entity read for the customer map. Returns canonical
 * CANA geo entities inside the bounding box, evidence-gated:
 *
 *  - geometry comes from PostGIS via the typed geo repository (the only
 *    module allowed raw spatial SQL) — never computed in application code
 *  - only claims passing the eligibility gate are attached
 *  - result size is bounded; the client never receives an unbounded dump
 *
 * At low zoom (large boxes) callers should use /api/geo/cells (H3 parent
 * aggregation) instead of individual entities; this route enforces an area
 * ceiling to make the cheap path the only working path for huge viewports.
 */
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { findEntitiesInViewport } from '@/lib/geo/geo-repository.mjs';

const globalForPrisma = globalThis as unknown as { canaPrisma?: PrismaClient };
const prisma = globalForPrisma.canaPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.canaPrisma = prisma;

/** Reject viewports larger than roughly the DC metro area (~1.0 deg^2). */
const MAX_VIEWPORT_AREA_DEG2 = 1.0;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const south = Number(params.get('south'));
  const west = Number(params.get('west'));
  const north = Number(params.get('north'));
  const east = Number(params.get('east'));
  const kind = params.get('kind') ?? undefined;

  if (![south, west, north, east].every(Number.isFinite)) {
    return NextResponse.json(
      { error: 'south, west, north, east are required finite numbers' },
      { status: 400 },
    );
  }
  const area = Math.abs(north - south) * Math.abs(east - west);
  if (area > MAX_VIEWPORT_AREA_DEG2) {
    return NextResponse.json(
      { error: 'viewport too large; use /api/geo/cells for aggregated views' },
      { status: 400 },
    );
  }

  const startedAt = Date.now();
  try {
    const entities = await findEntitiesInViewport(prisma, {
      south,
      west,
      north,
      east,
      kind,
      limit: 200,
    });
    return NextResponse.json(
      {
        entities,
        meta: {
          count: Array.isArray(entities) ? entities.length : 0,
          bounded: true,
          latencyMs: Date.now() - startedAt,
        },
      },
      {
        headers: {
          // Viewport reads are cacheable briefly; geographic truth does not
          // change per-second, and this shields the database from pan-storms.
          'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
        },
      },
    );
  } catch (error) {
    // Never leak SQL or connection details to the public surface.
    return NextResponse.json({ error: 'geo query failed' }, { status: 500 });
  }
}
