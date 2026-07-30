import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withRole } from '@/lib/api-guard';

export const POST = withRole("EDITOR", async (req: NextRequest) => {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const { ids, action } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No article IDs provided' }, { status: 400 });
    }

    if (action === 'PUBLISH') {
      await prisma.article.updateMany({
        where: { id: { in: ids } },
        data: { status: 'PUBLISHED', publishedAt: new Date() }
      });
    } else if (action === 'DRAFT') {
      await prisma.article.updateMany({
        where: { id: { in: ids } },
        data: { status: 'DRAFT' }
      });
    } else if (action === 'SCHEDULE') {
      await prisma.article.updateMany({
        where: { id: { in: ids } },
        data: { status: 'SCHEDULED' }
      });
    } else if (action === 'DELETE') {
      await prisma.article.deleteMany({
        where: { id: { in: ids } }
      });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success: true, count: ids.length });
  } catch (err) {
    console.error('Bulk update error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
});
