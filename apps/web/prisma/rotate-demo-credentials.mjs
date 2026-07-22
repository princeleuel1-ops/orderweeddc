import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/auth/password.mjs';
import {
  createBootstrapCredentials,
  DEMONSTRATION_ACCOUNTS,
  writeBootstrapCredentialFile,
} from '../src/lib/auth/bootstrap-credentials.mjs';

const prisma = new PrismaClient();

async function assertDemonstrationDatabase() {
  const [
    nonDemonstrationRetailers,
    nonDemonstrationProducts,
    nonDemonstrationMenuEntries,
    nonDemonstrationDeals,
    nonDemonstrationArticles,
    nonDemonstrationEvidence,
    claims,
    disputes,
    users,
  ] = await Promise.all([
    prisma.retailer.count({ where: { isDemonstration: false } }),
    prisma.product.count({ where: { isDemonstration: false } }),
    prisma.menuEntry.count({ where: { isDemonstration: false } }),
    prisma.deal.count({ where: { isDemonstration: false } }),
    prisma.article.count({ where: { isDemonstration: false } }),
    prisma.licenseEvidence.count({ where: { isDemonstration: false } }),
    prisma.claimRequest.count(),
    prisma.dispute.count(),
    prisma.user.findMany({
      select: { id: true, email: true, role: true },
      orderBy: { email: 'asc' },
    }),
  ]);

  const nonDemonstrationRecords =
    nonDemonstrationRetailers +
    nonDemonstrationProducts +
    nonDemonstrationMenuEntries +
    nonDemonstrationDeals +
    nonDemonstrationArticles +
    nonDemonstrationEvidence;
  const expectedAccounts = new Map(
    DEMONSTRATION_ACCOUNTS.map((account) => [account.email, account.role]),
  );
  const accountsAreExact =
    users.length === expectedAccounts.size &&
    users.every(
      (user) => expectedAccounts.get(user.email) === user.role,
    );

  if (
    nonDemonstrationRecords !== 0 ||
    claims !== 0 ||
    disputes !== 0 ||
    !accountsAreExact
  ) {
    throw new Error(
      'Credential rotation refused: the database is not an untouched demonstration dataset.',
    );
  }

  return new Map(users.map((user) => [user.email, user.id]));
}

async function main() {
  const userIds = await assertDemonstrationDatabase();
  const credentials = createBootstrapCredentials();
  const credentialPath = writeBootstrapCredentialFile(credentials);
  const passwordHashes = new Map(
    await Promise.all(
      DEMONSTRATION_ACCOUNTS.map(async (account) => [
        account.email,
        await hashPassword(credentials[account.key].password),
      ]),
    ),
  );

  await prisma.$transaction(async (transaction) => {
    await transaction.session.deleteMany({});
    await transaction.authFailure.deleteMany({});
    for (const account of DEMONSTRATION_ACCOUNTS) {
      await transaction.user.update({
        where: { email: account.email },
        data: { password: passwordHashes.get(account.email) },
      });
      await transaction.auditLog.create({
        data: {
          userId: userIds.get(account.email),
          action: 'ROTATE_DEMONSTRATION_CREDENTIAL',
          details: `role=${account.role}`,
        },
      });
    }
  });

  console.log(
    `Demonstration credentials rotated. Local access details: ${credentialPath}`,
  );
  console.log('No password was printed. Existing sessions were invalidated.');
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
