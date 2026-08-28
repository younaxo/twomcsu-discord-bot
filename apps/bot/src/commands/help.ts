import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { BotCommand } from './types.js';

// Ссылка на реестр устанавливается в index.ts после сборки всех команд — так избегаем
// циклического импорта между help.ts и registry.
let registry: BotCommand[] = [];
export function registerCommandsForHelp(commands: BotCommand[]) {
  registry = commands;
}

export const helpCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Показать список доступных команд') as SlashCommandBuilder,
  helpText: 'Показывает список всех доступных команд бота',
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('📖 Доступные команды')
      .setColor(0x5865f2)
      .setDescription(
        registry.map((command) => `**/${command.data.name}** — ${command.helpText}`).join('\n'),
      )
      .setFooter({ text: 'TWOMC.SU' });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
