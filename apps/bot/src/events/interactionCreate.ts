// Единая точка обработки всех интеракций: slash-команды, кнопки, select-меню, модальные окна.
// Все действия читают состояние из БД, а не из памяти процесса — переживают рестарт бота.
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  type ButtonInteraction,
  type Client,
  type GuildMember,
  type Interaction,
  type ModalSubmitInteraction,
  type RepliableInteraction,
  type StringSelectMenuInteraction,
  type UserSelectMenuInteraction,
} from 'discord.js';
import { prisma, type Ticket, type TicketCategory } from '@twomcsu/db';
import { LIMITS } from '@twomcsu/shared';
import { commands } from '../commands/index.js';
import { logger } from '../logger.js';
import {
  TicketServiceError,
  addTicketMember,
  claimTicket,
  closeTicket,
  createTicket,
  deleteTicket,
  rateTicket,
  removeTicketMember,
  reopenTicket,
  requireSupportAccess,
} from '../tickets/ticketService.js';

async function reply(interaction: RepliableInteraction, content: string) {
  if (interaction.deferred || interaction.replied) {
    await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
  } else {
    await interaction.reply({ content, flags: MessageFlags.Ephemeral });
  }
}

async function loadTicket(
  ticketId: string,
): Promise<{ ticket: Ticket; category: TicketCategory } | null> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { category: true },
  });
  if (!ticket) return null;
  const { category, ...rest } = ticket;
  return { ticket: rest, category };
}

function isStaff(member: GuildMember, category: TicketCategory): boolean {
  return requireSupportAccess(category, member);
}

export async function handleInteraction(client: Client, interaction: Interaction): Promise<void> {
  try {
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
      return;
    }

    if (interaction.isButton()) {
      await handleButton(client, interaction);
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket:create-select') {
      await handleCreateFromCategory(client, interaction.values[0]!, interaction);
      return;
    }

    if (interaction.isUserSelectMenu()) {
      await handleUserSelect(client, interaction);
      return;
    }

    if (interaction.isModalSubmit()) {
      await handleModal(client, interaction);
      return;
    }
  } catch (error) {
    logger.error({ err: error }, 'Ошибка обработки интеракции');
    const message =
      error instanceof TicketServiceError
        ? error.message
        : 'Произошла непредвиденная ошибка. Попробуйте позже.';
    try {
      if (interaction.isRepliable()) await reply(interaction, message);
    } catch {
      // интеракция уже недоступна (истёк срок) — ничего не делаем
    }
  }
}

async function handleCreateFromCategory(
  client: Client,
  categoryId: string,
  interaction: ButtonInteraction | StringSelectMenuInteraction,
) {
  if (!interaction.inCachedGuild()) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const category = await prisma.ticketCategory.findUnique({ where: { id: categoryId } });
  if (!category) {
    await interaction.editReply('Эта категория тикетов больше не существует.');
    return;
  }

  const { channel } = await createTicket(client, interaction.guild, category, interaction.user.id);
  await interaction.editReply(`Тикет создан: ${channel}`);
}

