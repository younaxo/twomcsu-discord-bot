import { describe, expect, it } from 'vitest';
import { buildTicketChannelName, escapeHtml, formatDuration, maskSecret, slugifyChannelName } from './utils.js';

describe('slugifyChannelName', () => {
  it('приводит к нижнему регистру и заменяет пробелы на дефисы', () => {
    expect(slugifyChannelName('Общие вопросы')).toBe('ticket');
  });

  it('оставляет только латиницу и цифры', () => {
    expect(slugifyChannelName('Billing Support 2024')).toBe('billing-support-2024');
  });

  it('не оставляет висячие дефисы', () => {
    expect(slugifyChannelName('  --Hello World--  ')).toBe('hello-world');
  });

  it('возвращает "ticket" для пустой строки', () => {
    expect(slugifyChannelName('')).toBe('ticket');
  });
});

describe('buildTicketChannelName', () => {
  it('подставляет номер и категорию по плейсхолдерам', () => {
    expect(buildTicketChannelName('ticket-{number}', 42, 'billing')).toBe('ticket-42');
    expect(buildTicketChannelName('{category}-{number}', 7, 'billing')).toBe('billing-7');
  });

  it('обрезает результат до 90 символов', () => {
    const long = 'a'.repeat(200);
    expect(buildTicketChannelName(long, 1, 'x').length).toBeLessThanOrEqual(90);
  });
});

describe('maskSecret', () => {
  it('маскирует середину значения', () => {
    expect(maskSecret('supersecretvalue')).toBe('sup***ue');
  });

  it('полностью скрывает короткие значения', () => {
    expect(maskSecret('abcdef')).toBe('***');
  });

  it('обрабатывает пустое значение', () => {
    expect(maskSecret(undefined)).toBe('(пусто)');
    expect(maskSecret(null)).toBe('(пусто)');
  });
});

describe('formatDuration', () => {
  it('форматирует минуты', () => {
    expect(formatDuration(5 * 60 * 1000)).toBe('5м');
  });

  it('форматирует часы и минуты', () => {
    expect(formatDuration(90 * 60 * 1000)).toBe('1ч 30м');
  });

  it('форматирует дни, часы и минуты', () => {
    expect(formatDuration((24 * 60 + 61) * 60 * 1000)).toBe('1д 1ч 1м');
  });

  it('показывает 0м для нулевой длительности', () => {
    expect(formatDuration(0)).toBe('0м');
  });
});

describe('escapeHtml', () => {
  it('экранирует спецсимволы, защищая транскрипты от XSS', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(escapeHtml(`"quoted" & 'single'`)).toBe('&quot;quoted&quot; &amp; &#39;single&#39;');
  });
});
