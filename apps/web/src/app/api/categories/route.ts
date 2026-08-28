import { NextResponse } from 'next/server';
import { prisma } from '@twomcsu/db';
import { ticketCategoryInputSchema } from '@twomcsu/shared';
import { env } from '@/env';
import { guardMutation, guardRead, isSession } from '@/lib/apiGuard';
import { writeAuditLog } from '@/lib/audit';

export async function GET() {
  const guard = await guardRead();
  if (!isSession(guard)) return guard;

  const categories = await prisma.ticketCategory.findMany({ orderBy: { createdAt: 'asc' } });
  return NextResponse.json(categories);
}

export async function POST(request: Request) {
  const guard = await guardMutation(request);
  if (!isSession(guard)) return guard;

  const parsed = ticketCategoryInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Некорректные данные', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const category = await prisma.ticketCategory.create({
    data: { guildId: env.DISCORD_GUILD_ID, ...parsed.data },
  });
  await writeAuditLog({
    action: 'CATEGORY_CREATED',
    actorId: guard.discordUserId,
    targetType: 'CATEGORY',
    targetId: category.id,
    metadata: { name: category.name },
  });

  return NextResponse.json(category, { status: 201 });
}
