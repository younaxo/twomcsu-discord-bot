import { NextResponse } from 'next/server';
import { botApi, InternalApiError } from '@/lib/internalApi';
import { guardMutation, isSession } from '@/lib/apiGuard';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardMutation(request);
  if (!isSession(guard)) return guard;
  const { id } = await params;

  try {
    const result = await botApi.reopenTicket(id, guard.discordUserId);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof InternalApiError ? error.message : 'Не удалось открыть тикет повторно';
    return NextResponse.json(
      { error: message },
      { status: error instanceof InternalApiError ? error.status : 502 },
    );
  }
}
