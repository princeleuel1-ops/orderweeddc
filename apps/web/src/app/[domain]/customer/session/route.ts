import type { NextRequest } from 'next/server';
import { handleCredentialLogin } from '@/lib/auth/login-handler';

export async function POST(request: NextRequest) {
  return handleCredentialLogin(request, {
    role: 'CUSTOMER',
    surface: 'CUSTOMER',
    successPath: '/wallet',
    failurePath: '/customer/login?error=invalid',
  });
}
