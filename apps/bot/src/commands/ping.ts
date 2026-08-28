import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { BotCommand } from './types.js';

export const pingCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Проверить задержку бота') as SlashCommandBuilder,
  helpText: 'Показывает задержку ответа и пинг WebSocket-соединения',
  async execute(interaction) {
    const sent = await interaction.reply({ content: 'Меряю пинг…', withResponse: true });
    const roundTrip = sent.resource?.message
      ? sent.resource.message.createdTimestamp - interaction.createdTimestamp
      : 0;

    const embed = new EmbedBuilder()
      .setTitle('🏓 Понг!')
      .setColor(0x5865f2)
      .addFields(
        { name: 'Задержка ответа', value: `${roundTrip} мс`, inline: true },
        {
          name: 'Пинг WebSocket',
          value: `${Math.round(interaction.client.ws.ping)} мс`,
          inline: true,
        },
      );

    await interaction.editReply({ content: null, embeds: [embed] });
  },
};
