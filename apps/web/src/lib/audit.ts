// Запись аудита действий, выполненных из веб-панели. Пишем в БД синхронно (это источник
// правды для раздела "Логи"), а дублирование в Discord — best-effort и не блокирует ответ.
import { prisma } from '@twomcsu/db';
import type { AuditAction } from '@twomcsu/shared';
import { botApi } from './internalApi';

const ACTION_LABELS: Partial<Record<AuditAction, string>> = {
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

interface AuditParams {
  action: AuditAction;
  actorId: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  notifyDiscord?: boolean;
}

export async function writeAuditLog(params: AuditParams): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: params.action,
      actorType: 'ADMIN',
      actorId: params.actorId,
      targetType: params.targetType,
      targetId: params.targetId,
      metadata: params.metadata as never,
    },
  });

  if (params.notifyDiscord !== false) {
    const label = ACTION_LABELS[params.action] ?? params.action;
    const details = params.metadata
      ? Object.entries(params.metadata)
          .map(([key, value]) => `**${key}:** ${String(value)}`)
          .join('\n')
      : undefined;
    void botApi.notifyAudit(params.actorId, label, details);
  }
}
