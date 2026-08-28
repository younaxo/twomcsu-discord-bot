// Discord OAuth2 Authorization Code flow. Scope ограничен identity — членство и роль
// проверяются отдельно через внутренний API бота, а не через данные, присланные браузером.
import 'server-only';
import { env } from '@/env';

const DISCORD_API = 'https://discord.com/api/v10';

export function buildAuthorizeUrl(state: string): string {
  const url = new URL('https://discord.com/oauth2/authorize');
  url.searchParams.set('client_id', env.DISCORD_CLIENT_ID);
  url.searchParams.set('redirect_uri', env.DISCORD_OAUTH_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'identify');
  url.searchParams.set('state', state);
  url.searchParams.set('prompt', 'none');
  return url.toString();
}

interface TokenResponse {
  access_token: string;
  token_type: string;
}

interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}

export async function exchangeCodeForUser(code: string): Promise<DiscordUser> {
  const body = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    client_secret: env.DISCORD_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: env.DISCORD_OAUTH_REDIRECT_URI,
  });

  const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!tokenRes.ok) {
    throw new Error('Не удалось обменять код авторизации на токен Discord');
  }
  const token = (await tokenRes.json()) as TokenResponse;

  const userRes = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { authorization: `${token.token_type} ${token.access_token}` },
  });
  if (!userRes.ok) {
    throw new Error('Не удалось получить профиль пользователя Discord');
  }

  // Отзываем токен сразу — он нам больше не нужен, дальнейшие проверки идут через бота.
  await fetch(`${DISCORD_API}/oauth2/token/revoke`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      token: token.access_token,
    }),
  }).catch(() => undefined);

  return userRes.json() as Promise<DiscordUser>;
}
