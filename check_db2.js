const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const docs = await prisma.document.findMany({ orderBy: { createdAt: 'desc' }, take: 5 });
  console.log("Recent documents:", docs);
}
main().catch(console.error).finally(() => prisma.$disconnect());
