'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/admin/Toast';
import { useAdminT } from '@/components/admin/AdminProviders';

interface PageText {
  id: number; key: string; en: string; es: string; ru: string; uk: string;
}

type Lang = 'en' | 'es' | 'ru' | 'uk';

const SECTIONS: Record<string, { label: string; emoji: string }> = {
  nav:          { label: 'Navigation / Навигация',         emoji: '🧭' },
  hero:         { label: 'Hero Section / Главный блок',    emoji: '🚢' },
  stats:        { label: 'Stats Strip / Статистика',       emoji: '📊' },
  why:          { label: 'Why Choose Us / Почему мы',      emoji: '✅' },
  services:     { label: 'Services / Услуги',              emoji: '🔧' },
  hiw:          { label: 'How It Works / Как работаем',    emoji: '📋' },
  testimonials: { label: 'Testimonials / Отзывы',          emoji: '💬' },
  subscribe:    { label: 'Newsletter / Рассылка',          emoji: '📧' },
  contact:      { label: 'Contact / Контакты',             emoji: '📬' },
  footer:       { label: 'Footer / Подвал',                emoji: '🦶' },
};

const LANG_LABELS: Record<Lang, string> = { en: 'EN', es: 'ES', ru: 'RU', uk: 'UK' };

export default function TextsAdmin() {
  const [texts, setTexts] = useState<PageText[]>([]);
  const [loading, setLoading] = useState(true);
  const [sectionLang, setSectionLang] = useState<Record<string, Lang>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const { ToastEl, showToast } = useToast();
  const { T } = useAdminT();

  useEffect(() => {
    fetch('/api/admin/texts')
      .then((r) => r.json())
      .then(setTexts)
      .finally(() => setLoading(false));
  }, []);

  function update(key: string, lang: Lang, value: string) {
    setTexts((prev) => prev.map((t) => (t.key === key ? { ...t, [lang]: value } : t)));
  }

  async function saveSection(group: string) {
    setSaving(group);
    const section = texts.filter((t) => t.key.startsWith(group + '.'));
    const res = await fetch('/api/admin/texts', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(section),
    });
    setSaving(null);
    if (res.ok) showToast(T.toast_section_saved);
    else showToast(T.toast_save_error, 'error');
  }

  const groups = texts.reduce<Record<string, PageText[]>>((acc, t) => {
    const group = t.key.split('.')[0];
    if (!acc[group]) acc[group] = [];
    acc[group].push(t);
    return acc;
  }, {});

  const sortedGroups = Object.keys(SECTIONS).filter((k) => groups[k]);
  const otherGroups = Object.keys(groups).filter((k) => !SECTIONS[k]);

  if (loading) return <p className="text-gray-400">{T.texts_loading}</p>;

  return (
    <div>
      {ToastEl}
      <h1 className="font-heading text-3xl font-bold text-navy mb-8">{T.texts_title}</h1>

      <div className="space-y-3">
        {[...sortedGroups, ...otherGroups].map((group) => {
          const meta = SECTIONS[group] ?? { label: group, emoji: '📄' };
          const isOpen = open[group] ?? false;
          const lang = sectionLang[group] ?? 'en';
          const groupTexts = groups[group] ?? [];

          return (
            <div key={group} className="card p-0 overflow-hidden">
              <button
                onClick={() => setOpen((o) => ({ ...o, [group]: !isOpen }))}
                className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="text-lg">{meta.emoji}</span>
                <span className="font-semibold text-navy flex-1">{meta.label}</span>
                <span className="text-xs text-gray-400">{groupTexts.length} {T.texts_fields}</span>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isOpen && (
                <div className="px-6 pb-6 border-t border-gray-100">
                  <div className="flex gap-1 mt-4 mb-5 bg-gray-100 rounded-lg p-1 w-fit">
                    {(['en', 'es', 'ru', 'uk'] as Lang[]).map((l) => (
                      <button
                        key={l}
                        onClick={() => setSectionLang((s) => ({ ...s, [group]: l }))}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                          lang === l ? 'bg-white shadow text-navy' : 'text-gray-500 hover:text-navy'
                        }`}
                      >
                        {LANG_LABELS[l]}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-4">
                    {groupTexts.map((t) => (
                      <div key={t.key}>
                        <label className="block text-xs font-mono text-gray-400 mb-1">
                          {t.key.replace(group + '.', '')}
                        </label>
                        <textarea
                          value={t[lang]}
                          onChange={(e) => update(t.key, lang, e.target.value)}
                          rows={t[lang].length > 80 ? 3 : 2}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-navy resize-y"
                        />
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => saveSection(group)}
                    disabled={saving === group}
                    className="mt-5 btn-primary py-2 px-6 text-sm disabled:opacity-60"
                  >
                    {saving === group ? T.texts_saving : T.texts_save_section}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
