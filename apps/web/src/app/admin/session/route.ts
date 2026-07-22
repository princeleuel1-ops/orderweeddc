import type { NextRequest } from 'next/server';
import { handleCredentialLogin } from '@/lib/auth/login-handler';

export async function POST(request: NextRequest) {
  return handleCredentialLogin(request, {
    role: 'ADMIN',
    surface: 'ADMIN',
    successPath: '/admin',
    failurePath: '/admin/login?error=invalid',
  });
}
