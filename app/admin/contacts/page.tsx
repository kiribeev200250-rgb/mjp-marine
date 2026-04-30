'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/admin/Toast';
import { useAdminT } from '@/components/admin/AdminProviders';

interface Contact {
  id: number; name: string; phone: string; email: string | null;
  marina: string | null; boatType: string | null; service: string | null;
  message: string | null; read: boolean; createdAt: string;
}

export default function ContactsAdmin() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const { ToastEl, showToast } = useToast();
  const { T } = useAdminT();

  async function load() {
    const res = await fetch('/api/admin/contacts');
    setContacts(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function markRead(id: number, read: boolean) {
    const res = await fetch(`/api/admin/contacts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ read }) });
    if (res.ok) setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, read } : c)));
  }

  async function del(id: number) {
    if (!confirm(T.contacts_confirm_delete)) return;
    const res = await fetch(`/api/admin/contacts/${id}`, { method: 'DELETE' });
    if (res.ok) { showToast(T.toast_deleted); load(); }
    else showToast(T.toast_delete_error, 'error');
  }

  const unreadCount = contacts.filter((c) => !c.read).length;

  return (
    <div>
      {ToastEl}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-3xl font-bold text-navy">{T.contacts_title}</h1>
          <p className="text-gray-400 text-sm mt-1">
            {contacts.length} {T.contacts_total}
            {unreadCount > 0 && <span className="ml-2 text-amber-600 font-semibold">{unreadCount} {T.contacts_unread_label}</span>}
          </p>
        </div>
        <button onClick={() => window.open('/api/admin/contacts/export', '_blank')} className="btn-primary">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          {T.contacts_export}
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400">{T.contacts_loading}</p>
      ) : contacts.length === 0 ? (
        <div className="card text-center py-12"><p className="text-gray-400">{T.contacts_none}</p></div>
      ) : (
        <div className="space-y-2">
          {contacts.map((c) => (
            <div key={c.id} className={`card transition-all ${!c.read ? 'border-amber-200 bg-amber-50/30' : ''}`}>
              <div className="flex items-start gap-3">
                {!c.read && <div className="w-2 h-2 rounded-full bg-amber-500 mt-2 shrink-0" />}
                {c.read && <div className="w-2 h-2 mt-2 shrink-0" />}

                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setExpanded((e) => (e === c.id ? null : c.id)); if (!c.read) markRead(c.id, true); }}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`font-semibold text-navy ${!c.read ? 'font-bold' : ''}`}>{c.name}</span>
                    <span className="text-sm text-gray-500">{c.phone}</span>
                    {c.marina && <span className="text-xs bg-gray-100 rounded-full px-2 py-0.5 text-gray-500">{c.marina}</span>}
                    {c.service && <span className="text-xs bg-navy/10 rounded-full px-2 py-0.5 text-navy">{c.service}</span>}
                    <span className="text-xs text-gray-400 ml-auto">{new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                  {c.message && expanded !== c.id && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-1">{c.message}</p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => markRead(c.id, !c.read)}
                    className={`text-xs px-2.5 py-1 rounded border transition-colors ${c.read ? 'border-gray-200 text-gray-400 hover:border-gray-300' : 'border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100'}`}
                  >
                    {c.read ? T.contacts_mark_unread : T.contacts_mark_read}
                  </button>
                  <button onClick={() => del(c.id)} className="p-1.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>

              {expanded === c.id && (
                <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3 text-sm">
                  {c.email && <div><span className="text-gray-400 text-xs uppercase font-medium">{T.contacts_field_email}</span><p className="text-navy">{c.email}</p></div>}
                  {c.boatType && <div><span className="text-gray-400 text-xs uppercase font-medium">{T.contacts_field_boat}</span><p className="text-navy">{c.boatType}</p></div>}
                  {c.marina && <div><span className="text-gray-400 text-xs uppercase font-medium">{T.contacts_field_marina}</span><p className="text-navy">{c.marina}</p></div>}
                  {c.service && <div><span className="text-gray-400 text-xs uppercase font-medium">{T.contacts_field_service}</span><p className="text-navy">{c.service}</p></div>}
                  {c.message && (
                    <div className="col-span-2">
                      <span className="text-gray-400 text-xs uppercase font-medium">{T.contacts_field_message}</span>
                      <p className="text-navy mt-1 whitespace-pre-wrap">{c.message}</p>
                    </div>
                  )}
                  <div className="col-span-2 text-xs text-gray-400">{T.contacts_received}: {new Date(c.createdAt).toLocaleString()}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
