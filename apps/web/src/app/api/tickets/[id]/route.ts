import { NextResponse } from 'next/server';
import { prisma } from '@twomcsu/db';
import { env } from '@/env';
import { guardMutation, guardRead, isSession } from '@/lib/apiGuard';
import { botApi, InternalApiError } from '@/lib/internalApi';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardRead();
  if (!isSession(guard)) return guard;
  const { id } = await params;

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      category: true,
      members: true,
      rating: true,
      transcript: { select: { id: true, messageCount: true, createdAt: true } },
    },
  });
  if (!ticket) return NextResponse.json({ error: 'Тикет не найден' }, { status: 404 });

  const auditEntries = await prisma.auditLog.findMany({
    where: { targetType: 'TICKET', targetId: id },
    orderBy: { createdAt: 'asc' },
  });

  // Прямая ссылка на канал/ветку в Discord — считаем на сервере, чтобы не отдавать guildId
  // клиенту отдельным полем без необходимости.
  const discordChannelId = ticket.threadId ?? ticket.channelId;
  const discordUrl = discordChannelId
    ? `https://discord.com/channels/${env.DISCORD_GUILD_ID}/${discordChannelId}`
    : null;

  return NextResponse.json({ ticket: { ...ticket, discordUrl }, auditEntries });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardMutation(request);
  if (!isSession(guard)) return guard;
  const { id } = await params;

  try {
    await botApi.deleteTicket(id, guard.discordUserId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof InternalApiError ? error.message : 'Не удалось удалить тикет';
    return NextResponse.json(
      { error: message },
      { status: error instanceof InternalApiError ? error.status : 502 },
    );
  }
}
