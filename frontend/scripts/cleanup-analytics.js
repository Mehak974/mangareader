const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
  try {
    console.log('Dropping analytics tables and indexes...');

    await prisma.$executeRaw`DROP INDEX IF EXISTS "page_views_created_at_idx"`;
    await prisma.$executeRaw`DROP INDEX IF EXISTS "page_views_user_id_created_at_idx"`;
    await prisma.$executeRaw`DROP INDEX IF EXISTS "page_views_path_created_at_idx"`;
    await prisma.$executeRaw`DROP INDEX IF EXISTS "page_views_visitor_id_created_at_idx"`;
    console.log('✓ Dropped page_views indexes');

    await prisma.$executeRaw`DROP TABLE IF EXISTS "page_views" CASCADE`;
    console.log('✓ Dropped page_views table');

    console.log('Cleanup complete!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
