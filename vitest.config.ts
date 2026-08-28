import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/src/**/*.test.ts', 'apps/**/src/**/*.test.ts'],
    environment: 'node',
    // Импорт модулей бота триггерит валидацию env.ts — подсовываем фиктивные значения,
    // реальные секреты в тестах не нужны и не используются.
    env: {
      DISCORD_BOT_TOKEN: 'test-token',
      DISCORD_APPLICATION_ID: '1',
      DISCORD_GUILD_ID: '1',
      DISCORD_PANEL_ACCESS_ROLE_ID: '1',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      INTERNAL_API_SECRET: 'test-secret-value',
    },
  },
});
