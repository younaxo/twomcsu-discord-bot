import { NextResponse } from 'next/server';
import { prisma, type Prisma } from '@twomcsu/db';
import { paginationQuerySchema } from '@twomcsu/shared';
import { guardRead, isSession } from '@/lib/apiGuard';

// Список участников сервера строится из кэша (обновляется ботом). Кэш используется только
// для отображения — проверка прав доступа к самой панели всегда идёт напрямую через Discord.
export async function GET(request: Request) {
  const guard = await guardRead();
  if (!isSession(guard)) return guard;

  const url = new URL(request.url);
  const query = paginationQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!query.success)
    return NextResponse.json({ error: 'Некорректные параметры' }, { status: 400 });
  const { page, pageSize, search } = query.data;

  const where: Prisma.DiscordMemberCacheWhereInput = search
    ? {
        OR: [
          { discordUserId: { contains: search } },
          { username: { contains: search, mode: 'insensitive' } },
          { globalName: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {};

  const [members, total] = await Promise.all([
    prisma.discordMemberCache.findMany({
      where,
      orderBy: { username: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.discordMemberCache.count({ where }),
  ]);

  const stats = await Promise.all(
    members.map(async (member) => {
      const [ticketCount, ratingAgg] = await Promise.all([
        prisma.ticket.count({ where: { authorId: member.discordUserId, deletedAt: null } }),
        prisma.ticketRating.aggregate({
          where: { staffId: member.discordUserId },
          _avg: { score: true },
          _count: true,
        }),
      ]);
      return {
        ...member,
        ticketCount,
        staffAverageRating: ratingAgg._avg.score,
        staffRatingCount: ratingAgg._count,
      };
    }),
  );

  return NextResponse.json({ items: stats, total, page, pageSize });
}
