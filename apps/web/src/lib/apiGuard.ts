// Общие проверки для Route Handler'ов: сессия обязательна везде, CSRF — на изменяющих запросах.
import 'server-only';
import { NextResponse } from 'next/server';
import { requireSession, type SessionUser } from './session';
import { verifyCsrf } from './csrf';

export async function guardRead(): Promise<SessionUser | NextResponse> {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
  return session;
}

export async function guardMutation(request: Request): Promise<SessionUser | NextResponse> {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
  if (!(await verifyCsrf(request))) {
    return NextResponse.json({ error: 'Недействительный CSRF-токен' }, { status: 403 });
  }
  return session;
}

export function isSession(value: SessionUser | NextResponse): value is SessionUser {
  return 'discordUserId' in value;
}
