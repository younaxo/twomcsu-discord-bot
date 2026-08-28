// Генерация HTML-транскрипта тикета. Все пользовательские данные экранируются через escapeHtml —
// сообщение с текстом вроде "<script>" не должно исполниться при открытии транскрипта в браузере.
import { Collection, type Message, type TextChannel } from 'discord.js';
import { escapeHtml } from '@twomcsu/shared';

interface TranscriptResult {
  html: string;
  messageCount: number;
}

export async function buildTranscript(
  channel: TextChannel,
  ticketNumber: number,
): Promise<TranscriptResult> {
  const messages = await fetchAllMessages(channel);
  const sorted = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  const rows = sorted
    .map((message) => {
      const author = escapeHtml(message.author.tag ?? message.author.username);
      const avatar = escapeHtml(message.author.displayAvatarURL({ size: 64 }));
      const time = escapeHtml(new Date(message.createdTimestamp).toLocaleString('ru-RU'));
      const content = message.content
        ? `<div class="content">${linkify(escapeHtml(message.content))}</div>`
        : '';
      const attachments = message.attachments
        .map((attachment) => {
          const url = escapeHtml(attachment.url);
          const name = escapeHtml(attachment.name ?? 'файл');
          return `<div class="attachment"><a href="${url}" rel="noopener noreferrer">📎 ${name}</a></div>`;
        })
        .join('');
      const embeds = message.embeds
        .map((embed) => {
          const title = embed.title
            ? `<div class="embed-title">${escapeHtml(embed.title)}</div>`
            : '';
          const description = embed.description
            ? `<div class="embed-description">${escapeHtml(embed.description)}</div>`
            : '';
          return `<div class="embed">${title}${description}</div>`;
        })
        .join('');

      return `
        <div class="message">
          <img class="avatar" src="${avatar}" alt="">
          <div class="body">
            <div class="meta"><span class="author">${author}</span><span class="time">${time}</span></div>
            ${content}${embeds}${attachments}
          </div>
        </div>`;
    })
    .join('\n');

  const html = renderDocument(ticketNumber, channel.name, rows, sorted.length);
  return { html, messageCount: sorted.length };
}

async function fetchAllMessages(channel: TextChannel): Promise<Collection<string, Message<true>>> {
  const collected = new Collection<string, Message<true>>();
  let before: string | undefined;

  // Discord отдаёт максимум 100 сообщений за запрос — листаем историю, пока не закончится канал.
  for (;;) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (batch.size === 0) break;
    for (const [id, message] of batch) collected.set(id, message);
    before = batch.last()?.id;
    if (batch.size < 100) break;
  }

  return collected;
}

function linkify(escapedText: string): string {
  return escapedText.replace(/\n/g, '<br>');
}

function renderDocument(
  ticketNumber: number,
  channelName: string,
  rows: string,
  count: number,
): string {
  const safeChannelName = escapeHtml(channelName);
  const generatedAt = escapeHtml(new Date().toLocaleString('ru-RU'));

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<title>Транскрипт тикета №${ticketNumber}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #1e1f22; color: #dbdee1; margin: 0; padding: 24px; }
  h1 { color: #fff; font-size: 20px; }
  .meta-header { color: #949ba4; font-size: 13px; margin-bottom: 24px; }
  .message { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid #2b2d31; }
  .avatar { width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; }
  .meta { display: flex; gap: 8px; align-items: baseline; margin-bottom: 4px; }
  .author { font-weight: 600; color: #fff; }
  .time { font-size: 11px; color: #949ba4; }
  .content { white-space: pre-wrap; word-break: break-word; }
  .attachment a { color: #00a8fc; text-decoration: none; }
  .embed { border-left: 3px solid #5865f2; background: #2b2d31; padding: 8px 12px; margin-top: 6px; border-radius: 4px; }
  .embed-title { font-weight: 600; color: #fff; }
</style>
</head>
<body>
  <h1>Транскрипт тикета №${ticketNumber} (#${safeChannelName})</h1>
  <div class="meta-header">Сообщений: ${count} · Сформировано: ${generatedAt}</div>
  ${rows || '<p>Сообщений нет.</p>'}
</body>
</html>`;
}
