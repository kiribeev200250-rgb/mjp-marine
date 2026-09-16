'use client';

// Согласие на cookie/пиксели (Meta, TikTok, Google) — хранится отдельно от
// mjp_lang (см. lib/i18n.ts), тот же паттерн localStorage + custom event,
// чтобы компоненты могли реагировать без перезагрузки страницы.

export interface ConsentPrefs {
  analytics: boolean; // Google Analytics
  marketing: boolean; // Meta Pixel + TikTok Pixel
}

interface StoredConsent extends ConsentPrefs {
  version: number;
  decidedAt: string;
}

const STORAGE_KEY = 'mjp_cookie_consent';
// Увеличить при существенном изменении политики/набора пикселей — старое
// согласие перестанет учитываться, баннер покажется заново.
const CONSENT_VERSION = 1;

export const CONSENT_CHANGED_EVENT = 'mjp-consent-changed';
export const OPEN_CONSENT_SETTINGS_EVENT = 'mjp-open-consent-settings';

export function getConsent(): StoredConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConsent;
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveConsent(prefs: ConsentPrefs) {
  if (typeof window === 'undefined') return;
  const stored: StoredConsent = { ...prefs, version: CONSENT_VERSION, decidedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT));
}

// Вызывается ссылкой «Настройки cookie» в футере — открывает баннер заново
// поверх уже принятого решения, чтобы его можно было изменить.
export function openConsentSettings() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_CONSENT_SETTINGS_EVENT));
}
