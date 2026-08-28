import { NextResponse } from 'next/server';
import { prisma } from '@twomcsu/db';
import { ticketPanelInputSchema } from '@twomcsu/shared';
import { guardMutation, isSession } from '@/lib/apiGuard';
import { writeAuditLog } from '@/lib/audit';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardMutation(request);
  if (!isSession(guard)) return guard;
  const { id } = await params;

  const parsed = ticketPanelInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Некорректные данные', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { categoryIds, ...panelData } = parsed.data;

  const panel = await prisma.$transaction(async (tx) => {
    await tx.ticketPanelCategory.deleteMany({ where: { panelId: id } });
    return tx.ticketPanel.update({
      where: { id },
      data: {
        ...panelData,
        categories: {
          create: categoryIds.map((categoryId, position) => ({ categoryId, position })),
        },
      },
      include: { categories: { include: { category: true } } },
    });
  });

  await writeAuditLog({
    action: 'PANEL_UPDATED',
    actorId: guard.discordUserId,
    targetType: 'PANEL',
    targetId: panel.id,
    metadata: { title: panel.title },
  });

  return NextResponse.json(panel);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardMutation(request);
  if (!isSession(guard)) return guard;
  const { id } = await params;

  await prisma.ticketPanel.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
