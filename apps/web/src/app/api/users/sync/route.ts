import { NextResponse } from 'next/server';
import { botApi, InternalApiError } from '@/lib/internalApi';
import { guardMutation, isSession } from '@/lib/apiGuard';

export async function POST(request: Request) {
  const guard = await guardMutation(request);
  if (!isSession(guard)) return guard;

  try {
    const result = await botApi.syncMembers();
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof InternalApiError ? error.message : 'Не удалось синхронизировать участников';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
