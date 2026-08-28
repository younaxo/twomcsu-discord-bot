'use client';

import { useEffect, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { apiFetch } from '@/lib/clientApi';

interface Category {
  id: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
  welcomeMessage: string;
  discordCategoryId: string | null;
  parentChannelId: string | null;
  autoArchiveMinutes: number;
  supportRoleIds: string[];
  logChannelId: string | null;
  transcriptChannelId: string | null;
  maxActiveTicketsPerUser: number;
  isEnabled: boolean;
}

const AUTO_ARCHIVE_OPTIONS = [
  { value: 60, label: '1 час' },
  { value: 1440, label: '1 день' },
  { value: 4320, label: '3 дня' },
  { value: 10080, label: '7 дней' },
];

const emptyForm = {
  name: '',
  description: '',
  emoji: '🎫',
  color: '#c2410c',
  welcomeMessage: 'Спасибо за обращение! Опишите вашу проблему, и поддержка скоро подключится.',
  discordCategoryId: '',
  parentChannelId: '',
  autoArchiveMinutes: 4320,
  supportRoleIds: '',
  logChannelId: '',
  transcriptChannelId: '',
  maxActiveTicketsPerUser: 1,
  isEnabled: true,
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/categories');
    if (res.ok) setCategories(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(category: Category) {
    setEditingId(category.id);
    setForm({
      name: category.name,
      description: category.description,
      emoji: category.emoji,
      color: category.color,
      welcomeMessage: category.welcomeMessage,
      discordCategoryId: category.discordCategoryId ?? '',
      parentChannelId: category.parentChannelId ?? '',
      autoArchiveMinutes: category.autoArchiveMinutes,
      supportRoleIds: category.supportRoleIds.join(', '),
      logChannelId: category.logChannelId ?? '',
      transcriptChannelId: category.transcriptChannelId ?? '',
      maxActiveTicketsPerUser: category.maxActiveTicketsPerUser,
      isEnabled: category.isEnabled,
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      ...form,
      discordCategoryId: form.discordCategoryId || null,
      parentChannelId: form.parentChannelId || null,
      logChannelId: form.logChannelId || null,
      transcriptChannelId: form.transcriptChannelId || null,
      supportRoleIds: form.supportRoleIds
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
      maxActiveTicketsPerUser: Number(form.maxActiveTicketsPerUser),
      autoArchiveMinutes: Number(form.autoArchiveMinutes),
    };

    const res = await apiFetch(editingId ? `/api/categories/${editingId}` : '/api/categories', {
      method: editingId ? 'PATCH' : 'POST',
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Не удалось сохранить категорию');
      setSaving(false);
      return;
    }

    resetForm();
    setSaving(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить категорию? Это действие необратимо.')) return;
    const res = await apiFetch(`/api/categories/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? 'Не удалось удалить категорию');
      return;
    }
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Категории тикетов</h1>
        <p className="text-sm text-muted">
          Правила создания ветки тикета, роли поддержки и тексты для каждой категории.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <h2 className="font-medium text-white">
          {editingId ? 'Редактирование категории' : 'Новая категория'}
        </h2>
        {error && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Название</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Emoji для Discord-панели</label>
            <input
              className="input"
              value={form.emoji}
              onChange={(e) => setForm({ ...form, emoji: e.target.value })}
              required
            />
            <p className="mt-1 text-xs text-muted">
              Discord не поддерживает произвольные SVG-иконки в кнопках — только текст и
              unicode/кастомные emoji сервера.
            </p>
          </div>
        </div>

        <div>
          <label className="label">Описание (видно в панели создания)</label>
          <input
            className="input"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <div>
          <label className="label">Приветственное сообщение в ветке тикета</label>
          <textarea
            className="input min-h-24"
            value={form.welcomeMessage}
            onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })}
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Родительский канал для веток тикетов</label>
            <input
              className="input"
              value={form.parentChannelId}
              onChange={(e) => setForm({ ...form, parentChannelId: e.target.value })}
              placeholder="ID текстового канала"
              required
            />
            <p className="mt-1 text-xs text-muted">
              Все новые тикеты этой категории создаются как приватные ветки в этом канале. Выдайте
              ролям поддержки право «Управление ветками» на канале — тогда они будут видеть все
              ветки автоматически.
            </p>
          </div>
          <div>
            <label className="label">Автоархивация ветки</label>
            <select
              className="input"
              value={form.autoArchiveMinutes}
              onChange={(e) => setForm({ ...form, autoArchiveMinutes: Number(e.target.value) })}
            >
              {AUTO_ARCHIVE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} бездействия
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Цвет embed</label>
            <input
              type="color"
              className="input h-11"
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Лимит активных тикетов на пользователя</label>
            <input
              type="number"
              min={1}
              max={10}
              className="input"
              value={form.maxActiveTicketsPerUser}
              onChange={(e) =>
                setForm({ ...form, maxActiveTicketsPerUser: Number(e.target.value) })
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="label">ID категории Discord (устарело)</label>
            <input
              className="input"
              value={form.discordCategoryId}
              onChange={(e) => setForm({ ...form, discordCategoryId: e.target.value })}
              placeholder="Не используется новыми тикетами"
            />
          </div>
          <div>
            <label className="label">Канал логов</label>
            <input
              className="input"
              value={form.logChannelId}
              onChange={(e) => setForm({ ...form, logChannelId: e.target.value })}
              placeholder="ID канала"
            />
          </div>
          <div>
            <label className="label">Канал транскриптов</label>
            <input
              className="input"
              value={form.transcriptChannelId}
              onChange={(e) => setForm({ ...form, transcriptChannelId: e.target.value })}
              placeholder="ID канала"
            />
          </div>
        </div>

        <div>
          <label className="label">Роли поддержки (ID через запятую)</label>
          <input
            className="input"
            value={form.supportRoleIds}
            onChange={(e) => setForm({ ...form, supportRoleIds: e.target.value })}
          />
        </div>

        <label className="flex min-h-11 items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={form.isEnabled}
            onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })}
          />
          Категория активна (доступна для создания тикетов)
        </label>

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {editingId ? 'Сохранить изменения' : 'Создать категорию'}
          </button>
          {editingId && (
            <button type="button" className="btn-secondary" onClick={resetForm}>
              Отмена
            </button>
          )}
        </div>
      </form>

      <div className="card">
        <h2 className="mb-4 font-medium text-white">Список категорий</h2>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="skeleton h-16" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <p className="text-sm text-muted">Категорий пока нет — создайте первую выше.</p>
        ) : (
          <div className="space-y-2">
            {categories.map((category) => (
              <div
                key={category.id}
                className="flex flex-col gap-3 rounded-lg border border-surface-border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl" aria-hidden="true">
                    {category.emoji}
                  </span>
                  <div>
                    <p className="font-medium text-white">{category.name}</p>
                    <p className="text-xs text-muted">
                      {category.isEnabled ? 'Активна' : 'Отключена'} · лимит{' '}
                      {category.maxActiveTicketsPerUser} на пользователя
                    </p>
                    {!category.parentChannelId && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-warning">
                        <TriangleAlert size={13} aria-hidden="true" />
                        Не настроен родительский канал — новые тикеты создавать нельзя
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn-secondary" onClick={() => startEdit(category)}>
                    Изменить
                  </button>
                  <button className="btn-danger" onClick={() => handleDelete(category.id)}>
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
