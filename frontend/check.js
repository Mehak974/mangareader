const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const users = await prisma.user.findMany();
  console.log('Users:', users.length);
  if (users.length > 0) {
    console.log(users.map(u => u.email));
  }
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
