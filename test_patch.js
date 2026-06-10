const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get first user
  const user = await prisma.user.findFirst();
  if (!user) { console.log("No user found"); return; }
  
  // Create dummy doc
  const doc = await prisma.document.create({
    data: {
      title: 'Test Doc',
      filename: 'test.pdf',
      fileSize: 100,
      mimeType: 'application/pdf',
      storageKey: 'test.pdf',
      status: 'UPLOADED',
      userId: user.id
    }
  });
  console.log("Created doc:", doc.id);
  
  // Curl patch
  const { execSync } = require('child_process');
  const result = execSync(`curl -s -X PATCH http://localhost:3000/api/documents/${doc.id} -H "Content-Type: application/json" -d '{"status": "READY"}'`);
  console.log("Curl result:", result.toString());
  
  // Delete doc
  await prisma.document.delete({ where: { id: doc.id } });
}
main().catch(console.error).finally(() => prisma.$disconnect());
