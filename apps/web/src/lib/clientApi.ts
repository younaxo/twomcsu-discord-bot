// Хелпер для клиентских fetch-запросов к нашему API: подставляет CSRF-токен из cookie.
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const csrfToken = document.cookie
    .split('; ')
    .find((row) => row.startsWith('twomcsu_csrf='))
    ?.split('=')[1];

  return fetch(input, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': csrfToken ?? '',
      ...init.headers,
    },
  });
}
