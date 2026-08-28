import { NextResponse } from 'next/server';
import { botApi, InternalApiError } from '@/lib/internalApi';
import { guardMutation, isSession } from '@/lib/apiGuard';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const guard = await guardMutation(request);
  if (!isSession(guard)) return guard;
  const { id, userId } = await params;

  try {
    await botApi.removeTicketMember(id, guard.discordUserId, userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof InternalApiError ? error.message : 'Не удалось удалить участника';
    return NextResponse.json(
      { error: message },
      { status: error instanceof InternalApiError ? error.status : 502 },
    );
  }
}
