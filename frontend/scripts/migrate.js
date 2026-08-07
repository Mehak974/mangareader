const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
  try {
    console.log('Running custom migration...');

    // Add last_active_at to users if not exists
    await prisma.$executeRaw`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_active_at') THEN
          ALTER TABLE "users" ADD COLUMN "last_active_at" TIMESTAMP(3);
        END IF;
      END $$;
    `;
    console.log('✓ Added last_active_at to users');

    // Create page_views table if not exists
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "page_views" (
        "id" TEXT NOT NULL,
        "path" TEXT NOT NULL,
        "user_id" TEXT,
        "referrer" TEXT,
        "user_agent" TEXT,
        "country" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "page_views_pkey" PRIMARY KEY ("id")
      );
    `;
    console.log('✓ Created page_views table');

    // Create indexes
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "page_views_path_created_at_idx" ON "page_views"("path", "created_at")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "page_views_user_id_created_at_idx" ON "page_views"("user_id", "created_at")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "page_views_created_at_idx" ON "page_views"("created_at")`;
    console.log('✓ Created page_views indexes');

    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
