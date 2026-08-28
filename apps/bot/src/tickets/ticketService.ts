// Вся бизнес-логика жизненного цикла тикета. Действия из Discord (кнопки) и из веб-панели
// (через внутреннее API) проходят через одни и те же функции — единая точка правды.
//
// Новые тикеты создаются как приватные ветки (PrivateThread) внутри родительского текстового
// канала категории — это основная модель. Старые тикеты остались отдельными каналами (channelId)
// и продолжают работать по прежней логике с permission overwrites; у приватной ветки таких
// overwrites нет, доступ строится через членство в ветке и права Manage Threads на родителе.
import {
  ChannelType,
  PermissionFlagsBits,
  type AnyThreadChannel,
  type Client,
  type Guild,
  type TextChannel,
} from 'discord.js';
import { prisma, type Ticket, type TicketCategory } from '@twomcsu/db';
import { buildTicketChannelName, slugifyChannelName } from '@twomcsu/shared';
import { buildTicketControlMessage, buildRatingPromptMessage } from './panelBuilder.js';
import { buildTranscript } from './transcriptBuilder.js';
import { recordAuditLog } from '../audit/auditLog.js';
import { withLock } from '../util/asyncLock.js';
import { logger } from '../logger.js';

export class TicketServiceError extends Error {}

type TicketChannel = TextChannel | AnyThreadChannel;

function isThreadTicket(ticket: Ticket): boolean {
  return Boolean(ticket.threadId);
}

