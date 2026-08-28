-- Переход тикетов на приватные ветки: новые поля аддитивны, ничего не удаляется
-- и не переименовывается — существующие тикеты-каналы продолжают работать как есть.

-- AlterTable
ALTER TABLE "TicketCategory" ADD COLUMN     "parentChannelId" TEXT,
ADD COLUMN     "autoArchiveMinutes" INTEGER NOT NULL DEFAULT 4320;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "threadId" TEXT,
ADD COLUMN     "parentChannelId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_threadId_key" ON "Ticket"("threadId");
