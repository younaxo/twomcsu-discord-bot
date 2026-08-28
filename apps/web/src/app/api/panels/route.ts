import { NextResponse } from 'next/server';
import { prisma } from '@twomcsu/db';
import { ticketPanelInputSchema } from '@twomcsu/shared';
import { env } from '@/env';
import { guardMutation, guardRead, isSession } from '@/lib/apiGuard';
import { writeAuditLog } from '@/lib/audit';

export async function GET() {
  const guard = await guardRead();
  if (!isSession(guard)) return guard;

  const panels = await prisma.ticketPanel.findMany({
    orderBy: { createdAt: 'desc' },
    include: { categories: { include: { category: true }, orderBy: { position: 'asc' } } },
  });
  return NextResponse.json(panels);
}

export async function POST(request: Request) {
  const guard = await guardMutation(request);
  if (!isSession(guard)) return guard;

  const parsed = ticketPanelInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Некорректные данные', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { categoryIds, ...panelData } = parsed.data;

  const panel = await prisma.ticketPanel.create({
    data: {
      guildId: env.DISCORD_GUILD_ID,
      createdById: guard.discordUserId,
      ...panelData,
      categories: {
        create: categoryIds.map((categoryId, position) => ({ categoryId, position })),
      },
    },
    include: { categories: { include: { category: true } } },
  });

  await writeAuditLog({
    action: 'PANEL_PUBLISHED',
    actorId: guard.discordUserId,
    targetType: 'PANEL',
    targetId: panel.id,
    metadata: { title: panel.title },
  });

  return NextResponse.json(panel, { status: 201 });
}
