import { NextResponse } from 'next/server';
import { prisma } from '@twomcsu/db';
import { guardRead, isSession } from '@/lib/apiGuard';

// Транскрипт отдаётся только авторизованным администраторам — никакой публичной постоянной ссылки.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardRead();
  if (!isSession(guard)) return guard;
  const { id } = await params;

  const transcript = await prisma.transcript.findUnique({ where: { ticketId: id } });
  if (!transcript) return NextResponse.json({ error: 'Транскрипт не найден' }, { status: 404 });

  return new NextResponse(transcript.html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-disposition': 'inline',
      'cache-control': 'private, no-store',
    },
  });
}
