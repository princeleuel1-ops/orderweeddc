import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type ServiceHealth = {
  status: string;
  details?: Record<string, unknown>;
  error?: string;
};

type HealthReport = {
  status: 'HEALTHY' | 'UNHEALTHY';
  timestamp: string;
  services: Record<string, ServiceHealth>;
};

export async function GET() {
  const healthReport: HealthReport = {
    status: 'HEALTHY',
    timestamp: new Date().toISOString(),
    services: {},
  };

  let overallHealthy = true;

  // 1. SQLite database check
  try {
    const [brandCount, totalRetailers, verifiedRetailers] = await Promise.all([
      prisma.brand.count(),
      prisma.retailer.count(),
      prisma.retailer.count({ where: { dataStatus: 'VERIFIED_CURRENT', isDemonstration: false } }),
    ]);
    healthReport.services.database = {
      status: 'UP',
      details: { brandCount, totalRetailers, verifiedRetailers },
    };
  } catch {
    overallHealthy = false;
    healthReport.services.database = {
      status: 'DOWN',
      error: 'Database health check failed.',
    };
  }

  // 2. Runtime execution policy. The product runtime never reads or calls
  // external model credentials.
  healthReport.services.runtime = {
    status: 'DIRECT_LOCAL',
    details: {
      externalModelExecution: false,
      externalModelCredentialInspection: false,
      searchSource: 'AUTHORITATIVE_DATABASE',
      evidenceIntake: 'PUBLIC_REFERENCE_ONLY',
    },
  };

  if (!overallHealthy) {
    healthReport.status = 'UNHEALTHY';
  }

  return NextResponse.json(healthReport, {
    status: overallHealthy ? 200 : 500,
  });
}
