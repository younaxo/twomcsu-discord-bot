// Минималистичный логгер для серверной части панели. Секреты сюда не передаём.
function log(level: 'info' | 'warn' | 'error', message: string, meta?: unknown) {
  const entry = {
    level,
    time: new Date().toISOString(),
    message,
    ...(meta ? { meta: serializeMeta(meta) } : {}),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

function serializeMeta(meta: unknown) {
  if (meta instanceof Error) return { name: meta.name, message: meta.message, stack: meta.stack };
  return meta;
}

export const logger = {
  info: (message: string, meta?: unknown) => log('info', message, meta),
  warn: (message: string, meta?: unknown) => log('warn', message, meta),
  error: (message: string, meta?: unknown) => log('error', message, meta),
};
