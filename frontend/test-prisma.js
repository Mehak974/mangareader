const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const user = await prisma.user.findFirst();
    if (!user) return console.log('no user');
    console.log("Found user:", user.id);

    const note = await prisma.mangaNote.upsert({
      where: { userId_mangaId: { userId: user.id, mangaId: '128067' } },
      update: { content: 'test' },
      create: { userId: user.id, mangaId: '128067', content: 'test' }
    });
    console.log("Upsert result:", note);
  } catch (e) {
    console.error('Prisma Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
