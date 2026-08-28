// Вся бизнес-логика жизненного цикла тикета. Действия из Discord (кнопки) и из веб-панели
// (через внутреннее API) проходят через одни и те же функции — единая точка правды.
import {
  ChannelType,
  PermissionFlagsBits,
  type Client,
  type Guild,
  type TextChannel,
} from 'discord.js';
import { prisma, type Ticket, type TicketCategory } from '@twomcsu/db';
import { buildTicketChannelName, slugifyChannelName } from '@twomcsu/shared';
import { buildTicketControlMessage, buildRatingPromptMessage } from './panelBuilder.js';
import { buildTicketOverwrites } from './permissions.js';
import { buildTranscript } from './transcriptBuilder.js';
import { recordAuditLog } from '../audit/auditLog.js';
import { withLock } from '../util/asyncLock.js';
import { logger } from '../logger.js';

export class TicketServiceError extends Error {}

async function getGuildSettings(guildId: string) {
  return prisma.guildSettings.upsert({
    where: { guildId },
    update: {},
    create: { guildId },
  });
}

export async function createTicket(
  client: Client,
  guild: Guild,
  category: TicketCategory,
  authorId: string,
): Promise<{ ticket: Ticket; channel: TextChannel }> {
  return withLock(`create:${guild.id}:${authorId}:${category.id}`, async () => {
    if (!category.isEnabled) {
      throw new TicketServiceError('Эта категория тикетов сейчас недоступна.');
    }

    const activeCount = await prisma.ticket.count({
      where: {
        categoryId: category.id,
        authorId,
        status: { in: ['OPEN', 'CLAIMED'] },
        deletedAt: null,
      },
    });
    if (activeCount >= category.maxActiveTicketsPerUser) {
      throw new TicketServiceError(
        `У вас уже открыто максимальное число тикетов в этой категории (${category.maxActiveTicketsPerUser}). Закройте существующий, чтобы создать новый.`,
      );
    }

    const settings = await getGuildSettings(guild.id);

    // Атомарный инкремент счётчика — безопасен при параллельных запросах на уровне БД.
    const updatedSettings = await prisma.guildSettings.update({
      where: { id: settings.id },
      data: { nextTicketNumber: { increment: 1 } },
    });
    const number = updatedSettings.nextTicketNumber - 1;

    const channelName = buildTicketChannelName(
      'ticket-{number}',
      number,
      slugifyChannelName(category.name),
    );
    const parent = category.discordCategoryId
      ? await guild.channels.fetch(category.discordCategoryId).catch(() => null)
      : null;

    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: parent && parent.type === ChannelType.GuildCategory ? parent.id : undefined,
      topic: `Тикет №${number} · Автор: ${authorId} · Категория: ${category.name}`,
      permissionOverwrites: buildTicketOverwrites(guild, authorId, category.supportRoleIds),
    });

    const ticket = await prisma.ticket.create({
      data: {
        guildId: guild.id,
        number,
        channelId: channel.id,
        categoryId: category.id,
        authorId,
        status: 'OPEN',
      },
    });

    const controlMessage = await channel.send(buildTicketControlMessage(ticket, category));
    await controlMessage.pin().catch(() => undefined);
    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { controlMessageId: controlMessage.id },
    });

    await recordAuditLog(client, {
      action: 'TICKET_CREATED',
      actorId: authorId,
      actorType: 'DISCORD_USER',
      targetType: 'TICKET',
      targetId: ticket.id,
      metadata: { number, category: category.name },
      logChannelId: category.logChannelId,
    });

    return { ticket: updated, channel };
  });
}

async function refreshControlMessage(client: Client, ticket: Ticket, category: TicketCategory) {
  if (!ticket.channelId || !ticket.controlMessageId) return;
  try {
    const channel = (await client.channels.fetch(ticket.channelId)) as TextChannel | null;
    const message = await channel?.messages.fetch(ticket.controlMessageId);
    await message?.edit(buildTicketControlMessage(ticket, category));
  } catch (error) {
    logger.warn(
      { err: error, ticketId: ticket.id },
      'Не удалось обновить панель управления тикетом',
    );
  }
}

