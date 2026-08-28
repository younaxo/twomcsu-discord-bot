import { NextResponse } from 'next/server';
import { addTicketMemberInputSchema } from '@twomcsu/shared';
import { botApi, InternalApiError } from '@/lib/internalApi';
import { guardMutation, isSession } from '@/lib/apiGuard';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardMutation(request);
  if (!isSession(guard)) return guard;
  const { id } = await params;

  const parsed = addTicketMemberInputSchema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json({ error: 'Укажите корректный Discord ID' }, { status: 400 });

  try {
    await botApi.addTicketMember(id, guard.discordUserId, parsed.data.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof InternalApiError ? error.message : 'Не удалось добавить участника';
    return NextResponse.json(
      { error: message },
      { status: error instanceof InternalApiError ? error.status : 502 },
    );
  }
}
