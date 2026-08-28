import { describe, expect, it } from 'vitest';
import { ratingInputSchema, snowflake, ticketCategoryInputSchema } from './schemas.js';

describe('snowflake', () => {
  it('принимает корректный Discord ID', () => {
    expect(snowflake.safeParse('1357356173254459413').success).toBe(true);
  });

  it('отклоняет нечисловые и слишком короткие значения', () => {
    expect(snowflake.safeParse('not-an-id').success).toBe(false);
    expect(snowflake.safeParse('123').success).toBe(false);
  });
});

describe('ratingInputSchema', () => {
  it('принимает оценки от 1 до 5', () => {
    expect(ratingInputSchema.safeParse({ score: 1 }).success).toBe(true);
    expect(ratingInputSchema.safeParse({ score: 5 }).success).toBe(true);
  });

  it('отклоняет оценки вне диапазона и дробные значения', () => {
    expect(ratingInputSchema.safeParse({ score: 0 }).success).toBe(false);
    expect(ratingInputSchema.safeParse({ score: 6 }).success).toBe(false);
    expect(ratingInputSchema.safeParse({ score: 3.5 }).success).toBe(false);
  });
});

describe('ticketCategoryInputSchema', () => {
  const base = {
    name: 'Поддержка',
    emoji: '🎫',
    color: '#5865f2',
    welcomeMessage: 'Опишите проблему',
    discordCategoryId: null,
    parentChannelId: null,
    supportRoleIds: [],
    logChannelId: null,
    transcriptChannelId: null,
  };

  it('принимает корректные данные и подставляет значения по умолчанию', () => {
    const result = ticketCategoryInputSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxActiveTicketsPerUser).toBe(1);
      expect(result.data.isEnabled).toBe(true);
    }
  });

  it('отклоняет некорректный формат цвета', () => {
    expect(ticketCategoryInputSchema.safeParse({ ...base, color: 'blue' }).success).toBe(false);
  });

  it('отклоняет пустое название', () => {
    expect(ticketCategoryInputSchema.safeParse({ ...base, name: '' }).success).toBe(false);
  });
});
