// Структурированный логгер. В проде — JSON в stdout (удобно для docker logs/агрегаторов),
// в dev — читаемый цветной вывод. Секреты сюда никогда не передаём напрямую, только через maskSecret.
import pino from 'pino';
import { env } from './env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
      : undefined,
});
