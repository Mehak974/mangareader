import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { firstZodMessage } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/request";

const updateSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Display name must be at least 2 characters.")
    .max(50, "Display name is too long.")
    .optional(),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address.")
    .optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(firstZodMessage(parsed.error), 422);
  }

  const data: { displayName?: string; email?: string } = {};
  if (parsed.data.displayName !== undefined) data.displayName = parsed.data.displayName;
  if (parsed.data.email !== undefined) data.email = parsed.data.email;

  if (Object.keys(data).length === 0) {
    return jsonError("Nothing to update.", 422);
  }

  try {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: data,
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        role: true,
      },
    });
    return NextResponse.json({ user: updated });
  } catch (e: any) {
    if (e.code === "P2002" && e.meta?.target?.includes("email")) {
      return jsonError("This email is already in use.", 409);
    }
    return jsonError("Something went wrong.", 500);
  }
}