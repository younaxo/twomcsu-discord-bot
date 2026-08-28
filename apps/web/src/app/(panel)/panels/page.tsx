'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/clientApi';

interface Category {
  id: string;
  name: string;
  emoji: string;
  isEnabled: boolean;
}

interface Panel {
  id: string;
  channelId: string;
  title: string;
  description: string;
  componentType: 'BUTTONS' | 'SELECT_MENU';
  messageId: string | null;
  categories: { category: Category; position: number }[];
}

interface PanelForm {
  channelId: string;
  title: string;
  description: string;
  componentType: 'BUTTONS' | 'SELECT_MENU';
  categoryIds: string[];
}

const emptyForm: PanelForm = {
  channelId: '',
  title: 'Создать тикет',
  description: 'Выберите категорию обращения ниже.',
  componentType: 'BUTTONS',
  categoryIds: [],
};

export default function PanelsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [form, setForm] = useState<PanelForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [categoriesRes, panelsRes] = await Promise.all([
      fetch('/api/categories'),
      fetch('/api/panels'),
    ]);
    if (categoriesRes.ok) setCategories(await categoriesRes.json());
    if (panelsRes.ok) setPanels(await panelsRes.json());
  }

  useEffect(() => {
    load();
  }, []);

  function toggleCategory(id: string) {
    setForm((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(id)
        ? prev.categoryIds.filter((c) => c !== id)
        : [...prev.categoryIds, id],
    }));
  }

  function startEdit(panel: Panel) {
    setEditingId(panel.id);
    setForm({
      channelId: panel.channelId,
      title: panel.title,
      description: panel.description,
      componentType: panel.componentType,
      categoryIds: panel.categories
        .sort((a, b) => a.position - b.position)
        .map((c) => c.category.id),
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

    if (form.categoryIds.length === 0) {
      setError('Выберите хотя бы одну категорию');
      setSaving(false);
      return;
    }

    const res = await apiFetch(editingId ? `/api/panels/${editingId}` : '/api/panels', {
      method: editingId ? 'PATCH' : 'POST',
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Не удалось сохранить панель');
      setSaving(false);
      return;
    }

    resetForm();
    setSaving(false);
    load();
  }

  async function handlePublish(id: string) {
    setStatus('Публикую…');
    const res = await apiFetch(`/api/panels/${id}/publish`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    setStatus(
      res.ok
        ? body.updated
          ? 'Панель обновлена в Discord'
          : 'Панель опубликована в Discord'
        : (body.error ?? 'Ошибка публикации'),
    );
    load();
  }

  const selectedCategories = categories.filter((c) => form.categoryIds.includes(c.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Панели создания тикетов</h1>
        <p className="text-sm text-muted">
          Соберите сообщение с кнопками или select-меню и опубликуйте его в нужном канале.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={handleSubmit} className="card space-y-4">
          <h2 className="font-medium text-white">
            {editingId ? 'Редактирование панели' : 'Новая панель'}
          </h2>
          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
          )}

          <div>
            <label className="label">ID канала для публикации</label>
            <input
              className="input"
              value={form.channelId}
              onChange={(e) => setForm({ ...form, channelId: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Заголовок</label>
            <input
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Описание</label>
            <textarea
              className="input min-h-20"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Тип компонента</label>
            <select
              className="input"
              value={form.componentType}
              onChange={(e) =>
                setForm({ ...form, componentType: e.target.value as 'BUTTONS' | 'SELECT_MENU' })
              }
            >
              <option value="BUTTONS">Кнопки</option>
              <option value="SELECT_MENU">Select-меню</option>
            </select>
          </div>
          <div>
            <label className="label">Категории (порядок = порядок выбора)</label>
            <div className="space-y-1.5">
              {categories.map((category) => (
                <label key={category.id} className="flex items-center gap-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={form.categoryIds.includes(category.id)}
                    onChange={() => toggleCategory(category.id)}
                  />
                  {category.emoji} {category.name}
                  {!category.isEnabled && (
                    <span className="badge bg-slate-700 text-muted">отключена</span>
                  )}
                </label>
              ))}
              {categories.length === 0 && (
                <p className="text-xs text-muted">Сначала создайте категории тикетов.</p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary">
              {editingId ? 'Сохранить' : 'Создать панель'}
            </button>
            {editingId && (
              <button type="button" className="btn-secondary" onClick={resetForm}>
                Отмена
              </button>
            )}
          </div>
        </form>

        <div className="card">
          <h2 className="mb-3 font-medium text-white">Предпросмотр</h2>
          <div className="rounded-lg bg-[#313338] p-4">
            <p className="font-semibold text-white">{form.title || 'Заголовок панели'}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted">
              {form.description || 'Описание панели'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {form.componentType === 'BUTTONS' ? (
                selectedCategories.map((c) => (
                  <span key={c.id} className="rounded-md bg-brand px-3 py-1.5 text-sm text-white">
                    {c.emoji} {c.name}
                  </span>
                ))
              ) : (
                <div className="w-full rounded-md border border-white/10 bg-[#1e1f22] px-3 py-2 text-sm text-muted">
                  {selectedCategories.length > 0
                    ? 'Выберите категорию обращения ▾'
                    : 'Категории не выбраны'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {status && <p className="text-sm text-brand-accent">{status}</p>}

      <div className="card">
        <h2 className="mb-4 font-medium text-white">Опубликованные панели</h2>
        {panels.length === 0 ? (
          <p className="text-sm text-muted">Панелей пока нет.</p>
        ) : (
          <div className="space-y-2">
            {panels.map((panel) => (
              <div
                key={panel.id}
                className="flex items-center justify-between rounded-lg border border-surface-border p-3"
              >
                <div>
                  <p className="font-medium text-white">{panel.title}</p>
                  <p className="text-xs text-muted">
                    Канал: {panel.channelId} ·{' '}
                    {panel.messageId ? 'опубликована' : 'ещё не опубликована'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-secondary" onClick={() => startEdit(panel)}>
                    Изменить
                  </button>
                  <button className="btn-primary" onClick={() => handlePublish(panel.id)}>
                    {panel.messageId ? 'Обновить в Discord' : 'Опубликовать'}
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
