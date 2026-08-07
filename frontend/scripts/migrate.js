const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
  try {
    console.log('Running analytics migration...');

    await prisma.$executeRaw`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'page_views' AND column_name = 'visitor_id') THEN
          ALTER TABLE "page_views" ADD COLUMN "visitor_id" TEXT;
        END IF;
      END $$;
    `;
    console.log('✓ Added visitor_id');

    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "page_views_visitor_id_created_at_idx" ON "page_views"("visitor_id", "created_at")`;
    console.log('✓ Added visitor_id index');

    const columns = ['device', 'browser', 'os'];
    for (const col of columns) {
      await prisma.$executeRawUnsafe(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'page_views' AND column_name = '${col}') THEN ALTER TABLE "page_views" ADD COLUMN "${col}" TEXT; END IF; END $$;`);
    }
    console.log('✓ Added device, browser, os columns');

    await prisma.$executeRaw`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'page_views' AND column_name = 'is_pwa') THEN
          ALTER TABLE "page_views" ADD COLUMN "is_pwa" BOOLEAN DEFAULT FALSE;
        END IF;
      END $$;
    `;
    console.log('✓ Added is_pwa column');

    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
