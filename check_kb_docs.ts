import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const convs = await prisma.conversation.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
    include: {
      messages: true
    }
  });
  console.log(JSON.stringify(convs.map(c => ({id: c.id, metadata: c.metadata, messages: c.messages.map(m => m.content)})), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
