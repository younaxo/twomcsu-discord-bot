import type { Client } from 'discord.js';
import { ActivityType } from 'discord.js';
import { logger } from '../logger.js';

export function handleReady(client: Client<true>): void {
  logger.info(
    { tag: client.user.tag, guilds: client.guilds.cache.size },
    'Бот запущен и готов к работе',
  );
  client.user.setPresence({
    activities: [{ name: 'заявки TWOMC.SU', type: ActivityType.Watching }],
    status: 'online',
  });
}
