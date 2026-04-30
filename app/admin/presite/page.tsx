'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminT } from '@/components/admin/AdminProviders';
import { useToast } from '@/components/admin/Toast';

type PresiteLink = {
  id: number;
  platform: string;
  label: string;
  url: string;
  active: boolean;
  sortOrder: number;
};

type PresiteConfig = {
  id: number;
  taglineEn: string;
  taglineEs: string;
  taglineRu: string;
  taglineUk: string;
  pageTitle: string;
  showWave: boolean;
  bgStyle: string;
  footerText: string;
};

type StatItem = {
  id: number;
  label: string;
  platform: string;
  total: number;
  last7: number;
  last30: number;
};

const PLATFORMS = ['website', 'instagram', 'whatsapp', 'telegram', 'tiktok', 'youtube', 'facebook', 'other'];

export default function PresiteAdminPage() {
  const { T } = useAdminT();
  const [tab, setTab] = useState<'links' | 'content' | 'stats'>('links');

  const tabs = [
    { key: 'links' as const, label: T.presite_tab_links },
    { key: 'content' as const, label: T.presite_tab_content },
    { key: 'stats' as const, label: T.presite_tab_stats },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-heading font-bold text-white">{T.presite_title}</h1>
        <a
          href="/go"
          target="_blank"
          rel="noreferrer"
          className="text-sm text-[#C9A84C] hover:underline"
        >
          {T.presite_view} →
        </a>
      </div>

      <div className="flex gap-1 mb-6 bg-white/5 rounded-xl p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-[#C9A84C] text-[#0A2342]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'links' && <LinksTab T={T} />}
      {tab === 'content' && <ContentTab T={T} />}
      {tab === 'stats' && <StatsTab T={T} />}
    </div>
  );
}

