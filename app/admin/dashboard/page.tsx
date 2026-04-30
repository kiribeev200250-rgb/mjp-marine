'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAdminT } from '@/components/admin/AdminProviders';

interface Contact {
  id: number;
  name: string;
  phone: string;
  service: string | null;
  read: boolean;
  createdAt: string;
}

interface Stats {
  services: number;
  testimonials: number;
  subscribers: number;
  contacts: number;
  unread: number;
  recent: Contact[];
}

export default function Dashboard() {
  const { T } = useAdminT();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/services').then((r) => r.json()),
      fetch('/api/admin/testimonials').then((r) => r.json()),
      fetch('/api/admin/subscribers').then((r) => r.json()),
      fetch('/api/admin/contacts').then((r) => r.json()),
    ]).then(([services, testimonials, subscribers, contacts]) => {
      const unread = Array.isArray(contacts) ? contacts.filter((c: Contact) => !c.read).length : 0;
      setStats({
        services: Array.isArray(services) ? services.length : 0,
        testimonials: Array.isArray(testimonials) ? testimonials.length : 0,
        subscribers: Array.isArray(subscribers) ? subscribers.filter((s: { active: boolean }) => s.active).length : 0,
        contacts: Array.isArray(contacts) ? contacts.length : 0,
        unread,
        recent: Array.isArray(contacts) ? contacts.slice(0, 5) : [],
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const cards = stats ? [
    { label: T.dash_services, value: stats.services, href: '/admin/services', color: 'border-blue-200 bg-blue-50', icon: '🔧' },
    { label: T.dash_testimonials, value: stats.testimonials, href: '/admin/testimonials', color: 'border-yellow-200 bg-yellow-50', icon: '💬' },
    { label: T.dash_subscribers, value: stats.subscribers, href: '/admin/subscribers', color: 'border-green-200 bg-green-50', icon: '📧' },
    {
      label: T.dash_contacts,
      value: stats.contacts,
      sub: stats.unread > 0 ? `${stats.unread} ${T.dash_unread}` : undefined,
      href: '/admin/contacts',
      color: stats.unread > 0 ? 'border-amber-300 bg-amber-50' : 'border-purple-200 bg-purple-50',
      icon: '📬',
    },
  ] : [];

  return (
    <div>
      <h1 className="font-heading text-3xl font-bold text-navy mb-8">{T.dash_title}</h1>

      {loading ? (
        <p className="text-gray-400">{T.dash_loading}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {cards.map((s) => (
              <Link key={s.label} href={s.href} className={`card border ${s.color} hover:shadow-md transition-shadow`}>
                <div className="text-3xl mb-2">{s.icon}</div>
                <p className="text-3xl font-bold text-navy">{s.value}</p>
                <p className="text-sm text-gray-500 mt-1">{s.label}</p>
                {s.sub && (
                  <span className="inline-block mt-1.5 text-xs font-semibold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
                    {s.sub}
                  </span>
                )}
              </Link>
            ))}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-xl font-bold text-navy">{T.dash_recent}</h2>
              <Link href="/admin/contacts" className="text-sm text-navy hover:underline">{T.dash_view_all}</Link>
            </div>
            {!stats || stats.recent.length === 0 ? (
              <p className="text-gray-400 text-sm">{T.dash_no_requests}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 text-gray-400 font-medium">{T.dash_col_name}</th>
                      <th className="text-left py-2 text-gray-400 font-medium">{T.dash_col_phone}</th>
                      <th className="text-left py-2 text-gray-400 font-medium">{T.dash_col_service}</th>
                      <th className="text-left py-2 text-gray-400 font-medium">{T.dash_col_date}</th>
                      <th className="text-left py-2 text-gray-400 font-medium">{T.dash_col_status}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recent.map((c) => (
                      <tr key={c.id} className={`border-b border-gray-50 ${!c.read ? 'font-semibold' : ''}`}>
                        <td className="py-2 text-navy">{c.name}</td>
                        <td className="py-2 text-gray-600">{c.phone}</td>
                        <td className="py-2 text-gray-600">{c.service ?? '—'}</td>
                        <td className="py-2 text-gray-400 font-normal">{new Date(c.createdAt).toLocaleDateString()}</td>
                        <td className="py-2">
                          {!c.read && (
                            <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-semibold">
                              {T.dash_badge_new}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
