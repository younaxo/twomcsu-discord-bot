// Простой rate limiter в памяти процесса (скользящее окно). Для одного инстанса веб-приложения
// этого достаточно; при горизонтальном масштабировании стоит вынести в Redis.
const buckets = new Map<string, number[]>();

export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  timestamps.push(now);
  buckets.set(key, timestamps);
  return timestamps.length > limit;
}

export function clientIpFromRequest(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}
