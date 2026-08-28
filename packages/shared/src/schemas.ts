// Zod-схемы для валидации данных на границе API (веб-панель) и при обработке команд/интеракций (бот).
import { z } from 'zod';
import { LIMITS, PANEL_COMPONENT_TYPE } from './constants.js';

/** Discord snowflake ID — строка из 17–20 цифр. */
export const snowflake = z.string().regex(/^\d{17,20}$/, 'Некорректный Discord ID');

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Цвет должен быть в формате #RRGGBB');

export const emojiSchema = z
  .string()
  .trim()
  .min(1, 'Укажите emoji')
  .max(64, 'Слишком длинное значение emoji');

export const ticketCategoryInputSchema = z.object({
  name: z.string().trim().min(1, 'Укажите название категории').max(LIMITS.CATEGORY_NAME_MAX),
  description: z.string().trim().max(LIMITS.CATEGORY_DESCRIPTION_MAX).default(''),
  emoji: emojiSchema,
  color: hexColorSchema,
  welcomeMessage: z
    .string()
    .trim()
    .min(1, 'Укажите приветственное сообщение')
    .max(LIMITS.WELCOME_MESSAGE_MAX),
  discordCategoryId: snowflake.nullable(),
  /// Родительский текстовый канал, в котором создаются приватные ветки новых тикетов.
  parentChannelId: snowflake.nullable(),
  /// Автоархивация ветки — Discord принимает только эти четыре значения (в минутах).
  autoArchiveMinutes: z.union([z.literal(60), z.literal(1440), z.literal(4320), z.literal(10080)]).default(4320),
  supportRoleIds: z.array(snowflake).max(20, 'Слишком много ролей поддержки'),
  logChannelId: snowflake.nullable(),
  transcriptChannelId: snowflake.nullable(),
  maxActiveTicketsPerUser: z
    .number()
    .int()
    .min(1)
    .max(LIMITS.MAX_ACTIVE_TICKETS_PER_USER_CEILING)
    .default(LIMITS.MAX_ACTIVE_TICKETS_PER_USER_DEFAULT),
  isEnabled: z.boolean().default(true),
});
export type TicketCategoryInput = z.infer<typeof ticketCategoryInputSchema>;

export const ticketPanelInputSchema = z.object({
  channelId: snowflake,
  title: z.string().trim().min(1, 'Укажите заголовок панели').max(256),
  description: z.string().trim().min(1, 'Укажите описание панели').max(4000),
  componentType: z.enum(PANEL_COMPONENT_TYPE),
  categoryIds: z.array(z.string().cuid()).min(1, 'Выберите хотя бы одну категорию').max(25),
});
export type TicketPanelInput = z.infer<typeof ticketPanelInputSchema>;

export const closeTicketInputSchema = z.object({
  reason: z.string().trim().min(1, 'Укажите причину закрытия').max(LIMITS.CLOSE_REASON_MAX),
});
export type CloseTicketInput = z.infer<typeof closeTicketInputSchema>;

export const ratingInputSchema = z.object({
  score: z.number().int().min(LIMITS.RATING_MIN).max(LIMITS.RATING_MAX),
  comment: z.string().trim().max(500).optional(),
});
export type RatingInput = z.infer<typeof ratingInputSchema>;

export const addTicketMemberInputSchema = z.object({
  userId: snowflake,
});
export type AddTicketMemberInput = z.infer<typeof addTicketMemberInputSchema>;

export const guildSettingsInputSchema = z.object({
  defaultLogChannelId: snowflake.nullable(),
  defaultTranscriptChannelId: snowflake.nullable(),
  ticketNamePattern: z
    .string()
    .trim()
    .min(1)
    .max(LIMITS.CHANNEL_NAME_MAX)
    .regex(/^[a-z0-9\-{}]+$/, 'Разрешены латиница, цифры, дефис и плейсхолдеры вида {number}'),
});
export type GuildSettingsInput = z.infer<typeof guildSettingsInputSchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
