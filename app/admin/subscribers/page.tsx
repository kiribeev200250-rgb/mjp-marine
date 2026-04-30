'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/admin/Toast';
import { useAdminT } from '@/components/admin/AdminProviders';

interface Subscriber {
  id: number; name: string; email: string; language: string; active: boolean; createdAt: string;
}

export default function SubscribersAdmin() {
  const [subs, setSubs] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const { ToastEl, showToast } = useToast();
  const { T } = useAdminT();

  async function load() {
    const res = await fetch('/api/admin/subscribers');
    setSubs(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleActive(id: number, active: boolean) {
    await fetch('/api/admin/subscribers', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, active: !active }) });
    load();
  }

  async function del(id: number) {
    if (!confirm(T.subs_confirm_delete)) return;
    const res = await fetch(`/api/admin/subscribers/${id}`, { method: 'DELETE' });
    if (res.ok) { showToast(T.toast_deleted); load(); }
    else showToast(T.toast_delete_error, 'error');
  }

  async function bulkDelete() {
    if (!confirm(`${T.subs_delete_selected} ${selected.size} ${T.subs_confirm_bulk}`)) return;
    await Promise.all(Array.from(selected).map((id) => fetch(`/api/admin/subscribers/${id}`, { method: 'DELETE' })));
    showToast(`${T.toast_deleted}: ${selected.size}`);
    setSelected(new Set<number>());
    load();
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set<number>(filtered.map((s) => s.id)) : new Set<number>());
  }

  const filtered = search
    ? subs.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase()))
    : subs;

  const activeCount = subs.filter((s) => s.active).length;

  return (
    <div>
      {ToastEl}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-3xl font-bold text-navy">{T.subs_title}</h1>
          <p className="text-gray-400 text-sm mt-1">{activeCount} {T.subs_active_of} {subs.length} {T.subs_total}</p>
        </div>
        <button onClick={() => window.open('/api/admin/subscribers/export', '_blank')} className="btn-primary">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          {T.subs_export}
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <input type="search" placeholder={T.subs_search} value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-navy" />
        {selected.size > 0 && (
          <button onClick={bulkDelete} className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            {T.subs_delete_selected} {selected.size} {T.subs_selected}
          </button>
        )}
      </div>

      {loading ? <p className="text-gray-400">{T.subs_loading}</p> : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="py-3 px-4 w-10">
                  <input type="checkbox" onChange={(e) => toggleAll(e.target.checked)} checked={filtered.length > 0 && filtered.every((s) => selected.has(s.id))} className="rounded" />
                </th>
                <th className="text-left py-3 px-2 text-gray-400 font-medium">{T.subs_col_name}</th>
                <th className="text-left py-3 px-2 text-gray-400 font-medium">{T.subs_col_email}</th>
                <th className="text-left py-3 px-2 text-gray-400 font-medium">{T.subs_col_lang}</th>
                <th className="text-left py-3 px-2 text-gray-400 font-medium">{T.subs_col_joined}</th>
                <th className="text-left py-3 px-2 text-gray-400 font-medium">{T.subs_col_status}</th>
                <th className="py-3 px-4 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className={`border-b border-gray-50 hover:bg-gray-50 ${selected.has(s.id) ? 'bg-blue-50/50' : ''}`}>
                  <td className="py-3 px-4"><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} className="rounded" /></td>
                  <td className="py-3 px-2 font-medium text-navy">{s.name}</td>
                  <td className="py-3 px-2 text-gray-600">{s.email}</td>
                  <td className="py-3 px-2"><span className="text-xs bg-gray-100 rounded-full px-2 py-0.5 uppercase">{s.language}</span></td>
                  <td className="py-3 px-2 text-gray-400 text-xs">{new Date(s.createdAt).toLocaleDateString()}</td>
                  <td className="py-3 px-2">
                    <button onClick={() => toggleActive(s.id, s.active)} className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${s.active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {s.active ? T.subs_active : T.subs_inactive}
                    </button>
                  </td>
                  <td className="py-3 px-4">
                    <button onClick={() => del(s.id)} className="p-1 text-red-400 hover:text-red-600 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-center text-gray-400 py-8">{search ? T.subs_no_results : T.subs_none}</p>}
        </div>
      )}
    </div>
  );
}
