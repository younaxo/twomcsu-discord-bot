import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { env } from '@/env';
import { exchangeCodeForUser } from '@/lib/discordOAuth';
import { botApi } from '@/lib/internalApi';
import { applySessionCookies, createSession, OAUTH_STATE_COOKIE } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';
import { clientIpFromRequest, isRateLimited } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (isRateLimited(`callback:${clientIpFromRequest(request)}`, 20, 60_000)) {
    return NextResponse.redirect(new URL('/access-denied?reason=rate_limit', env.APP_URL));
  }

  const store = await cookies();
  const expectedState = store.get(OAUTH_STATE_COOKIE)?.value;
  store.delete(OAUTH_STATE_COOKIE);

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL('/access-denied?reason=invalid_state', env.APP_URL));
  }

  try {
    const discordUser = await exchangeCodeForUser(code);
    const membership = await botApi.membership(discordUser.id);

    if (!membership.inGuild || !membership.hasAccessRole) {
      return NextResponse.redirect(new URL('/access-denied?reason=no_access', env.APP_URL));
    }

    const headerList = await headers();
    const token = await createSession(
      discordUser.id,
      clientIpFromRequest(request),
      headerList.get('user-agent'),
    );
    await applySessionCookies(token);
    await writeAuditLog({ action: 'ADMIN_LOGIN', actorId: discordUser.id, notifyDiscord: true });

    return NextResponse.redirect(new URL('/dashboard', env.APP_URL));
  } catch (error) {
    logger.error('Ошибка OAuth callback', error);
    return NextResponse.redirect(new URL('/access-denied?reason=error', env.APP_URL));
  }
}
