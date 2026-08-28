import { Events } from 'discord.js';
import { prisma } from '@twomcsu/db';
import { env } from './env.js';
import { logger } from './logger.js';
import { createDiscordClient } from './discordClient.js';
import { handleReady } from './events/ready.js';
import { handleInteraction } from './events/interactionCreate.js';
import { startInternalApi, syncMemberCache } from './internalApi/server.js';

const MEMBER_SYNC_INTERVAL_MS = 15 * 60 * 1000;

async function main() {
  await prisma.$connect();
  logger.info('Подключение к базе данных установлено');

  const client = createDiscordClient();

  client.once(Events.ClientReady, (readyClient) => {
    handleReady(readyClient);
    startInternalApi(client);

    const guild = readyClient.guilds.cache.get(env.DISCORD_GUILD_ID);
    if (guild) {
      syncMemberCache(guild).catch((error) =>
        logger.warn({ err: error }, 'Первичная синхронизация участников не удалась'),
      );
      setInterval(() => {
        syncMemberCache(guild).catch((error) =>
          logger.warn({ err: error }, 'Синхронизация участников не удалась'),
        );
      }, MEMBER_SYNC_INTERVAL_MS);
    } else {
      logger.warn(
        { guildId: env.DISCORD_GUILD_ID },
        'Бот не состоит на указанном в DISCORD_GUILD_ID сервере',
      );
    }
  });

  client.on(Events.InteractionCreate, (interaction) => {
    handleInteraction(client, interaction).catch((error) =>
      logger.error({ err: error }, 'Необработанная ошибка интеракции'),
    );
  });

  client.on(Events.Error, (error) => logger.error({ err: error }, 'Ошибка Discord-клиента'));

  await client.login(env.DISCORD_BOT_TOKEN);
}

async function shutdown(signal: string) {
  logger.info({ signal }, 'Завершение работы бота…');
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

main().catch((error) => {
  logger.error({ err: error }, 'Не удалось запустить бота');
  process.exit(1);
});