/** Возвращает канал тикета независимо от модели (ветка новой или канал старой). */
async function getTicketChannel(client: Client, ticket: Ticket): Promise<TicketChannel | null> {
  const id = ticket.threadId ?? ticket.channelId;
  if (!id) return null;
  const channel = await client.channels.fetch(id).catch(() => null);
  if (!channel || !channel.isTextBased() || channel.isDMBased()) return null;
  return channel as TicketChannel;
}

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
): Promise<{ ticket: Ticket; channel: TicketChannel }> {
  return withLock(`create:${guild.id}:${authorId}:${category.id}`, async () => {
    if (!category.isEnabled) {
      throw new TicketServiceError('Эта категория тикетов сейчас недоступна.');
    }
    if (!category.parentChannelId) {
      throw new TicketServiceError(
        'Для этой категории не настроен родительский канал тикетов. Обратитесь к администратору панели.',
      );
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

    const parentChannel = await guild.channels.fetch(category.parentChannelId).catch(() => null);
    if (!parentChannel || parentChannel.type !== ChannelType.GuildText) {
      throw new TicketServiceError(
        'Родительский канал тикетов недоступен или удалён. Обратитесь к администратору панели.',
      );
    }

    const settings = await getGuildSettings(guild.id);

    // Атомарный инкремент счётчика — безопасен при параллельных запросах на уровне БД.
    const updatedSettings = await prisma.guildSettings.update({
      where: { id: settings.id },
      data: { nextTicketNumber: { increment: 1 } },
    });
    const number = updatedSettings.nextTicketNumber - 1;

    const threadName = buildTicketChannelName(
      settings.ticketNamePattern,
      number,
      slugifyChannelName(category.name),
    );

    const thread = await parentChannel.threads.create({
      name: threadName,
      type: ChannelType.PrivateThread,
      invitable: false,
      autoArchiveDuration: category.autoArchiveMinutes as 60 | 1440 | 4320 | 10080,
      reason: `Тикет №${number} · Автор: ${authorId} · Категория: ${category.name}`,
    });

    // Автор — обязательный участник ветки. Роли поддержки видят приватные ветки автоматически,
    // если у них есть право Manage Threads на родительском канале (настраивается администратором
    // сервера один раз для канала, не для каждого тикета).
    await thread.members.add(authorId).catch((error) => {
      logger.warn({ err: error, threadId: thread.id }, 'Не удалось добавить автора в ветку тикета');
    });

    const ticket = await prisma.ticket.create({
      data: {
        guildId: guild.id,
        number,
        threadId: thread.id,
        parentChannelId: parentChannel.id,
        categoryId: category.id,
        authorId,
        status: 'OPEN',
      },
    });

    const controlMessage = await thread.send(buildTicketControlMessage(ticket, category));
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

    return { ticket: updated, channel: thread };
  });
}

async function refreshControlMessage(client: Client, ticket: Ticket, category: TicketCategory) {
  if (!ticket.controlMessageId) return;
  try {
    const channel = await getTicketChannel(client, ticket);
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

  // Атомарный переход статуса: если два «Взять в работу» прилетели почти одновременно (двойной
  // клик, повторная доставка interaction), только один пройдёт условие status: 'OPEN' в WHERE.
  const { count } = await prisma.ticket.updateMany({
    where: { id: ticket.id, status: 'OPEN' },
    data: { status: 'CLAIMED', claimedById: staffId, claimedAt: new Date() },
  });
  if (count === 0) {
    throw new TicketServiceError('Тикет уже взят в работу или закрыт.');
  }
  const updated = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });

  if (isThreadTicket(ticket)) {
    const thread = await getTicketChannel(client, ticket);
    if (thread?.isThread()) {
      await thread.members.add(staffId).catch((error) => {
        logger.warn({ err: error, ticketId: ticket.id }, 'Не удалось добавить сотрудника в ветку');
      });
    }
  }

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
  if (!ticket.threadId && !ticket.channelId) {
    throw new TicketServiceError('Канал тикета не найден.');
  }

  const channel = await getTicketChannel(client, ticket);

  // Атомарный переход: конкурентное закрытие (двойной клик, повтор interaction) не должно
  // дважды строить транскрипт и дважды писать в аудит.
  const { count } = await prisma.ticket.updateMany({
    where: { id: ticket.id, status: { not: 'CLOSED' } },
    data: { status: 'CLOSED', closedById, closedAt: new Date(), closeReason: reason },
  });
  if (count === 0) {
    throw new TicketServiceError('Тикет уже закрыт.');
  }
  const updated = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });

  if (channel) {
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

    if (channel.isThread()) {
      // Порядок важен: сначала отправляем финальные сообщения, потом блокируем и архивируем —
      // заблокированная и заархивированная ветка новых сообщений не принимает.
      await channel.setLocked(true, `Тикет №${ticket.number} закрыт`).catch(() => undefined);
      await channel.setArchived(true, `Тикет №${ticket.number} закрыт`).catch(() => undefined);
    } else {
      await channel.permissionOverwrites
        .edit(ticket.authorId, { SendMessages: false })
        .catch(() => undefined);
    }
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
  if (!ticket.threadId && !ticket.channelId) {
    throw new TicketServiceError(
      'Канал тикета удалён, повторное открытие невозможно. Создайте новый тикет.',
    );
  }

  const channel = await getTicketChannel(client, ticket);
  if (channel) {
    if (channel.isThread()) {
      // Ветку нужно сперва разархивировать — заблокированную архивную ветку Discord не примет
      // как активную, если проверять в обратном порядке.
      await channel.setArchived(false, `Тикет №${ticket.number} открыт повторно`).catch(() => undefined);
      await channel.setLocked(false, `Тикет №${ticket.number} открыт повторно`).catch(() => undefined);
    } else {
      await channel.permissionOverwrites
        .edit(ticket.authorId, { SendMessages: true })
        .catch(() => undefined);
    }
  }

  const { count } = await prisma.ticket.updateMany({
    where: { id: ticket.id, status: 'CLOSED' },
    data: {
      status: 'OPEN',
      reopenedAt: new Date(),
      closedById: null,
      closeReason: null,
      claimedById: null,
    },
  });
  if (count === 0) {
    throw new TicketServiceError('Тикет уже не закрыт.');
  }
  const updated = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });

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
  const { count } = await prisma.ticket.updateMany({
    where: { id: ticket.id, deletedAt: null },
    data: { deletedAt: new Date(), channelId: null, threadId: null },
  });
  if (count === 0) {
    throw new TicketServiceError('Тикет уже удалён.');
  }

  const channel = await getTicketChannel(client, ticket);
  if (channel) {
    await channel.delete(`Тикет удалён администратором ${actorId}`).catch(() => undefined);
  }

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
  const channel = await getTicketChannel(client, ticket);
  if (!channel) throw new TicketServiceError('Канал тикета не найден.');

  const existing = await prisma.ticketMember.findUnique({
    where: { ticketId_userId: { ticketId: ticket.id, userId } },
  });
  if (existing) throw new TicketServiceError('Этот пользователь уже добавлен в тикет.');

  if (channel.isThread()) {
    await channel.members.add(userId);
  } else {
    await channel.permissionOverwrites.edit(userId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    });
  }

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
  if (userId === ticket.authorId)
    throw new TicketServiceError('Нельзя убрать из тикета его автора.');

  const channel = await getTicketChannel(client, ticket);
  if (!channel) throw new TicketServiceError('Канал тикета не найден.');

  const existing = await prisma.ticketMember.findUnique({
    where: { ticketId_userId: { ticketId: ticket.id, userId } },
  });
  if (!existing) throw new TicketServiceError('Этот пользователь не состоит в тикете.');

  if (channel.isThread()) {
    await channel.members.remove(userId).catch(() => undefined);
  } else {
    await channel.permissionOverwrites.delete(userId).catch(() => undefined);
  }
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

  try {
    await prisma.ticketRating.create({
      data: { ticketId: ticket.id, raterId, staffId: ticket.claimedById ?? ticket.closedById, score },
    });
  } catch (error) {
    // P2002 — нарушение уникальности ticketId: два запроса на оценку прошли предварительную
    // проверку одновременно, база защитила от дубля сама.
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      throw new TicketServiceError('Вы уже оценили этот тикет.');
    }
    throw error;
  }

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
