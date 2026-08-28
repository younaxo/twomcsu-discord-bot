import type { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export interface BotCommand {
  data: SlashCommandBuilder;
  /** Краткое описание на русском для /help — дублирует data.description, чтобы не парсить билдер. */
  helpText: string;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}
