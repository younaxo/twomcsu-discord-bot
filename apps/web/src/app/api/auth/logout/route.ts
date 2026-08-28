import { NextResponse } from 'next/server';
import { env } from '@/env';
import { requireSession, revokeCurrentSession } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';
import { verifyCsrf } from '@/lib/csrf';

export async function POST(request: Request) {
  if (!(await verifyCsrf(request))) {
    return NextResponse.json({ error: 'Недействительный CSRF-токен' }, { status: 403 });
  }

  const session = await requireSession();
  await revokeCurrentSession('Выход из панели');
  if (session) {
    await writeAuditLog({
      action: 'ADMIN_LOGOUT',
      actorId: session.discordUserId,
      notifyDiscord: true,
    });
  }

  return NextResponse.redirect(new URL('/login', env.APP_URL));
}
