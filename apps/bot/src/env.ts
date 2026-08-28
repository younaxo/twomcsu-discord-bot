// Валидация переменных окружения при старте. Если чего-то не хватает — падаем сразу,
// а не после первого взаимодействия пользователя с ботом.
import { z } from 'zod';

const envSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1, 'DISCORD_BOT_TOKEN обязателен'),
  DISCORD_APPLICATION_ID: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1),
  DISCORD_PANEL_ACCESS_ROLE_ID: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  INTERNAL_API_SECRET: z.string().min(16, 'INTERNAL_API_SECRET должен быть не короче 16 символов'),
  INTERNAL_API_PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
});

export const env = envSchema.parse(process.env);
