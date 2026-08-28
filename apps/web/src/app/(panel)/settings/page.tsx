'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/clientApi';

export default function SettingsPage() {
  const [defaultLogChannelId, setDefaultLogChannelId] = useState('');
  const [defaultTranscriptChannelId, setDefaultTranscriptChannelId] = useState('');
  const [ticketNamePattern, setTicketNamePattern] = useState('ticket-{number}');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        setDefaultLogChannelId(data.defaultLogChannelId ?? '');
        setDefaultTranscriptChannelId(data.defaultTranscriptChannelId ?? '');
        setTicketNamePattern(data.ticketNamePattern ?? 'ticket-{number}');
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const res = await apiFetch('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify({
        defaultLogChannelId: defaultLogChannelId || null,
        defaultTranscriptChannelId: defaultTranscriptChannelId || null,
        ticketNamePattern,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setMessage(res.ok ? 'Настройки сохранены' : (body.error ?? 'Не удалось сохранить настройки'));
    setSaving(false);
  }

  if (loading) return <p className="text-sm text-muted">Загрузка…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Общие настройки</h1>
        <p className="text-sm text-muted">
          Значения по умолчанию — категории могут переопределять их своими каналами
          логов/транскриптов.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card max-w-xl space-y-4">
        {message && (
          <p className="rounded-lg bg-brand/10 px-3 py-2 text-sm text-brand-accent">{message}</p>
        )}

        <div>
          <label className="label">Канал логов по умолчанию (ID)</label>
          <input
            className="input"
            value={defaultLogChannelId}
            onChange={(e) => setDefaultLogChannelId(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Канал транскриптов по умолчанию (ID)</label>
          <input
            className="input"
            value={defaultTranscriptChannelId}
            onChange={(e) => setDefaultTranscriptChannelId(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Шаблон имени канала тикета</label>
          <input
            className="input"
            value={ticketNamePattern}
            onChange={(e) => setTicketNamePattern(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted">
            Доступные плейсхолдеры: {'{number}'}, {'{category}'}
          </p>
        </div>

        <button type="submit" disabled={saving} className="btn-primary">
          Сохранить
        </button>
      </form>
    </div>
  );
}