async function handleButton(client: Client, interaction: ButtonInteraction) {
  if (!interaction.customId.startsWith('ticket:')) return;
  const [, action, id, extra] = interaction.customId.split(':');

  if (action === 'create' && id) {
    await handleCreateFromCategory(client, id, interaction);
    return;
  }

  if (!id) return;
  if (!interaction.inCachedGuild()) return;

  if (action === 'delete-confirm-ask') {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket:delete-confirm:${id}`)
        .setLabel('Да, удалить')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`ticket:delete-cancel:${id}`)
        .setLabel('Отмена')
        .setStyle(ButtonStyle.Secondary),
    );
    await interaction.reply({
      content: 'Вы уверены? Канал тикета будет удалён безвозвратно.',
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (action === 'delete-cancel') {
    await interaction.update({ content: 'Удаление отменено.', components: [] });
    return;
  }

  const found = await loadTicket(id);
  if (!found) {
    await reply(interaction, 'Тикет не найден.');
    return;
  }
  const { ticket, category } = found;
  const member = interaction.member;

  switch (action) {
    case 'claim': {
      if (!isStaff(member, category))
        return reply(interaction, 'Только поддержка может брать тикеты в работу.');
      await interaction.deferUpdate();
      await claimTicket(client, ticket, category, interaction.user.id);
      return;
    }
    case 'close-modal': {
      const modal = new ModalBuilder()
        .setCustomId(`ticket:close-submit:${id}`)
        .setTitle('Закрыть тикет')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('reason')
              .setLabel('Причина закрытия')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setMaxLength(LIMITS.CLOSE_REASON_MAX),
          ),
        );
      await interaction.showModal(modal);
      return;
    }
    case 'reopen': {
      if (!isStaff(member, category) && interaction.user.id !== ticket.authorId) {
        return reply(interaction, 'У вас нет прав на повторное открытие этого тикета.');
      }
      await interaction.deferUpdate();
      await reopenTicket(client, ticket, category, interaction.user.id);
      return;
    }
    case 'delete-confirm': {
      if (!isStaff(member, category))
        return reply(interaction, 'Только поддержка может удалять тикеты.');
      await interaction.update({ content: 'Удаляю тикет…', components: [] });
      await deleteTicket(client, ticket, category, interaction.user.id);
      return;
    }
    case 'addmember':
    case 'removemember': {
      if (!isStaff(member, category))
        return reply(interaction, 'Только поддержка может управлять участниками тикета.');
      const select = new UserSelectMenuBuilder()
        .setCustomId(`ticket:${action}-select:${id}`)
        .setPlaceholder(action === 'addmember' ? 'Кого добавить в тикет' : 'Кого убрать из тикета')
        .setMinValues(1)
        .setMaxValues(1);
      await interaction.reply({
        content: 'Выберите пользователя:',
        components: [new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(select)],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    case 'rate': {
      const score = Number(extra);
      if (ticket.authorId !== interaction.user.id)
        return reply(interaction, 'Оценивать может только автор тикета.');
      await interaction.deferUpdate();
      await rateTicket(client, ticket, category, interaction.user.id, score);
      await interaction.followUp({ content: 'Спасибо за оценку!', flags: MessageFlags.Ephemeral });
      return;
    }
    default:
      return;
  }
}

async function handleUserSelect(client: Client, interaction: UserSelectMenuInteraction) {
  const [, action, id] = interaction.customId.split(':');
  if (!id || !interaction.inCachedGuild()) return;

  const found = await loadTicket(id);
  if (!found) return reply(interaction, 'Тикет не найден.');
  const { ticket, category } = found;
  const targetUserId = interaction.values[0]!;

  await interaction.deferUpdate();

  if (action === 'addmember-select') {
    await addTicketMember(client, ticket, category, targetUserId, interaction.user.id);
    await interaction.editReply({
      content: `Пользователь <@${targetUserId}> добавлен в тикет.`,
      components: [],
    });
  } else if (action === 'removemember-select') {
    await removeTicketMember(client, ticket, category, targetUserId, interaction.user.id);
    await interaction.editReply({
      content: `Пользователь <@${targetUserId}> удалён из тикета.`,
      components: [],
    });
  }
}

async function handleModal(client: Client, interaction: ModalSubmitInteraction) {
  const [, action, id] = interaction.customId.split(':');
  if (action !== 'close-submit' || !id || !interaction.inCachedGuild()) return;

  const found = await loadTicket(id);
  if (!found) return reply(interaction, 'Тикет не найден.');
  const { ticket, category } = found;

  if (!isStaff(interaction.member, category) && interaction.user.id !== ticket.authorId) {
    return reply(interaction, 'У вас нет прав на закрытие этого тикета.');
  }

  const reason = interaction.fields.getTextInputValue('reason');
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await closeTicket(client, ticket, category, interaction.user.id, reason);
  await interaction.editReply('Тикет закрыт.');
}
