// Права доступа к каналу тикета: автор + роли поддержки + бот, @everyone доступа не имеет.
import {
  OverwriteType,
  PermissionFlagsBits,
  type Guild,
  type OverwriteResolvable,
} from 'discord.js';

const TICKET_VIEW_PERMISSIONS =
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.ReadMessageHistory |
  PermissionFlagsBits.AttachFiles |
  PermissionFlagsBits.EmbedLinks;

export function buildTicketOverwrites(
  guild: Guild,
  authorId: string,
  supportRoleIds: string[],
): OverwriteResolvable[] {
  const overwrites: OverwriteResolvable[] = [
    {
      id: guild.roles.everyone.id,
      type: OverwriteType.Role,
      deny: PermissionFlagsBits.ViewChannel,
    },
    {
      id: authorId,
      type: OverwriteType.Member,
      allow: TICKET_VIEW_PERMISSIONS,
    },
    {
      id: guild.client.user.id,
      type: OverwriteType.Member,
      allow:
        TICKET_VIEW_PERMISSIONS |
        PermissionFlagsBits.ManageChannels |
        PermissionFlagsBits.ManageMessages,
    },
  ];

  for (const roleId of supportRoleIds) {
    // Роль могла быть удалена с сервера уже после сохранения в категории — пропускаем такие.
    if (guild.roles.cache.has(roleId)) {
      overwrites.push({ id: roleId, type: OverwriteType.Role, allow: TICKET_VIEW_PERMISSIONS });
    }
  }

  return overwrites;
}

/** После закрытия автор теряет право писать, но сохраняет право читать (для истории и оценки). */
export function readOnlyOverwriteForAuthor(authorId: string): OverwriteResolvable {
  return {
    id: authorId,
    type: OverwriteType.Member,
    allow: PermissionFlagsBits.ViewChannel | PermissionFlagsBits.ReadMessageHistory,
    deny: PermissionFlagsBits.SendMessages,
  };
}
