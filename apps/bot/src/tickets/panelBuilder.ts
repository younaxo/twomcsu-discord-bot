// Построение сообщений: панель создания тикета (в общем канале) и панель управления тикетом (в канале тикета).
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  type BaseMessageOptions,
} from 'discord.js';
import type { TicketCategory, Ticket } from '@twomcsu/db';

interface PanelData {
  title: string;
  description: string;
  componentType: string;
  categories: TicketCategory[];
}

export function buildTicketPanelMessage(panel: PanelData): BaseMessageOptions {
  const embed = new EmbedBuilder()
    .setTitle(panel.title)
    .setDescription(panel.description)
    .setColor(0x5865f2);

  if (panel.componentType === 'SELECT_MENU') {
    const select = new StringSelectMenuBuilder()
      .setCustomId('ticket:create-select')
      .setPlaceholder('Выберите категорию обращения')
      .addOptions(
        panel.categories.map((category) => ({
          label: category.name,
          value: category.id,
          description: category.description?.slice(0, 100) || undefined,
          emoji: category.emoji || undefined,
        })),
      );
    return {
      embeds: [embed],
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
    };
  }

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < panel.categories.length; i += 5) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (const category of panel.categories.slice(i, i + 5)) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket:create:${category.id}`)
          .setLabel(category.name)
          .setEmoji(category.emoji || '🎫')
          .setStyle(ButtonStyle.Primary),
      );
    }
    rows.push(row);
  }
  return { embeds: [embed], components: rows };
}

/** Панель управления внутри канала тикета — перестраивается при каждой смене статуса. */
export function buildTicketControlMessage(
  ticket: Ticket,
  category: TicketCategory,
): BaseMessageOptions {
  const statusLabel: Record<string, string> = {
    OPEN: '🟢 Открыт',
    CLAIMED: '🟡 В работе',
    CLOSED: '🔴 Закрыт',
  };

  const embed = new EmbedBuilder()
    .setTitle(`Тикет №${ticket.number} — ${category.name}`)
    .setDescription(category.welcomeMessage)
    .addFields(
      { name: 'Статус', value: statusLabel[ticket.status] ?? ticket.status, inline: true },
      { name: 'Автор', value: `<@${ticket.authorId}>`, inline: true },
      ...(ticket.claimedById
        ? [{ name: 'Взял в работу', value: `<@${ticket.claimedById}>`, inline: true }]
        : []),
    )
    .setColor(Number.parseInt(category.color.replace('#', ''), 16) || 0x5865f2);

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  if (ticket.status === 'CLOSED') {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket:reopen:${ticket.id}`)
          .setLabel('Открыть повторно')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🔓'),
        new ButtonBuilder()
          .setCustomId(`ticket:delete-confirm-ask:${ticket.id}`)
          .setLabel('Удалить тикет')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🗑️'),
      ),
    );
  } else {
    const primaryRow = new ActionRowBuilder<ButtonBuilder>();
    if (ticket.status === 'OPEN') {
      primaryRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket:claim:${ticket.id}`)
          .setLabel('Взять в работу')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🙋'),
      );
    }
    primaryRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket:close-modal:${ticket.id}`)
        .setLabel('Закрыть')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔒'),
    );
    rows.push(primaryRow);
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket:addmember:${ticket.id}`)
          .setLabel('Добавить участника')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('➕'),
        new ButtonBuilder()
          .setCustomId(`ticket:removemember:${ticket.id}`)
          .setLabel('Удалить участника')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('➖'),
      ),
    );
  }

  return { embeds: [embed], components: rows };
}

export function buildRatingPromptMessage(ticketId: string): BaseMessageOptions {
  const embed = new EmbedBuilder()
    .setTitle('Оцените работу поддержки')
    .setDescription(
      'Автор тикета может поставить оценку от 1 до 5 звёзд. Это поможет нам стать лучше.',
    )
    .setColor(0xfee75c);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    [1, 2, 3, 4, 5].map((score) =>
      new ButtonBuilder()
        .setCustomId(`ticket:rate:${ticketId}:${score}`)
        .setLabel('⭐'.repeat(score))
        .setStyle(ButtonStyle.Secondary),
    ),
  );

  return { embeds: [embed], components: [row] };
}
