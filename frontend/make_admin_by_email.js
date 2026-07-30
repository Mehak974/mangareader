const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = "admin@mangareader.pro";
  const updatedUser = await prisma.user.update({
    where: { email: email },
    data: { role: 'ADMIN' },
  });

  console.log(`✅ Success! The user "${updatedUser.displayName}" (${updatedUser.email}) has been promoted to ADMIN.`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
