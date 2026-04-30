'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/admin/Toast';
import { useAdminT } from '@/components/admin/AdminProviders';

interface Service {
  id?: number;
  icon: string;
  nameEn: string; nameEs: string; nameRu: string; nameUk: string;
  descEn: string; descEs: string; descRu: string; descUk: string;
  priceLabel: string;
  sortOrder: number;
}

const empty: Service = {
  icon: '⚓', nameEn: '', nameEs: '', nameRu: '', nameUk: '',
  descEn: '', descEs: '', descRu: '', descUk: '',
  priceLabel: '', sortOrder: 0,
};

type Lang = 'En' | 'Es' | 'Ru' | 'Uk';
const LANG_LABELS: Record<Lang, string> = { En: 'EN', Es: 'ES', Ru: 'RU', Uk: 'UK' };

export default function ServicesAdmin() {
  const [services, setServices] = useState<Service[]>([]);
  const [editing, setEditing] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeLang, setActiveLang] = useState<Lang>('En');
  const { ToastEl, showToast } = useToast();
  const { T } = useAdminT();

  async function load() {
    const res = await fetch('/api/admin/services');
    setServices(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save() {
    const method = editing?.id ? 'PUT' : 'POST';
    const url = editing?.id ? `/api/admin/services/${editing.id}` : '/api/admin/services';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
    if (res.ok) {
      showToast(editing?.id ? T.toast_service_updated : T.toast_service_added);
      setEditing(null);
      load();
    } else {
      showToast(T.toast_save_error, 'error');
    }
  }

  async function del(id: number) {
    if (!confirm(T.services_confirm_delete)) return;
    const res = await fetch(`/api/admin/services/${id}`, { method: 'DELETE' });
    if (res.ok) { showToast(T.toast_deleted); load(); }
    else showToast(T.toast_delete_error, 'error');
  }

  async function move(index: number, direction: 'up' | 'down') {
    const next = [...services];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= next.length) return;
    const aOrder = next[index].sortOrder;
    const bOrder = next[swapIndex].sortOrder;
    await Promise.all([
      fetch(`/api/admin/services/${next[index].id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...next[index], sortOrder: bOrder }) }),
      fetch(`/api/admin/services/${next[swapIndex].id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...next[swapIndex], sortOrder: aOrder }) }),
    ]);
    load();
  }

  const ic = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-navy';

  return (
    <div>
      {ToastEl}
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-heading text-3xl font-bold text-navy">{T.services_title}</h1>
        <button className="btn-primary" onClick={() => { setEditing({ ...empty }); setActiveLang('En'); }}>
          {T.services_add}
        </button>
      </div>

      {loading ? <p className="text-gray-400">{T.services_loading}</p> : (
        <div className="space-y-2">
          {services.map((s, i) => (
            <div key={s.id} className="card flex items-center gap-4 py-4">
              <span className="text-3xl w-10 text-center">{s.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-navy">{s.nameEn}</p>
                <p className="text-sm text-gray-400">{s.priceLabel} · {T.services_order_label} {s.sortOrder}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => move(i, 'up')} disabled={i === 0} className="p-1.5 rounded border border-gray-200 hover:border-navy disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="↑">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
                </button>
                <button onClick={() => move(i, 'down')} disabled={i === services.length - 1} className="p-1.5 rounded border border-gray-200 hover:border-navy disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="↓">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditing(s); setActiveLang('En'); }} className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:border-navy transition-colors">{T.services_edit}</button>
                <button onClick={() => del(s.id!)} className="p-1.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors" title="Delete">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <h2 className="font-heading text-xl font-bold text-navy mb-6">
              {editing.id ? T.services_edit_title : T.services_add_title}
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">{T.services_icon}</label>
                  <input value={editing.icon} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} className={ic} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">{T.services_price}</label>
                  <input value={editing.priceLabel} onChange={(e) => setEditing({ ...editing, priceLabel: e.target.value })} className={ic} placeholder="from €180" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">{T.services_sort_order}</label>
                <input type="number" value={editing.sortOrder} onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value) })} className={ic} />
              </div>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
                {(['En', 'Es', 'Ru', 'Uk'] as Lang[]).map((l) => (
                  <button key={l} type="button" onClick={() => setActiveLang(l)} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeLang === l ? 'bg-white shadow text-navy' : 'text-gray-500 hover:text-navy'}`}>
                    {LANG_LABELS[l]}
                  </button>
                ))}
              </div>
              <div className="border border-gray-100 rounded-xl p-4 space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{T.services_name}</label>
                  <input value={(editing as unknown as Record<string, string>)[`name${activeLang}`]} onChange={(e) => setEditing({ ...editing, [`name${activeLang}`]: e.target.value })} className={ic} />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{T.services_desc}</label>
                  <textarea value={(editing as unknown as Record<string, string>)[`desc${activeLang}`]} onChange={(e) => setEditing({ ...editing, [`desc${activeLang}`]: e.target.value })} rows={3} className={ic} />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={save} className="btn-primary flex-1 py-2.5">{T.services_save}</button>
              <button onClick={() => setEditing(null)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">{T.services_cancel}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