export async function claimTicket(
  client: Client,
  ticket: Ticket,
  category: TicketCategory,
  staffId: string,
): Promise<Ticket> {
  if (ticket.status !== 'OPEN') {
    throw new TicketServiceError('Тикет уже взят в работу или закрыт.');
  }
  const updated = await prisma.ticket.update({
    where: { id: ticket.id },
    data: { status: 'CLAIMED', claimedById: staffId, claimedAt: new Date() },
  });
  await refreshControlMessage(client, updated, category);
  await recordAuditLog(client, {
    action: 'TICKET_CLAIMED',
    actorId: staffId,
    targetType: 'TICKET',
    targetId: ticket.id,
    logChannelId: category.logChannelId,
  });
  return updated;
}

export async function closeTicket(
  client: Client,
  ticket: Ticket,
  category: TicketCategory,
  closedById: string,
  reason: string,
): Promise<Ticket> {
  if (ticket.status === 'CLOSED') {
    throw new TicketServiceError('Тикет уже закрыт.');
  }
  if (!ticket.channelId) {
    throw new TicketServiceError('Канал тикета не найден.');
  }

  const channel = (await client.channels
    .fetch(ticket.channelId)
    .catch(() => null)) as TextChannel | null;

  const updated = await prisma.ticket.update({
    where: { id: ticket.id },
    data: { status: 'CLOSED', closedById, closedAt: new Date(), closeReason: reason },
  });

  if (channel) {
    await channel.permissionOverwrites
      .edit(ticket.authorId, {
        SendMessages: false,
      })
      .catch(() => undefined);

    const { html, messageCount } = await buildTranscript(channel, ticket.number);
    await prisma.transcript.upsert({
      where: { ticketId: ticket.id },
      create: { ticketId: ticket.id, html, messageCount },
      update: { html, messageCount },
    });

    const transcriptChannelId = category.transcriptChannelId;
    if (transcriptChannelId) {
      const transcriptChannel = (await client.channels
        .fetch(transcriptChannelId)
        .catch(() => null)) as TextChannel | null;
      if (transcriptChannel) {
        const buffer = Buffer.from(html, 'utf-8');
        await transcriptChannel
          .send({
            content: `Транскрипт тикета №${ticket.number} (закрыл <@${closedById}>, автор <@${ticket.authorId}>)\nПричина: ${reason}`,
            files: [{ attachment: buffer, name: `ticket-${ticket.number}-transcript.html` }],
          })
          .catch((error) => logger.warn({ err: error }, 'Не удалось отправить транскрипт в канал'));
      }
    }

    await refreshControlMessage(client, updated, category);
    await channel.send(buildRatingPromptMessage(ticket.id)).catch(() => undefined);
  }

  await recordAuditLog(client, {
    action: 'TICKET_CLOSED',
    actorId: closedById,
    targetType: 'TICKET',
    targetId: ticket.id,
    metadata: { reason },
    logChannelId: category.logChannelId,
  });

  return updated;
}

export async function reopenTicket(
  client: Client,
  ticket: Ticket,
  category: TicketCategory,
  actorId: string,
): Promise<Ticket> {
  if (ticket.status !== 'CLOSED') {
    throw new TicketServiceError('Тикет не закрыт — открывать заново нечего.');
  }
  if (!ticket.channelId) {
    throw new TicketServiceError(
      'Канал тикета удалён, повторное открытие невозможно. Создайте новый тикет.',
    );
  }

  const channel = (await client.channels
    .fetch(ticket.channelId)
    .catch(() => null)) as TextChannel | null;
  if (channel) {
    await channel.permissionOverwrites
      .edit(ticket.authorId, { SendMessages: true })
      .catch(() => undefined);
  }

  const updated = await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      status: 'OPEN',
      reopenedAt: new Date(),
      closedById: null,
      closeReason: null,
      claimedById: null,
    },
  });

  await refreshControlMessage(client, updated, category);
  await recordAuditLog(client, {
    action: 'TICKET_REOPENED',
    actorId,
    targetType: 'TICKET',
    targetId: ticket.id,
    logChannelId: category.logChannelId,
  });

  return updated;
}

