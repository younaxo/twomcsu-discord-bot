'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Inbox, Search } from 'lucide-react';
import { TicketStatusBadge } from '@/components/TicketStatusBadge';
import { Rating } from '@/components/Rating';

interface TicketRow {
  id: string;
  number: number;
  status: 'OPEN' | 'CLAIMED' | 'CLOSED';
  authorId: string;
  claimedById: string | null;
  createdAt: string;
  closedAt: string | null;
  category: { name: string; emoji: string };
  rating: { score: number } | null;
}

export default function TicketsPage() {
  const [items, setItems] = useState<TicketRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const pageSize = 20;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    fetch(`/api/tickets?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [page, status, search]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Тикеты</h1>
        <p className="text-sm text-muted">Всего найдено: {total}</p>
      </div>

      <div className="card flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="input pl-9"
            placeholder="Поиск по номеру, автору, каналу…"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        <select
          className="input max-w-[180px]"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
        >
          <option value="">Все статусы</option>
          <option value="OPEN">Открытые</option>
          <option value="CLAIMED">В работе</option>
          <option value="CLOSED">Закрытые</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="skeleton h-14" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 py-12 text-center">
          <Inbox size={32} aria-hidden="true" className="text-muted" />
          <p className="text-sm text-muted">Ничего не найдено.</p>
        </div>
      ) : (
        <>
          {/* Мобильная раскладка — карточки вместо горизонтально скроллящейся таблицы. */}
          <div className="space-y-2 sm:hidden">
            {items.map((ticket) => (
              <Link
                key={ticket.id}
                href={`/tickets/${ticket.id}`}
                className="card flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-white">
                    №{ticket.number} · {ticket.category.name}
                  </p>
                  <p className="truncate text-xs text-muted">{ticket.authorId}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <TicketStatusBadge status={ticket.status} />
                    {ticket.rating && <Rating score={ticket.rating.score} />}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="card hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left text-muted">
                  <th className="pb-2">№</th>
                  <th className="pb-2">Категория</th>
                  <th className="pb-2">Статус</th>
                  <th className="pb-2">Автор</th>
                  <th className="pb-2">Создан</th>
                  <th className="pb-2">Оценка</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((ticket) => (
                  <tr key={ticket.id} className="border-b border-surface-border/50">
                    <td className="py-2 font-medium text-white">№{ticket.number}</td>
                    <td className="py-2">
                      {ticket.category.emoji} {ticket.category.name}
                    </td>
                    <td className="py-2">
                      <TicketStatusBadge status={ticket.status} />
                    </td>
                    <td className="py-2 text-muted">{ticket.authorId}</td>
                    <td className="py-2 text-muted">
                      {new Date(ticket.createdAt).toLocaleString('ru-RU')}
                    </td>
                    <td className="py-2">{ticket.rating ? <Rating score={ticket.rating.score} /> : '—'}</td>
                    <td className="py-2 text-right">
                      <Link href={`/tickets/${ticket.id}`} className="text-brand hover:underline">
                        Открыть
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="flex items-center justify-between text-sm text-muted">
        <button
          className="btn-secondary"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Назад
        </button>
        <span>
          Страница {page} из {totalPages}
        </span>
        <button
          className="btn-secondary"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Далее
        </button>
      </div>
    </div>
  );
}
