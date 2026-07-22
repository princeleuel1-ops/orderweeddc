import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import {
  canAccessAdmin,
  canAccessCustomer,
  canManageRetailer,
} from '@/lib/auth/policy.mjs';
import type { AppRole } from '@/lib/auth/credentials';

const SESSION_COOKIE = 'cana_session';
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const MAX_ACTIVE_SESSIONS_PER_USER = 5;

export type AuthSession = {
  userId: string;
  email: string;
  name: string | null;
  role: AppRole;
  managedRetailerId: string | null;
  expiresAt: Date;
};

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function isAppRole(role: string): role is AppRole {
  return role === 'ADMIN' || role === 'RETAILER_MANAGER' || role === 'CUSTOMER';
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date();
  expiresAt.setTime(expiresAt.getTime() + SESSION_DURATION_MS);

  await prisma.$transaction(async (transaction) => {
    const now = new Date();
    await transaction.session.deleteMany({
      where: { expiresAt: { lte: now } },
    });

    const surplusSessions = await transaction.session.findMany({
      where: { userId, expiresAt: { gt: now } },
      select: { id: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: MAX_ACTIVE_SESSIONS_PER_USER - 1,
    });
    if (surplusSessions.length > 0) {
      await transaction.session.deleteMany({
        where: { id: { in: surplusSessions.map(({ id }) => id) } },
      });
    }

    await transaction.session.create({
      data: {
        tokenHash: hashToken(token),
        userId,
        expiresAt,
      },
    });
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.session.deleteMany({
      where: { tokenHash: hashToken(token) },
    });
  }

  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<AuthSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          managedRetailerId: true,
        },
      },
    },
  });

  if (!session || session.expiresAt <= new Date() || !isAppRole(session.user.role)) {
    return null;
  }

  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    managedRetailerId: session.user.managedRetailerId,
    expiresAt: session.expiresAt,
  };
}

export async function requireAdmin(redirectTo = '/admin/login'): Promise<AuthSession> {
  const session = await getSession();
  if (!session || !canAccessAdmin(session)) {
    redirect(redirectTo);
  }
  return session;
}

export async function requireCustomer(
  redirectTo = '/customer/login',
): Promise<AuthSession> {
  const session = await getSession();
  if (!session || !canAccessCustomer(session)) {
    redirect(redirectTo);
  }
  return session;
}

export async function assertAdmin(): Promise<AuthSession> {
  const session = await getSession();
  if (!session || !canAccessAdmin(session)) {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function requireRetailerManager(
  redirectTo = '/business/login',
): Promise<AuthSession> {
  const session = await getSession();
  if (
    session?.role !== 'RETAILER_MANAGER' ||
    !session.managedRetailerId
  ) {
    redirect(redirectTo);
  }
  return session;
}

export async function assertRetailerManager(retailerId: string): Promise<AuthSession> {
  const session = await getSession();
  if (!session || !canManageRetailer(session, retailerId)) {
    throw new Error('Forbidden');
  }
  return session;
}
