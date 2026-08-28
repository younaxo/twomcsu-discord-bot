// Безопасный seed: создаёт только запись настроек guild, если её ещё нет.
// Никаких тестовых пользователей, тикетов или прочих фиктивных данных не добавляет.
import { PrismaClient } from '../generated/client/index.js';

const prisma = new PrismaClient();

async function main() {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) {
    console.error('DISCORD_GUILD_ID не задан — нечего засеивать, пропускаю.');
    return;
  }

  const existing = await prisma.guildSettings.findUnique({ where: { guildId } });
  if (existing) {
    console.log('Настройки guild уже существуют, seed не требуется.');
    return;
  }

  await prisma.guildSettings.create({
    data: {
      guildId,
      ticketNamePattern: 'ticket-{number}',
    },
  });
  console.log(`Созданы настройки по умолчанию для guild ${guildId}.`);
}

main()
  .catch((error) => {
    console.error('Ошибка seed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
