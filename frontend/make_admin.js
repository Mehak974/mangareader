const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find the first user in the database
  const user = await prisma.user.findFirst();

  if (!user) {
    console.log("❌ No users found in the database. Please sign up on the website first, then run this script again.");
    return;
  }

  // Update the user to have the ADMIN role
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { role: 'ADMIN' },
  });

  console.log(`✅ Success! The user "${updatedUser.displayName}" has been promoted to ADMIN.`);
  console.log(`Email/Provider ID: ${updatedUser.id}`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
