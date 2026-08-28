import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { randomToken } from '@/lib/crypto';
import { buildAuthorizeUrl } from '@/lib/discordOAuth';
import { OAUTH_STATE_COOKIE } from '@/lib/session';
import { clientIpFromRequest, isRateLimited } from '@/lib/rateLimit';

export async function GET(request: Request) {
  if (isRateLimited(`login:${clientIpFromRequest(request)}`, 20, 60_000)) {
    return NextResponse.json(
      { error: 'Слишком много попыток входа. Попробуйте позже.' },
      { status: 429 },
    );
  }

  const state = randomToken(16);
  const store = await cookies();
  store.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 300,
  });

  return NextResponse.redirect(buildAuthorizeUrl(state));
}
