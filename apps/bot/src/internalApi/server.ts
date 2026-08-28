// Внутреннее HTTP API бота. Слушает только внутри docker-сети (порт наружу не публикуется),
// но всё равно защищено секретом в заголовке — оборона в глубину на случай ошибки в сетевой конфигурации.
import crypto from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { PermissionFlagsBits, type Client, type Guild } from 'discord.js';
import { prisma } from '@twomcsu/db';
import { env } from '../env.js';
import { logger } from '../logger.js';
import { APP_VERSION } from '../version.js';
import {
  TicketServiceError,
  addTicketMember,
  claimTicket,
  closeTicket,
  deleteTicket,
  removeTicketMember,
  reopenTicket,
} from '../tickets/ticketService.js';
import { buildTicketPanelMessage } from '../tickets/panelBuilder.js';

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function authGuard(req: Request, res: Response, next: NextFunction) {
  const secret = req.header('x-internal-secret') ?? '';
  if (!timingSafeEqual(secret, env.INTERNAL_API_SECRET)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  next();
}

// Параметр из шаблона маршрута (:id и т.п.) всегда присутствует, если роут вообще совпал —
// но noUncheckedIndexedAccess делает тип "string | undefined", поэтому явно сужаем его здесь.
function requiredParam(req: Request, name: string): string {
  const value = req.params[name];
  if (!value) throw new TicketServiceError(`Отсутствует параметр маршрута: ${name}`);
  return value;
}

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    fn(req, res).catch((error) => {
      if (error instanceof TicketServiceError) {
        res.status(422).json({ error: error.message });
        return;
      }
      logger.error({ err: error, path: req.path }, 'Ошибка внутреннего API');
      res.status(500).json({ error: 'internal_error' });
    });
  };
}

async function getTicketOrFail(id: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id }, include: { category: true } });
  if (!ticket) throw new TicketServiceError('Тикет не найден.');
  const { category, ...rest } = ticket;
  return { ticket: rest, category };
}

