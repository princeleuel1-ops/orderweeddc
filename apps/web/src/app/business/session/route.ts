import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleCredentialLogin } from '@/lib/auth/login-handler';

export async function POST(request: NextRequest) {
  return handleCredentialLogin(request, {
    role: 'RETAILER_MANAGER',
    surface: 'BUSINESS',
    successPath: '/business/dashboard',
    failurePath: '/business/login?error=invalid',
    async validateUser(user) {
      if (!user.managedRetailerId) return false;
      const retailer = await prisma.retailer.findUnique({
        where: { id: user.managedRetailerId },
        select: { id: true },
      });
      return retailer !== null;
    },
  });
}
