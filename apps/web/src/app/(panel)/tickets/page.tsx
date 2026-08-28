'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

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

const STATUS_LABEL: Record<string, string> = {
  OPEN: '🟢 Открыт',
  CLAIMED: '🟡 В работе',
  CLOSED: '🔴 Закрыт',
};

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
        <p className="text-sm text-slate-400">Всего найдено: {total}</p>
      </div>

      <div className="card flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Поиск по номеру, автору, каналу…"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
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

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-sm text-slate-400">Загрузка…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-400">Ничего не найдено.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-left text-slate-400">
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
                  <td className="py-2">{STATUS_LABEL[ticket.status]}</td>
                  <td className="py-2 text-slate-300">{ticket.authorId}</td>
                  <td className="py-2 text-slate-400">
                    {new Date(ticket.createdAt).toLocaleString('ru-RU')}
                  </td>
                  <td className="py-2">{ticket.rating ? '⭐'.repeat(ticket.rating.score) : '—'}</td>
                  <td className="py-2 text-right">
                    <Link href={`/tickets/${ticket.id}`} className="text-brand hover:underline">
                      Открыть
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-slate-400">
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