export function startInternalApi(client: Client): void {
  const app = express();
  app.use(express.json());
  app.use(authGuard);

  app.get(
    '/internal/status',
    asyncHandler(async (_req, res) => {
      res.json({
        online: client.isReady(),
        uptimeMs: client.uptime ?? 0,
        wsPing: client.ws.ping,
        guildMemberCount: client.guilds.cache.get(env.DISCORD_GUILD_ID)?.memberCount ?? 0,
        appVersion: APP_VERSION,
      });
    }),
  );

  app.get(
    '/internal/membership/:userId',
    asyncHandler(async (req, res) => {
      const guild = client.guilds.cache.get(env.DISCORD_GUILD_ID);
      if (!guild) {
        res.json({ inGuild: false, hasAccessRole: false });
        return;
      }
      const member = await guild.members.fetch(requiredParam(req, 'userId')).catch(() => null);
      if (!member) {
        res.json({ inGuild: false, hasAccessRole: false });
        return;
      }
      const hasAccessRole =
        member.roles.cache.has(env.DISCORD_PANEL_ACCESS_ROLE_ID) ||
        member.permissions.has(PermissionFlagsBits.Administrator);
      res.json({
        inGuild: true,
        hasAccessRole,
        username: member.user.username,
        globalName: member.user.globalName,
        avatarUrl: member.user.displayAvatarURL({ size: 128 }),
      });
    }),
  );

  app.post(
    '/internal/audit/notify',
    asyncHandler(async (req, res) => {
      const { actorId, label, details } = req.body as {
        actorId: string;
        label: string;
        details?: string;
      };
      const settings = await prisma.guildSettings.findUnique({
        where: { guildId: env.DISCORD_GUILD_ID },
      });
      const channelId = settings?.defaultLogChannelId;
      if (channelId) {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (channel?.isTextBased() && !channel.isDMBased()) {
          await channel
            .send({
              embeds: [
                {
                  description: `**${label}**\nИсполнитель: <@${actorId}>${details ? `\n${details}` : ''}`,
                  color: 0x5865f2,
                  timestamp: new Date().toISOString(),
                },
              ],
            })
            .catch(() => undefined);
        }
      }
      res.json({ ok: true });
    }),
  );

  app.post(
    '/internal/members/sync',
    asyncHandler(async (_req, res) => {
      const guild = client.guilds.cache.get(env.DISCORD_GUILD_ID);
      if (!guild) {
        res.status(404).json({ error: 'guild_not_found' });
        return;
      }
      const count = await syncMemberCache(guild);
      res.json({ synced: count });
    }),
  );

  app.post(
    '/internal/panels/:id/publish',
    asyncHandler(async (req, res) => {
      const panel = await prisma.ticketPanel.findUnique({
        where: { id: requiredParam(req, 'id') },
        include: { categories: { include: { category: true }, orderBy: { position: 'asc' } } },
      });
      if (!panel) throw new TicketServiceError('Панель не найдена.');

      const channel = await client.channels.fetch(panel.channelId).catch(() => null);
      if (!channel?.isTextBased() || channel.isDMBased())
        throw new TicketServiceError('Канал панели недоступен.');

      const payload = buildTicketPanelMessage({
        title: panel.title,
        description: panel.description,
        componentType: panel.componentType,
        categories: panel.categories.map((link) => link.category),
      });

      if (panel.messageId) {
        const existing = await channel.messages.fetch(panel.messageId).catch(() => null);
        if (existing) {
          await existing.edit(payload);
          res.json({ messageId: existing.id, updated: true });
          return;
        }
      }

      const message = await channel.send(payload);
      await prisma.ticketPanel.update({ where: { id: panel.id }, data: { messageId: message.id } });
      res.json({ messageId: message.id, updated: false });
    }),
  );

  app.post(
    '/internal/tickets/:id/claim',
    asyncHandler(async (req, res) => {
      const { actorId } = req.body as { actorId: string };
      const { ticket, category } = await getTicketOrFail(requiredParam(req, 'id'));
      const updated = await claimTicket(client, ticket, category, actorId);
      res.json(updated);
    }),
  );

  app.post(
    '/internal/tickets/:id/close',
    asyncHandler(async (req, res) => {
      const { actorId, reason } = req.body as { actorId: string; reason: string };
      const { ticket, category } = await getTicketOrFail(requiredParam(req, 'id'));
      const updated = await closeTicket(client, ticket, category, actorId, reason);
      res.json(updated);
    }),
  );

  app.post(
    '/internal/tickets/:id/reopen',
    asyncHandler(async (req, res) => {
      const { actorId } = req.body as { actorId: string };
      const { ticket, category } = await getTicketOrFail(requiredParam(req, 'id'));
      const updated = await reopenTicket(client, ticket, category, actorId);
      res.json(updated);
    }),
  );

  app.delete(
    '/internal/tickets/:id',
    asyncHandler(async (req, res) => {
      const { actorId } = req.body as { actorId: string };
      const { ticket, category } = await getTicketOrFail(requiredParam(req, 'id'));
      await deleteTicket(client, ticket, category, actorId);
      res.json({ ok: true });
    }),
  );

  app.post(
    '/internal/tickets/:id/members',
    asyncHandler(async (req, res) => {
      const { actorId, userId } = req.body as { actorId: string; userId: string };
      const { ticket, category } = await getTicketOrFail(requiredParam(req, 'id'));
      await addTicketMember(client, ticket, category, userId, actorId);
      res.json({ ok: true });
    }),
  );

  app.delete(
    '/internal/tickets/:id/members/:userId',
    asyncHandler(async (req, res) => {
      const { actorId } = req.body as { actorId: string };
      const { ticket, category } = await getTicketOrFail(requiredParam(req, 'id'));
      await removeTicketMember(client, ticket, category, requiredParam(req, 'userId'), actorId);
      res.json({ ok: true });
    }),
  );

  app.listen(env.INTERNAL_API_PORT, () => {
    logger.info({ port: env.INTERNAL_API_PORT }, 'Внутреннее API бота запущено');
  });
}

export async function syncMemberCache(guild: Guild): Promise<number> {
  const members = await guild.members.fetch();
  const list = [...members.values()];

  // Пишем пачками по 50, а не одной транзакцией на всех — на крупном сервере тысячи
  // участников не поместятся в разумные лимиты одной транзакции.
  const batchSize = 50;
  for (let i = 0; i < list.length; i += batchSize) {
    const batch = list.slice(i, i + batchSize);
    await Promise.all(
      batch.map((member) =>
        prisma.discordMemberCache.upsert({
          where: { discordUserId: member.id },
          create: {
            discordUserId: member.id,
            username: member.user.username,
            globalName: member.user.globalName,
            avatarUrl: member.user.displayAvatarURL({ size: 128 }),
            roleIds: member.roles.cache.map((role) => role.id),
            joinedAt: member.joinedAt,
          },
          update: {
            username: member.user.username,
            globalName: member.user.globalName,
            avatarUrl: member.user.displayAvatarURL({ size: 128 }),
            roleIds: member.roles.cache.map((role) => role.id),
            joinedAt: member.joinedAt,
            refreshedAt: new Date(),
          },
        }),
      ),
    );
  }
  return list.length;
}
