// Простой mutex по ключу в рамках одного процесса. Защищает от гонок при двойном клике по
// кнопке (например, создание тикета) — на время обработки предыдущий вызов блокирует следующий
// с тем же ключом. Рассчитан на единственный экземпляр бота; при горизонтальном масштабировании
// потребуется распределённая блокировка (например, через advisory locks Postgres).
const locks = new Map<string, Promise<void>>();

export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const chain = previous.then(
    () => new Promise<void>((resolve) => (release = resolve)),
  ) as Promise<void>;
  locks.set(key, chain);

  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(key) === chain) locks.delete(key);
  }
}
