'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/admin/Toast';
import { useAdminT } from '@/components/admin/AdminProviders';

interface Testimonial {
  id?: number;
  name: string; boatType: string; marina: string; rating: number; visible: boolean;
  textEn: string; textEs: string; textRu: string; textUk: string;
}

const empty: Testimonial = { name: '', boatType: '', marina: '', rating: 5, visible: true, textEn: '', textEs: '', textRu: '', textUk: '' };
type Lang = 'En' | 'Es' | 'Ru' | 'Uk';

export default function TestimonialsAdmin() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeLang, setActiveLang] = useState<Lang>('En');
  const { ToastEl, showToast } = useToast();
  const { T } = useAdminT();

  async function load() {
    const res = await fetch('/api/admin/testimonials');
    setItems(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save() {
    const method = editing?.id ? 'PUT' : 'POST';
    const url = editing?.id ? `/api/admin/testimonials/${editing.id}` : '/api/admin/testimonials';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
    if (res.ok) {
      showToast(editing?.id ? T.toast_testimonial_updated : T.toast_testimonial_added);
      setEditing(null);
      load();
    } else {
      showToast(T.toast_save_error, 'error');
    }
  }

  async function del(id: number) {
    if (!confirm(T.testimonials_confirm_delete)) return;
    const res = await fetch(`/api/admin/testimonials/${id}`, { method: 'DELETE' });
    if (res.ok) { showToast(T.toast_deleted); load(); }
    else showToast(T.toast_delete_error, 'error');
  }

  async function toggleVisible(t: Testimonial) {
    await fetch(`/api/admin/testimonials/${t.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...t, visible: !t.visible }),
    });
    load();
  }

  const ic = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-navy';

  return (
    <div>
      {ToastEl}
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-heading text-3xl font-bold text-navy">{T.testimonials_title}</h1>
        <button className="btn-primary" onClick={() => { setEditing({ ...empty }); setActiveLang('En'); }}>{T.testimonials_add}</button>
      </div>

      {loading ? <p className="text-gray-400">{T.testimonials_loading}</p> : (
        <div className="space-y-3">
          {items.map((t) => (
            <div key={t.id} className={`card flex items-start gap-4 ${!t.visible ? 'opacity-50' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-navy">{t.name}</p>
                <p className="text-sm text-gray-400">{t.boatType} · {t.marina} · {'★'.repeat(t.rating)}</p>
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{t.textEn}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => toggleVisible(t)} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${t.visible ? 'border-green-200 text-green-600 hover:bg-green-50' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}>
                  {t.visible ? T.testimonials_visible : T.testimonials_hidden}
                </button>
                <button onClick={() => { setEditing(t); setActiveLang('En'); }} className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:border-navy transition-colors">{T.testimonials_edit}</button>
                <button onClick={() => del(t.id!)} className="p-1.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="text-gray-400 text-sm">{T.testimonials_none}</p>}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <h2 className="font-heading text-xl font-bold text-navy mb-6">{editing.id ? T.testimonials_edit_title : T.testimonials_add_title}</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">{T.testimonials_name}</label>
                  <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={ic} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">{T.testimonials_rating}</label>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map((star) => (
                      <button key={star} type="button" onClick={() => setEditing({ ...editing, rating: star })} className={`text-xl transition-colors ${star <= editing.rating ? 'text-gold' : 'text-gray-300'}`}>★</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">{T.testimonials_boat}</label>
                  <input value={editing.boatType} onChange={(e) => setEditing({ ...editing, boatType: e.target.value })} className={ic} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">{T.testimonials_marina}</label>
                  <input value={editing.marina} onChange={(e) => setEditing({ ...editing, marina: e.target.value })} className={ic} />
                </div>
              </div>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
                {(['En', 'Es', 'Ru', 'Uk'] as Lang[]).map((l) => (
                  <button key={l} type="button" onClick={() => setActiveLang(l)} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeLang === l ? 'bg-white shadow text-navy' : 'text-gray-500 hover:text-navy'}`}>{l}</button>
                ))}
              </div>
              <div className="border border-gray-100 rounded-xl p-4">
                <textarea
                  value={(editing as unknown as Record<string, string>)[`text${activeLang}`]}
                  onChange={(e) => setEditing({ ...editing, [`text${activeLang}`]: e.target.value })}
                  rows={4}
                  className={ic}
                  placeholder={T.testimonials_placeholder}
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editing.visible} onChange={(e) => setEditing({ ...editing, visible: e.target.checked })} className="w-4 h-4 rounded" />
                <span className="text-sm text-gray-600">{T.testimonials_visible_check}</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={save} className="btn-primary flex-1 py-2.5">{T.testimonials_save}</button>
              <button onClick={() => setEditing(null)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">{T.testimonials_cancel}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
