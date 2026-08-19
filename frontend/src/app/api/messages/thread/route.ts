import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const threads = await prisma.contactMessage.findMany({
    where: { email },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      subject: true,
      message: true,
      status: true,
      replies: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ threads });
}
