// Валидация переменных окружения веб-приложения при старте процесса.
import { z } from 'zod';

const envSchema = z.object({
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_CLIENT_SECRET: z.string().min(1),
  DISCORD_OAUTH_REDIRECT_URI: z.string().url(),
  DISCORD_GUILD_ID: z.string().min(1),
  DISCORD_PANEL_ACCESS_ROLE_ID: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET должен быть не короче 32 символов'),
  ENCRYPTION_KEY: z.string().min(32),
  INTERNAL_API_SECRET: z.string().min(16),
  INTERNAL_API_URL: z.string().url(),
  APP_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
});

export const env = envSchema.parse(process.env);