export async function deleteTicket(
  client: Client,
  ticket: Ticket,
  category: TicketCategory,
  actorId: string,
): Promise<void> {
  if (ticket.channelId) {
    const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
    if (channel && 'delete' in channel) {
      await (channel as TextChannel)
        .delete(`Тикет удалён администратором ${actorId}`)
        .catch(() => undefined);
    }
  }

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { deletedAt: new Date(), channelId: null },
  });

  await recordAuditLog(client, {
    action: 'TICKET_DELETED',
    actorId,
    targetType: 'TICKET',
    targetId: ticket.id,
    logChannelId: category.logChannelId,
  });
}

export async function addTicketMember(
  client: Client,
  ticket: Ticket,
  category: TicketCategory,
  userId: string,
  addedById: string,
): Promise<void> {
  if (!ticket.channelId) throw new TicketServiceError('Канал тикета не найден.');

  const existing = await prisma.ticketMember.findUnique({
    where: { ticketId_userId: { ticketId: ticket.id, userId } },
  });
  if (existing) throw new TicketServiceError('Этот пользователь уже добавлен в тикет.');

  const channel = (await client.channels.fetch(ticket.channelId)) as TextChannel;
  await channel.permissionOverwrites.edit(userId, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
  });

  await prisma.ticketMember.create({ data: { ticketId: ticket.id, userId, addedById } });
  await recordAuditLog(client, {
    action: 'TICKET_MEMBER_ADDED',
    actorId: addedById,
    targetType: 'TICKET',
    targetId: ticket.id,
    metadata: { userId },
    logChannelId: category.logChannelId,
  });
}

export async function removeTicketMember(
  client: Client,
  ticket: Ticket,
  category: TicketCategory,
  userId: string,
  removedById: string,
): Promise<void> {
  if (!ticket.channelId) throw new TicketServiceError('Канал тикета не найден.');
  if (userId === ticket.authorId)
    throw new TicketServiceError('Нельзя убрать из тикета его автора.');

  const existing = await prisma.ticketMember.findUnique({
    where: { ticketId_userId: { ticketId: ticket.id, userId } },
  });
  if (!existing) throw new TicketServiceError('Этот пользователь не состоит в тикете.');

  const channel = (await client.channels.fetch(ticket.channelId)) as TextChannel;
  await channel.permissionOverwrites.delete(userId).catch(() => undefined);
  await prisma.ticketMember.delete({ where: { id: existing.id } });

  await recordAuditLog(client, {
    action: 'TICKET_MEMBER_REMOVED',
    actorId: removedById,
    targetType: 'TICKET',
    targetId: ticket.id,
    metadata: { userId },
    logChannelId: category.logChannelId,
  });
}

export async function rateTicket(
  client: Client,
  ticket: Ticket,
  category: TicketCategory,
  raterId: string,
  score: number,
): Promise<void> {
  if (ticket.status !== 'CLOSED')
    throw new TicketServiceError('Оценить можно только закрытый тикет.');
  if (ticket.authorId !== raterId)
    throw new TicketServiceError('Оценивать может только автор тикета.');

  const existing = await prisma.ticketRating.findUnique({ where: { ticketId: ticket.id } });
  if (existing) throw new TicketServiceError('Вы уже оценили этот тикет.');

  await prisma.ticketRating.create({
    data: { ticketId: ticket.id, raterId, staffId: ticket.claimedById ?? ticket.closedById, score },
  });

  await recordAuditLog(client, {
    action: 'TICKET_RATED',
    actorId: raterId,
    actorType: 'DISCORD_USER',
    targetType: 'TICKET',
    targetId: ticket.id,
    metadata: { score },
    logChannelId: category.logChannelId,
  });
}

export function requireSupportAccess(
  category: TicketCategory,
  member: { permissions: { has(flag: bigint): boolean }; roles: { cache: Map<string, unknown> } },
): boolean {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return category.supportRoleIds.some((roleId) => member.roles.cache.has(roleId));
}
