import { Collection } from 'discord.js';
import type { BotCommand } from './types.js';
import { pingCommand } from './ping.js';
import { statusCommand } from './status.js';
import { helpCommand, registerCommandsForHelp } from './help.js';

const commandList: BotCommand[] = [pingCommand, statusCommand, helpCommand];
registerCommandsForHelp(commandList);

export const commands = new Collection<string, BotCommand>(
  commandList.map((command) => [command.data.name, command]),
);
