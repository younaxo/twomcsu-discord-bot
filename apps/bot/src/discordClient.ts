// Создание единого экземпляра Discord-клиента.
//
// ВНИМАНИЕ: GuildMembers и MessageContent — привилегированные intent'ы. Их нужно один раз
// включить вручную в Discord Developer Portal → Bot → Privileged Gateway Intents. Без
// GuildMembers не будет работать список участников сервера и дата вступления, без
// MessageContent транскрипты тикетов будут сохраняться без текста сообщений.
import { Client, GatewayIntentBits, Partials } from 'discord.js';

export function createDiscordClient(): Client {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Message, Partials.Channel],
  });
}
