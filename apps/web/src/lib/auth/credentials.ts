import 'server-only';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth/password.mjs';

// A valid, non-secret scrypt record used only to equalize work for unknown
// accounts. It is intentionally unrelated to every real account credential.
const DUMMY_PASSWORD_HASH =
  'scrypt$16384$8$1$sSChzYWtcDlqI_1aOxq-oA$N1jXUmhmmIH81rQSZvn0JQ6QbaYFayh0MLmhUiYG5PkY8cMy0JDDfkdIKWAYQCnGJ2_K4efobBQO1HS4M0dAqg';

export type AppRole = 'ADMIN' | 'RETAILER_MANAGER' | 'CUSTOMER';

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string | null;
  role: AppRole;
  managedRetailerId: string | null;
};

function isAppRole(role: string): role is AppRole {
  return role === 'ADMIN' || role === 'RETAILER_MANAGER' || role === 'CUSTOMER';
}

export async function authenticateCredentials(
  email: string,
  password: string,
  requiredRole: AppRole,
): Promise<AuthenticatedUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (
    !normalizedEmail ||
    normalizedEmail.length > 254 ||
    !password ||
    password.length > 256
  ) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      password: true,
      name: true,
      role: true,
      managedRetailerId: true,
    },
  });

  const passwordMatches = await verifyPassword(
    password,
    user?.password ?? DUMMY_PASSWORD_HASH,
  );
  if (
    !user ||
    user.role !== requiredRole ||
    !isAppRole(user.role) ||
    !passwordMatches
  ) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    managedRetailerId: user.managedRetailerId,
  };
}