/* ─── Links Tab ─── */
function LinksTab({ T }: { T: Record<string, string> }) {
  const { ToastEl, showToast } = useToast();
  const [links, setLinks] = useState<PresiteLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PresiteLink | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const fresh: Omit<PresiteLink, 'id'> = {
    platform: 'website',
    label: '',
    url: '',
    active: true,
    sortOrder: 0,
  };
  const [form, setForm] = useState<Omit<PresiteLink, 'id'>>(fresh);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/presite/links');
    const data = await res.json();
    setLinks(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...fresh, sortOrder: links.length });
    setShowModal(true);
  };

  const openEdit = (link: PresiteLink) => {
    setEditing(link);
    setForm({ platform: link.platform, label: link.label, url: link.url, active: link.active, sortOrder: link.sortOrder });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await fetch(`/api/admin/presite/links/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        showToast(T.toast_updated, 'success');
      } else {
        await fetch('/api/admin/presite/links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        showToast(T.toast_added, 'success');
      }
      setShowModal(false);
      load();
    } catch {
      showToast(T.toast_save_error, 'error');
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm(T.presite_confirm_delete)) return;
    await fetch(`/api/admin/presite/links/${id}`, { method: 'DELETE' });
    showToast(T.toast_deleted, 'success');
    load();
  };

  const handleToggleActive = async (link: PresiteLink) => {
    await fetch(`/api/admin/presite/links/${link.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !link.active }),
    });
    load();
  };

  const handleMove = async (index: number, dir: -1 | 1) => {
    const other = links[index + dir];
    const current = links[index];
    if (!other) return;
    await Promise.all([
      fetch(`/api/admin/presite/links/${current.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: other.sortOrder }),
      }),
      fetch(`/api/admin/presite/links/${other.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: current.sortOrder }),
      }),
    ]);
    load();
  };

  return (
    <>
      {ToastEl}
      <div className="flex justify-between items-center mb-4">
        <span className="text-gray-400 text-sm">{links.length} {T.presite_links_count}</span>
        <button
          onClick={openAdd}
          className="bg-[#C9A84C] hover:bg-[#b8933d] text-[#0A2342] font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
        >
          {T.presite_add_link}
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">{T.presite_loading}</p>
      ) : links.length === 0 ? (
        <p className="text-gray-400 text-sm">{T.presite_none}</p>
      ) : (
        <div className="space-y-2">
          {links.map((link, i) => (
            <div
              key={link.id}
              className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/10"
            >
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => handleMove(i, -1)}
                  disabled={i === 0}
                  className="text-gray-500 hover:text-white disabled:opacity-20 text-xs leading-none"
                >
                  ▲
                </button>
                <button
                  onClick={() => handleMove(i, 1)}
                  disabled={i === links.length - 1}
                  className="text-gray-500 hover:text-white disabled:opacity-20 text-xs leading-none"
                >
                  ▼
                </button>
              </div>

              <span className="text-lg">{getPlatformEmoji(link.platform)}</span>

              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{link.label}</p>
                <p className="text-gray-500 text-xs truncate">{link.url || '—'}</p>
              </div>

              <button
                onClick={() => handleToggleActive(link)}
                className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${
                  link.active
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-white/10 text-gray-500'
                }`}
              >
                {link.active ? T.presite_active : T.presite_inactive}
              </button>

              <button
                onClick={() => openEdit(link)}
                className="text-gray-400 hover:text-white transition-colors p-1"
              >
                <PencilIcon />
              </button>
              <button
                onClick={() => handleDelete(link.id)}
                className="text-gray-400 hover:text-red-400 transition-colors p-1"
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0d2a45] rounded-2xl p-6 w-full max-w-md border border-white/10">
            <h2 className="text-white font-bold text-lg mb-4">
              {editing ? T.presite_edit_link : T.presite_add_link}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
                  {T.presite_platform}
                </label>
                <select
                  value={form.platform}
                  onChange={(e) => setForm({ ...form, platform: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C9A84C]"
                >
                  {PLATFORMS.map((p) => (
                    <option key={p} value={p} className="bg-[#0A2342]">
                      {getPlatformEmoji(p)} {p.charAt(0).toUpperCase() + p.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
                  {T.presite_label}
                </label>
                <input
                  type="text"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C9A84C]"
                />
              </div>

              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
                  {T.presite_url}
                </label>
                <input
                  type="url"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C9A84C]"
                  placeholder="https://"
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="w-4 h-4 accent-[#C9A84C]"
                />
                <span className="text-white text-sm">{T.presite_active_check}</span>
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2 rounded-lg border border-white/10 text-gray-300 text-sm hover:bg-white/5 transition-colors"
              >
                {T.presite_cancel}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2 rounded-lg bg-[#C9A84C] text-[#0A2342] font-semibold text-sm hover:bg-[#b8933d] disabled:opacity-50 transition-colors"
              >
                {saving ? T.presite_saving : T.presite_save}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Content Tab ─── */
function ContentTab({ T }: { T: Record<string, string> }) {
  const { ToastEl, showToast } = useToast();
  const [config, setConfig] = useState<PresiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [taglineLang, setTaglineLang] = useState<'En' | 'Es' | 'Ru' | 'Uk'>('En');

  useEffect(() => {
    fetch('/api/admin/presite/config')
      .then((r) => r.json())
      .then((d) => {
        setConfig(
          d ?? {
            id: 1,
            taglineEn: 'Mobile Yacht Repair · Costa Blanca',
            taglineEs: 'Reparación Náutica Móvil · Costa Blanca',
            taglineRu: 'Мобильный яхтенный сервис · Коста Бланка',
            taglineUk: 'Мобільний яхтовий сервіс · Коста Бланка',
            pageTitle: 'MJP Marine Service',
            showWave: true,
            bgStyle: 'gradient',
            footerText: '© 2026 MJP Marine Service · Costa Blanca, España',
          }
        );
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await fetch('/api/admin/presite/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      showToast(T.toast_saved, 'success');
    } catch {
      showToast(T.toast_save_error, 'error');
    }
    setSaving(false);
  };

  if (loading || !config) {
    return <p className="text-gray-400 text-sm">{T.presite_loading}</p>;
  }

  const taglineKey = `tagline${taglineLang}` as keyof PresiteConfig;
  const langTabs = ['En', 'Es', 'Ru', 'Uk'] as const;

  return (
    <>
      {ToastEl}
      <div className="space-y-6">
        <div>
          <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
            {T.presite_page_title}
          </label>
          <input
            type="text"
            value={config.pageTitle}
            onChange={(e) => setConfig({ ...config, pageTitle: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C9A84C]"
          />
        </div>

        <div>
          <label className="text-gray-400 text-xs uppercase tracking-wide block mb-2">
            {T.presite_tagline}
          </label>
          <div className="flex gap-1 mb-2">
            {langTabs.map((l) => (
              <button
                key={l}
                onClick={() => setTaglineLang(l)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  taglineLang === l
                    ? 'bg-[#C9A84C] text-[#0A2342]'
                    : 'bg-white/5 text-gray-400 hover:text-white'
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={config[taglineKey] as string}
            onChange={(e) => setConfig({ ...config, [taglineKey]: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C9A84C]"
          />
        </div>

        <div>
          <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
            {T.presite_bg_style}
          </label>
          <select
            value={config.bgStyle}
            onChange={(e) => setConfig({ ...config, bgStyle: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C9A84C]"
          >
            <option value="gradient" className="bg-[#0A2342]">Gradient</option>
            <option value="solid" className="bg-[#0A2342]">Solid Navy</option>
            <option value="dark" className="bg-[#0A2342]">Dark</option>
          </select>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={config.showWave}
            onChange={(e) => setConfig({ ...config, showWave: e.target.checked })}
            className="w-4 h-4 accent-[#C9A84C]"
          />
          <span className="text-white text-sm">{T.presite_show_wave}</span>
        </label>

        <div>
          <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
            {T.presite_footer_text}
          </label>
          <input
            type="text"
            value={config.footerText}
            onChange={(e) => setConfig({ ...config, footerText: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C9A84C]"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#C9A84C] hover:bg-[#b8933d] text-[#0A2342] font-semibold px-6 py-2.5 rounded-lg text-sm disabled:opacity-50 transition-colors"
        >
          {saving ? T.presite_saving : T.presite_save}
        </button>
      </div>
    </>
  );
}

/* ─── Stats Tab ─── */
function StatsTab({ T }: { T: Record<string, string> }) {
  const [stats, setStats] = useState<{ links: StatItem[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'last7' | 'last30' | 'total'>('last7');

  useEffect(() => {
    fetch('/api/admin/presite/stats')
      .then((r) => r.json())
      .then((d) => { setStats(d); setLoading(false); });
  }, []);

  if (loading) return <p className="text-gray-400 text-sm">{T.presite_loading}</p>;
  if (!stats) return null;

  const max = Math.max(...stats.links.map((l) => l[range]), 1);
  const rangeLabels: Record<typeof range, string> = {
    last7: T.presite_last_7,
    last30: T.presite_last_30,
    total: T.presite_all_time,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-wide">{T.presite_total_clicks}</p>
          <p className="text-[#C9A84C] text-3xl font-bold">{stats.total}</p>
        </div>
        <div className="flex gap-1">
          {(['last7', 'last30', 'total'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                range === r
                  ? 'bg-[#C9A84C] text-[#0A2342]'
                  : 'bg-white/5 text-gray-400 hover:text-white'
              }`}
            >
              {rangeLabels[r]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {stats.links.length === 0 && (
          <p className="text-gray-400 text-sm">{T.presite_none}</p>
        )}
        {stats.links.map((link) => {
          const count = link[range];
          const pct = max > 0 ? (count / max) * 100 : 0;
          return (
            <div key={link.id}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-white text-sm">
                  {getPlatformEmoji(link.platform)} {link.label}
                </span>
                <span className="text-[#C9A84C] font-bold text-sm">{count}</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#C9A84C] rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── helpers ─── */
function getPlatformEmoji(platform: string): string {
  const map: Record<string, string> = {
    website: '🌐',
    instagram: '📸',
    whatsapp: '💬',
    telegram: '✈️',
    tiktok: '🎵',
    youtube: '▶️',
    facebook: '👥',
    other: '🔗',
  };
  return map[platform] ?? '🔗';
}

function PencilIcon() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}
