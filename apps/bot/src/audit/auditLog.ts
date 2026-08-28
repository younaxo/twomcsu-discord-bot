// Единая функция записи аудита: пишет в БД и, если настроен канал логов, дублирует в Discord.
import { EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import { prisma } from '@twomcsu/db';
import type { AuditAction } from '@twomcsu/shared';
import { logger } from '../logger.js';

interface AuditEntry {
  action: AuditAction;
  actorId: string;
  actorType?: 'ADMIN' | 'SYSTEM' | 'DISCORD_USER';
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  logChannelId?: string | null;
}

const ACTION_LABELS: Partial<Record<AuditAction, string>> = {
  TICKET_CREATED: 'Тикет создан',
  TICKET_CLAIMED: 'Тикет взят в работу',
  TICKET_UNCLAIMED: 'С тикета снята отметка "в работе"',
  TICKET_CLOSED: 'Тикет закрыт',
  TICKET_REOPENED: 'Тикет открыт повторно',
  TICKET_DELETED: 'Тикет удалён',
  TICKET_MEMBER_ADDED: 'Участник добавлен в тикет',
  TICKET_MEMBER_REMOVED: 'Участник удалён из тикета',
  TICKET_RATED: 'Тикет оценён',
  CATEGORY_CREATED: 'Создана категория тикетов',
  CATEGORY_UPDATED: 'Изменена категория тикетов',
  CATEGORY_DELETED: 'Удалена категория тикетов',
  PANEL_PUBLISHED: 'Опубликована панель создания тикетов',
  PANEL_UPDATED: 'Обновлена панель создания тикетов',
  SETTINGS_UPDATED: 'Изменены настройки',
  ADMIN_LOGIN: 'Вход в панель управления',
  ADMIN_LOGOUT: 'Выход из панели управления',
  ADMIN_ACCESS_REVOKED: 'Доступ к панели отозван',
};

export async function recordAuditLog(client: Client, entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: entry.action,
      actorType: entry.actorType ?? 'ADMIN',
      actorId: entry.actorId,
      targetType: entry.targetType,
      targetId: entry.targetId,
      metadata: entry.metadata as never,
    },
  });

  if (!entry.logChannelId) return;

  try {
    const channel = await client.channels.fetch(entry.logChannelId);
    if (!channel?.isTextBased() || channel.isDMBased()) return;

    const embed = new EmbedBuilder()
      .setDescription(
        `**${ACTION_LABELS[entry.action] ?? entry.action}**\nИсполнитель: <@${entry.actorId}>`,
      )
      .setColor(0x5865f2)
      .setTimestamp();

    if (entry.metadata) {
      const details = Object.entries(entry.metadata)
        .map(([key, value]) => `**${key}:** ${String(value)}`)
        .join('\n');
      if (details) embed.addFields({ name: 'Детали', value: details.slice(0, 1024) });
    }

    await (channel as TextChannel).send({ embeds: [embed] });
  } catch (error) {
    logger.warn(
      { err: error, channelId: entry.logChannelId },
      'Не удалось отправить лог в Discord-канал',
    );
  }
}
