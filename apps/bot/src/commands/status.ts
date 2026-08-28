import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { prisma } from '@twomcsu/db';
import { formatDuration } from '@twomcsu/shared';
import type { BotCommand } from './types.js';
import { APP_VERSION } from '../version.js';
import { logger } from '../logger.js';

export const statusCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Показать состояние бота и базы данных') as SlashCommandBuilder,
  helpText: 'Показывает время работы, состояние базы данных и версию приложения',
  async execute(interaction) {
    await interaction.deferReply();

    let dbStatus = '🟢 Подключена';
    const dbStart = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      dbStatus = '🔴 Недоступна';
      logger.error({ err: error }, 'Проверка БД для /status завершилась ошибкой');
    }
    const dbLatency = Date.now() - dbStart;

    const embed = new EmbedBuilder()
      .setTitle('📊 Состояние бота')
      .setColor(dbStatus.includes('🟢') ? 0x57f287 : 0xed4245)
      .addFields(
        {
          name: 'Время работы',
          value: formatDuration(interaction.client.uptime ?? 0),
          inline: true,
        },
        {
          name: 'Пинг WebSocket',
          value: `${Math.round(interaction.client.ws.ping)} мс`,
          inline: true,
        },
        {
          name: 'База данных',
          value: dbStatus.includes('🟢') ? `${dbStatus} (${dbLatency} мс)` : dbStatus,
          inline: true,
        },
        { name: 'Серверов', value: String(interaction.client.guilds.cache.size), inline: true },
        { name: 'Версия', value: APP_VERSION, inline: true },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
