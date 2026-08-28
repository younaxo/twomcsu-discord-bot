import { NextResponse } from 'next/server';
import { closeTicketInputSchema } from '@twomcsu/shared';
import { botApi, InternalApiError } from '@/lib/internalApi';
import { guardMutation, isSession } from '@/lib/apiGuard';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardMutation(request);
  if (!isSession(guard)) return guard;
  const { id } = await params;

  const parsed = closeTicketInputSchema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json({ error: 'Укажите причину закрытия' }, { status: 400 });

  try {
    const result = await botApi.closeTicket(id, guard.discordUserId, parsed.data.reason);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof InternalApiError ? error.message : 'Не удалось закрыть тикет';
    return NextResponse.json(
      { error: message },
      { status: error instanceof InternalApiError ? error.status : 502 },
    );
  }
}
