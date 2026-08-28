'use client';

import { use, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/clientApi';
import { TicketStatusBadge } from '@/components/TicketStatusBadge';
import { Rating } from '@/components/Rating';

interface TicketDetail {
  id: string;
  number: number;
  status: 'OPEN' | 'CLAIMED' | 'CLOSED';
  authorId: string;
  claimedById: string | null;
  closedById: string | null;
  closeReason: string | null;
  createdAt: string;
  claimedAt: string | null;
  closedAt: string | null;
  category: { name: string; emoji: string };
  members: { userId: string; addedAt: string }[];
  rating: { score: number; comment: string | null } | null;
  transcript: { messageCount: number; createdAt: string } | null;
  threadId: string | null;
  discordUrl: string | null;
}

interface AuditEntry {
  id: string;
  action: string;
  actorId: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [closeReason, setCloseReason] = useState('');
  const [memberId, setMemberId] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/tickets/${id}`);
    if (res.ok) {
      const data = await res.json();
      setTicket(data.ticket);
      setAuditEntries(data.auditEntries);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [id]);

  async function runAction(path: string, method: string, body?: unknown) {
    setBusy(true);
    setActionError(null);
    const res = await apiFetch(`/api/tickets/${id}${path}`, {
      method,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setActionError(data.error ?? 'Действие не выполнено');
    } else {
      await load();
    }
    setBusy(false);
  }

  if (loading) return <p className="text-sm text-muted">Загрузка…</p>;
  if (!ticket) return <p className="text-sm text-muted">Тикет не найден.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            Тикет №{ticket.number} — {ticket.category.emoji} {ticket.category.name}
          </h1>
          <TicketStatusBadge status={ticket.status} />
        </div>
      </div>

      {actionError && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{actionError}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card space-y-2 text-sm">
          <h2 className="font-medium text-white">Основное</h2>
          <p className="text-muted">
            Автор: <span className="text-white">{ticket.authorId}</span>
          </p>
          <p className="text-muted">
            Создан:{' '}
            <span className="text-white">
              {new Date(ticket.createdAt).toLocaleString('ru-RU')}
            </span>
          </p>
          {ticket.claimedById && (
            <p className="text-muted">
              В работе у: <span className="text-white">{ticket.claimedById}</span>
            </p>
          )}
          {ticket.closedById && (
            <>
              <p className="text-muted">
                Закрыл: <span className="text-white">{ticket.closedById}</span>
              </p>
              <p className="text-muted">
                Причина: <span className="text-white">{ticket.closeReason}</span>
              </p>
            </>
          )}
          {ticket.rating && (
            <p className="text-muted">
              Оценка: <Rating score={ticket.rating.score} />
            </p>
          )}
          <p className="text-muted">
            Модель:{' '}
            <span className="text-white">
              {ticket.threadId ? 'приватная ветка' : 'канал (устаревшая)'}
            </span>
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {ticket.discordUrl && (
              <a
                href={ticket.discordUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary"
              >
                Открыть в Discord
              </a>
            )}
            {ticket.transcript && (
              <a
                href={`/api/tickets/${id}/transcript`}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary"
              >
                Транскрипт ({ticket.transcript.messageCount} сообщ.)
              </a>
            )}
          </div>
        </div>

        <div className="card space-y-3">
          <h2 className="font-medium text-white">Действия</h2>
          <div className="flex flex-wrap gap-2">
            {ticket.status === 'OPEN' && (
              <button
                disabled={busy}
                className="btn-primary"
                onClick={() => runAction('/claim', 'POST')}
              >
                Взять в работу
              </button>
            )}
            {ticket.status !== 'CLOSED' && (
              <button
                disabled={busy}
                className="btn-danger"
                onClick={() => setCloseReason(closeReason || ' ')}
              >
                Закрыть
              </button>
            )}
            {ticket.status === 'CLOSED' && (
              <button
                disabled={busy}
                className="btn-secondary"
                onClick={() => runAction('/reopen', 'POST')}
              >
                Открыть повторно
              </button>
            )}
            <button
              disabled={busy}
              className="btn-danger"
              onClick={() => {
                if (confirm('Удалить тикет безвозвратно?')) runAction('', 'DELETE');
              }}
            >
              Удалить тикет
            </button>
          </div>

          {ticket.status !== 'CLOSED' && closeReason && (
            <div className="space-y-2 rounded-lg border border-surface-border p-3">
              <label className="label">Причина закрытия</label>
              <textarea
                className="input"
                value={closeReason.trim()}
                onChange={(e) => setCloseReason(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  disabled={busy || !closeReason.trim()}
                  className="btn-primary"
                  onClick={() =>
                    runAction('/close', 'POST', { reason: closeReason.trim() }).then(() =>
                      setCloseReason(''),
                    )
                  }
                >
                  Подтвердить закрытие
                </button>
                <button className="btn-secondary" onClick={() => setCloseReason('')}>
                  Отмена
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2 rounded-lg border border-surface-border p-3">
            <label className="label">Добавить участника (Discord ID)</label>
            <div className="flex gap-2">
              <input
                className="input"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                placeholder="123456789012345678"
              />
              <button
                disabled={busy || !memberId.trim()}
                className="btn-secondary shrink-0"
                onClick={() =>
                  runAction('/members', 'POST', { userId: memberId.trim() }).then(() =>
                    setMemberId(''),
                  )
                }
              >
                Добавить
              </button>
            </div>
          </div>

          {ticket.members.length > 0 && (
            <div className="space-y-1 text-sm">
              <p className="text-muted">Дополнительные участники:</p>
              {ticket.members.map((member) => (
                <div key={member.userId} className="flex items-center justify-between">
                  <span>{member.userId}</span>
                  <button
                    className="text-red-400 hover:underline"
                    onClick={() => runAction(`/members/${member.userId}`, 'DELETE')}
                  >
                    Удалить
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="mb-2 font-medium text-white">История</h2>
          <div className="space-y-2 text-sm">
            {auditEntries.map((entry) => (
              <div key={entry.id} className="border-b border-surface-border/50 pb-2">
                <p className="text-white">{entry.action}</p>
                <p className="text-xs text-muted">
                  {entry.actorId} · {new Date(entry.createdAt).toLocaleString('ru-RU')}
                </p>
              </div>
            ))}
            {auditEntries.length === 0 && <p className="text-muted">Записей пока нет.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
