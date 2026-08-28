'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/clientApi';

interface UserRow {
  discordUserId: string;
  username: string;
  globalName: string | null;
  avatarUrl: string | null;
  roleIds: string[];
  joinedAt: string | null;
  refreshedAt: string;
  ticketCount: number;
  staffAverageRating: number | null;
  staffRatingCount: number;
}

export default function UsersPage() {
  const [items, setItems] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const pageSize = 25;

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search) params.set('search', search);
    const res = await fetch(`/api/users?${params}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items);
      setTotal(data.total);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [page, search]);

  async function handleSync() {
    setSyncing(true);
    await apiFetch('/api/users/sync', { method: 'POST' });
    await load();
    setSyncing(false);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Пользователи сервера</h1>
          <p className="text-sm text-muted">
            Данные обновляются ботом каждые 15 минут. Всего: {total}
          </p>
        </div>
        <button className="btn-secondary" disabled={syncing} onClick={handleSync}>
          {syncing ? 'Обновляю…' : 'Обновить сейчас'}
        </button>
      </div>

      <input
        className="input max-w-sm"
        placeholder="Поиск по имени или Discord ID…"
        value={search}
        onChange={(e) => {
          setPage(1);
          setSearch(e.target.value);
        }}
      />

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-sm text-muted">Загрузка…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted">
            Пользователи не найдены. Нажмите «Обновить сейчас», если бот только запущен.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-left text-muted">
                <th className="pb-2">Пользователь</th>
                <th className="pb-2">Discord ID</th>
                <th className="pb-2">Вступил</th>
                <th className="pb-2">Тикетов создано</th>
                <th className="pb-2">Средняя оценка (как сотрудник)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((user) => (
                <tr key={user.discordUserId} className="border-b border-surface-border/50">
                  <td className="flex items-center gap-2 py-2">
                    {user.avatarUrl && (
                      <Image
                        src={user.avatarUrl}
                        alt=""
                        width={24}
                        height={24}
                        className="rounded-full"
                        unoptimized
                      />
                    )}
                    {user.globalName ?? user.username}
                  </td>
                  <td className="py-2 text-muted">{user.discordUserId}</td>
                  <td className="py-2 text-muted">
                    {user.joinedAt ? new Date(user.joinedAt).toLocaleDateString('ru-RU') : '—'}
                  </td>
                  <td className="py-2">{user.ticketCount}</td>
                  <td className="py-2">
                    {user.staffAverageRating
                      ? `${user.staffAverageRating.toFixed(2)} (${user.staffRatingCount})`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
