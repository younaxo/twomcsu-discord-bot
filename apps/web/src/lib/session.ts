// Серверные сессии администратора. Токен сессии живёт только в HttpOnly cookie — в БД
// хранится лишь его sha256-хэш, поэтому утечка базы не даёт готовых токенов для входа.
import 'server-only';
import { cookies } from 'next/headers';
import { prisma } from '@twomcsu/db';
import { LIMITS } from '@twomcsu/shared';
import { randomToken, sha256hex } from './crypto';
import { botApi } from './internalApi';

export const SESSION_COOKIE = 'twomcsu_session';
export const CSRF_COOKIE = 'twomcsu_csrf';
export const OAUTH_STATE_COOKIE = 'twomcsu_oauth_state';

const cookieBaseOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
};

export interface SessionUser {
  discordUserId: string;
  sessionId: string;
}

export async function createSession(
  discordUserId: string,
  ipAddress: string | null,
  userAgent: string | null,
): Promise<string> {
  const token = randomToken(32);
  const tokenHash = sha256hex(token);
  const expiresAt = new Date(Date.now() + LIMITS.SESSION_TTL_HOURS * 60 * 60 * 1000);

  await prisma.adminSession.create({
    data: { discordUserId, tokenHash, ipAddress, userAgent, expiresAt },
  });

  return token;
}

/** Вызывается только из Route Handler — там разрешена запись cookie. */
export async function applySessionCookies(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    ...cookieBaseOptions,
    maxAge: LIMITS.SESSION_TTL_HOURS * 3600,
  });
  // CSRF-cookie читается клиентским JS для double-submit защиты, поэтому не HttpOnly.
  store.set(CSRF_COOKIE, randomToken(16), {
    ...cookieBaseOptions,
    httpOnly: false,
    maxAge: LIMITS.SESSION_TTL_HOURS * 3600,
  });
}

export async function clearSessionCookies() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(CSRF_COOKIE);
}

/**
 * Проверяет текущую сессию. Раз в SESSION_REVALIDATE_MINUTES заново спрашивает у бота
 * членство в сервере и наличие роли доступа — если пользователь потерял роль или вышел
 * с сервера, сессия немедленно отзывается независимо от того, что записано в cookie.
 */
export async function requireSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = sha256hex(token);
  const session = await prisma.adminSession.findUnique({ where: { tokenHash } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;

  const staleMs = Date.now() - session.lastSeenAt.getTime();
  if (staleMs > LIMITS.SESSION_REVALIDATE_MINUTES * 60 * 1000) {
    const membership = await botApi.membership(session.discordUserId).catch(() => null);
    if (!membership || !membership.inGuild || !membership.hasAccessRole) {
      await prisma.adminSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date(), revokedReason: 'Потеряна роль доступа или выход с сервера' },
      });
      await prisma.auditLog.create({
        data: {
          action: 'ADMIN_ACCESS_REVOKED',
          actorType: 'SYSTEM',
          actorId: session.discordUserId,
          targetType: 'SESSION',
          targetId: session.id,
        },
      });
      return null;
    }
    await prisma.adminSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });
  }

  return { discordUserId: session.discordUserId, sessionId: session.id };
}

export async function revokeCurrentSession(reason: string): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.adminSession.updateMany({
      where: { tokenHash: sha256hex(token), revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }
  await clearSessionCookies();
}
