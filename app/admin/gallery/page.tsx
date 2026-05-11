'use client';

import { useEffect, useState } from 'react';

interface GalleryItem {
  id: number;
  title: string;
  titleEs: string;
  titleRu: string;
  titleUk: string;
  description: string;
  descEs: string;
  descRu: string;
  descUk: string;
  beforeUrl: string;
  afterUrl: string;
  serviceTag: string;
  sortOrder: number;
  visible: boolean;
}

const empty: Omit<GalleryItem, 'id'> = {
  title: '', titleEs: '', titleRu: '', titleUk: '',
  description: '', descEs: '', descRu: '', descUk: '',
  beforeUrl: '', afterUrl: '', serviceTag: '', sortOrder: 0, visible: true,
};

export default function AdminGalleryPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [form, setForm] = useState<Omit<GalleryItem, 'id'>>(empty);
  const [editing, setEditing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [uploading, setUploading] = useState<'before' | 'after' | null>(null);

  async function load() {
    const res = await fetch('/api/admin/gallery');
    if (res.ok) setItems(await res.json());
  }

  useEffect(() => { load(); }, []);

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 3000); }

  function startEdit(item: GalleryItem) {
    setEditing(item.id);
    setForm({ title: item.title, titleEs: item.titleEs, titleRu: item.titleRu, titleUk: item.titleUk,
      description: item.description, descEs: item.descEs, descRu: item.descRu, descUk: item.descUk,
      beforeUrl: item.beforeUrl, afterUrl: item.afterUrl, serviceTag: item.serviceTag,
      sortOrder: item.sortOrder, visible: item.visible });
  }

  function cancelEdit() { setEditing(null); setForm(empty); }

  async function handleUpload(field: 'beforeUrl' | 'afterUrl', file: File) {
    setUploading(field === 'beforeUrl' ? 'before' : 'after');
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    setUploading(null);
    if (res.ok) {
      const { url } = await res.json();
      setForm(f => ({ ...f, [field]: url }));
    }
  }

  async function handleSave() {
    setSaving(true);
    if (editing !== null) {
      await fetch(`/api/admin/gallery/${editing}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      flash('Updated.');
    } else {
      await fetch('/api/admin/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      flash('Added.');
    }
    setSaving(false);
    cancelEdit();
    load();
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this gallery item?')) return;
    await fetch(`/api/admin/gallery/${id}`, { method: 'DELETE' });
    load();
  }

  async function toggleVisible(item: GalleryItem) {
    await fetch(`/api/admin/gallery/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visible: !item.visible }),
    });
    load();
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy/20';

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-heading font-bold text-navy mb-6">Before & After Gallery</h1>

      {msg && <div className="mb-4 px-4 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{msg}</div>}

      {/* Form */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-8 shadow-sm">
        <h2 className="font-semibold text-navy mb-4">{editing !== null ? 'Edit item' : 'Add new item'}</h2>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Title (EN)</label>
            <input className={inputCls} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Service Tag</label>
            <input className={inputCls} placeholder="e.g. Hull Polishing" value={form.serviceTag} onChange={e => setForm(f => ({ ...f, serviceTag: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Title ES</label>
            <input className={inputCls} value={form.titleEs} onChange={e => setForm(f => ({ ...f, titleEs: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Title RU</label>
            <input className={inputCls} value={form.titleRu} onChange={e => setForm(f => ({ ...f, titleRu: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Title UK</label>
            <input className={inputCls} value={form.titleUk} onChange={e => setForm(f => ({ ...f, titleUk: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Sort Order</label>
            <input type="number" className={inputCls} value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Description (EN)</label>
          <textarea className={inputCls} rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>

        {/* Image uploads */}
        <div className="grid md:grid-cols-2 gap-6 mb-4">
          {(['beforeUrl', 'afterUrl'] as const).map((field) => {
            const label = field === 'beforeUrl' ? 'Before Image' : 'After Image';
            const loadingKey = field === 'beforeUrl' ? 'before' : 'after';
            return (
              <div key={field}>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</label>
                {form[field] && (
                  <img src={form[field]} alt={label} className="w-full aspect-video object-cover rounded-lg mb-2 border border-gray-100" />
                )}
                <div className="flex gap-2">
                  <input
                    className={`${inputCls} flex-1`}
                    placeholder="https://..."
                    value={form[field]}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                  />
                  <label className="relative cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={e => e.target.files?.[0] && handleUpload(field, e.target.files[0])}
                    />
                    <span className="px-3 py-2 bg-navy text-white text-xs rounded-lg hover:bg-navy-light transition-colors whitespace-nowrap">
                      {uploading === loadingKey ? '...' : 'Upload'}
                    </span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 mb-4">
          <input type="checkbox" id="visible" checked={form.visible} onChange={e => setForm(f => ({ ...f, visible: e.target.checked }))} className="w-4 h-4" />
          <label htmlFor="visible" className="text-sm text-gray-600">Visible on site</label>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !form.title || !form.beforeUrl || !form.afterUrl}
            className="px-5 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-light transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : editing !== null ? 'Update' : 'Add Item'}
          </button>
          {editing !== null && (
            <button onClick={cancelEdit} className="px-5 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Items list */}
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className={`bg-white border rounded-xl p-4 flex items-center gap-4 shadow-sm ${!item.visible ? 'opacity-50' : ''}`}>
            <div className="flex gap-2 shrink-0">
              {item.beforeUrl && <img src={item.beforeUrl} alt="before" className="w-16 h-12 object-cover rounded-lg border border-gray-100" />}
              {item.afterUrl && <img src={item.afterUrl} alt="after" className="w-16 h-12 object-cover rounded-lg border border-gold/30" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-navy text-sm truncate">{item.title}</p>
              {item.serviceTag && <span className="text-xs text-gold bg-gold/10 px-2 py-0.5 rounded-full">{item.serviceTag}</span>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => toggleVisible(item)}
                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${item.visible ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100' : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
              >
                {item.visible ? 'Visible' : 'Hidden'}
              </button>
              <button onClick={() => startEdit(item)} className="text-xs px-3 py-1 border border-navy/20 text-navy rounded-lg hover:bg-navy/5 transition-colors">
                Edit
              </button>
              <button onClick={() => handleDelete(item.id)} className="text-xs px-3 py-1 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                Delete
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-10">No gallery items yet. Add one above.</p>
        )}
      </div>
    </div>
  );
}
