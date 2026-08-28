'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/clientApi';

interface Category {
  id: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
  welcomeMessage: string;
  discordCategoryId: string | null;
  supportRoleIds: string[];
  logChannelId: string | null;
  transcriptChannelId: string | null;
  maxActiveTicketsPerUser: number;
  isEnabled: boolean;
}

const emptyForm = {
  name: '',
  description: '',
  emoji: '🎫',
  color: '#5865f2',
  welcomeMessage: 'Спасибо за обращение! Опишите вашу проблему, и поддержка скоро подключится.',
  discordCategoryId: '',
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
      logChannelId: form.logChannelId || null,
      transcriptChannelId: form.transcriptChannelId || null,
      supportRoleIds: form.supportRoleIds
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
      maxActiveTicketsPerUser: Number(form.maxActiveTicketsPerUser),
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
        <p className="text-sm text-slate-400">
          Правила создания канала, роли поддержки и тексты для каждой категории.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <h2 className="font-medium text-white">
          {editingId ? 'Редактирование категории' : 'Новая категория'}
        </h2>
        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
        )}

        <div className="grid grid-cols-2 gap-4">
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
            <label className="label">Emoji</label>
            <input
              className="input"
              value={form.emoji}
              onChange={(e) => setForm({ ...form, emoji: e.target.value })}
              required
            />
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
          <label className="label">Приветственное сообщение в канале тикета</label>
          <textarea
            className="input min-h-24"
            value={form.welcomeMessage}
            onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Цвет embed</label>
            <input
              type="color"
              className="input h-10"
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

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">ID категории Discord</label>
            <input
              className="input"
              value={form.discordCategoryId}
              onChange={(e) => setForm({ ...form, discordCategoryId: e.target.value })}
              placeholder="Необязательно"
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

        <label className="flex items-center gap-2 text-sm text-slate-300">
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
          <p className="text-sm text-slate-400">Загрузка…</p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-slate-400">Категорий пока нет — создайте первую выше.</p>
        ) : (
          <div className="space-y-2">
            {categories.map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between rounded-lg border border-surface-border p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{category.emoji}</span>
                  <div>
                    <p className="font-medium text-white">{category.name}</p>
                    <p className="text-xs text-slate-400">
                      {category.isEnabled ? 'Активна' : 'Отключена'} · лимит{' '}
                      {category.maxActiveTicketsPerUser} на пользователя
                    </p>
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
