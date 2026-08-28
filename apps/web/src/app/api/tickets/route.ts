import { NextResponse } from 'next/server';
import { prisma, type Prisma } from '@twomcsu/db';
import { paginationQuerySchema } from '@twomcsu/shared';
import { guardRead, isSession } from '@/lib/apiGuard';

export async function GET(request: Request) {
  const guard = await guardRead();
  if (!isSession(guard)) return guard;

  const url = new URL(request.url);
  const query = paginationQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!query.success)
    return NextResponse.json({ error: 'Некорректные параметры' }, { status: 400 });

  const status = url.searchParams.get('status');
  const categoryId = url.searchParams.get('categoryId');
  const { page, pageSize, search } = query.data;

  const where: Prisma.TicketWhereInput = {
    deletedAt: null,
    ...(status && ['OPEN', 'CLAIMED', 'CLOSED'].includes(status)
      ? { status: status as never }
      : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(search
      ? {
          OR: [
            { authorId: { contains: search } },
            { channelId: { contains: search } },
            { number: Number.isNaN(Number(search)) ? undefined : Number(search) },
          ].filter((clause) => Object.values(clause)[0] !== undefined),
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: { category: true, rating: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.ticket.count({ where }),
  ]);

  return NextResponse.json({ items, total, page, pageSize });
}
