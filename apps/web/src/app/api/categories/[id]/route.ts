import { NextResponse } from 'next/server';
import { prisma } from '@twomcsu/db';
import { ticketCategoryInputSchema } from '@twomcsu/shared';
import { guardMutation, isSession } from '@/lib/apiGuard';
import { writeAuditLog } from '@/lib/audit';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardMutation(request);
  if (!isSession(guard)) return guard;
  const { id } = await params;

  const parsed = ticketCategoryInputSchema.partial().safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Некорректные данные', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const category = await prisma.ticketCategory.update({ where: { id }, data: parsed.data });
  await writeAuditLog({
    action: 'CATEGORY_UPDATED',
    actorId: guard.discordUserId,
    targetType: 'CATEGORY',
    targetId: id,
    metadata: { name: category.name },
  });

  return NextResponse.json(category);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardMutation(request);
  if (!isSession(guard)) return guard;
  const { id } = await params;

  const category = await prisma.ticketCategory.findUnique({ where: { id } });
  if (!category) return NextResponse.json({ error: 'Категория не найдена' }, { status: 404 });

  const activeTickets = await prisma.ticket.count({
    where: { categoryId: id, status: { in: ['OPEN', 'CLAIMED'] } },
  });
  if (activeTickets > 0) {
    return NextResponse.json(
      { error: 'Нельзя удалить категорию, пока в ней есть открытые тикеты' },
      { status: 409 },
    );
  }

  await prisma.ticketCategory.delete({ where: { id } });
  await writeAuditLog({
    action: 'CATEGORY_DELETED',
    actorId: guard.discordUserId,
    targetType: 'CATEGORY',
    targetId: id,
    metadata: { name: category.name },
  });

  return NextResponse.json({ ok: true });
}
