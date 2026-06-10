const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const doc = await prisma.document.findUnique({ where: { id: "cmq6f0k86000grwxhppv5ull6" } });
  console.log("Found document:", doc);
}
main().catch(console.error).finally(() => prisma.$disconnect());
