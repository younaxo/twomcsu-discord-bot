// Единственная точка создания PrismaClient — используется и ботом, и веб-панелью.
import { PrismaClient } from '../generated/client/index.js';

declare global {
  var __prisma: PrismaClient | undefined;
}

// В dev-режиме Next.js перезагружает модули при каждом изменении файла — храним клиент
// в globalThis, чтобы не открывать новое соединение с БД на каждый hot-reload.
export const prisma = globalThis.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

export * from '../generated/client/index.js';
