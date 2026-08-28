// Небольшие переиспользуемые хелперы без внешних зависимостей.

/** Превращает произвольную строку в безопасное имя Discord-канала (только латиница/цифры/дефис). */
export function slugifyChannelName(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 90) || 'ticket'
  );
}

/** Собирает имя канала тикета по паттерну guild-настроек, например "ticket-{number}". */
export function buildTicketChannelName(
  pattern: string,
  ticketNumber: number,
  categorySlug: string,
): string {
  return pattern
    .replace('{number}', String(ticketNumber))
    .replace('{category}', categorySlug)
    .slice(0, 90);
}

/** Маскирует секреты при выводе в лог: показывает первые 3 и последние 2 символа. */
export function maskSecret(value: string | undefined | null): string {
  if (!value) return '(пусто)';
  if (value.length <= 6) return '***';
  return `${value.slice(0, 3)}***${value.slice(-2)}`;
}

/** Человекочитаемая длительность в формате "2д 3ч 15м". */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}д`);
  if (hours) parts.push(`${hours}ч`);
  if (minutes || parts.length === 0) parts.push(`${minutes}м`);
  return parts.join(' ');
}

/** Экранирует спецсимволы HTML — базовая защита от XSS при рендере транскриптов. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
