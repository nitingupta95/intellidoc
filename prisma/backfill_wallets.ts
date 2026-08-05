import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting backfill for user wallets...');
  
  const usersWithoutWallet = await prisma.user.findMany({
    where: {
      creditWallet: null
    },
    select: { id: true }
  });

  console.log(`Found ${usersWithoutWallet.length} users without a wallet.`);

  let createdCount = 0;
  for (const user of usersWithoutWallet) {
    await prisma.creditWallet.create({
      data: {
        userId: user.id,
        balance: 0,
        lifetimeGranted: 0,
        lifetimeSpent: 0
      }
    });
    createdCount++;
  }

  console.log(`Created ${createdCount} wallets. Backfill complete!`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
