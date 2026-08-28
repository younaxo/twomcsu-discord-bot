// Double-submit CSRF-защита для изменяющих запросов. SameSite=Lax уже блокирует классическую
// подделку через сторонние формы, но это дополнительный рубеж, который требуют правила безопасности проекта.
import 'server-only';
import { cookies } from 'next/headers';
import { timingSafeEqualString } from './crypto';
import { CSRF_COOKIE } from './session';

export async function verifyCsrf(request: Request): Promise<boolean> {
  const store = await cookies();
  const cookieToken = store.get(CSRF_COOKIE)?.value;
  const headerToken = request.headers.get('x-csrf-token');
  if (!cookieToken || !headerToken) return false;
  return timingSafeEqualString(cookieToken, headerToken);
}
