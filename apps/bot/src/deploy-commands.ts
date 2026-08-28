// Регистрация slash-команд для конкретного guild — применяется мгновенно, в отличие от
// глобальной регистрации (которая расходится по Discord до часа). Запускать отдельно
// от старта бота: `pnpm --filter @twomcsu/bot deploy-commands`.
import { REST, Routes } from 'discord.js';
import { env } from './env.js';
import { commands } from './commands/index.js';
import { logger } from './logger.js';

async function main() {
  const rest = new REST().setToken(env.DISCORD_BOT_TOKEN);
  const body = commands.map((command) => command.data.toJSON());

  logger.info({ count: body.length, guildId: env.DISCORD_GUILD_ID }, 'Регистрирую команды guild…');

  const result = (await rest.put(
    Routes.applicationGuildCommands(env.DISCORD_APPLICATION_ID, env.DISCORD_GUILD_ID),
    { body },
  )) as unknown[];

  logger.info({ count: result.length }, 'Команды guild зарегистрированы');
}

main().catch((error) => {
  logger.error({ err: error }, 'Не удалось зарегистрировать команды');
  process.exitCode = 1;
});
