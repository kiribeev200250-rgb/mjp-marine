'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { useToast } from '@/components/admin/Toast';
import { useAdminT } from '@/components/admin/AdminProviders';

interface CustomLink { label: string; url: string }

interface Config {
  companyName: string; phone: string; whatsapp: string; email: string;
  hours: string; coverage: string; instagram: string; facebook: string;
  whatsappUrl: string; tiktok: string; youtube: string; logoUrl: string;
  heroBgUrl: string; heroOverlayOpacity: number; faviconUrl: string;
  colorPrimary: string; colorAccent: string; colorText: string;
  showHeroStats: boolean; heroAnimation: string;
  servicesBgColor: string; servicesCardStyle: string; showPriceLabel: boolean;
  footerBgColor: string; footerShowBrand: boolean; footerShowNav: boolean;
  footerShowSocial: boolean; footerCustomLinks: string;
  metaTitle: string; metaDesc: string;
  showGallery: boolean; showAnimations: boolean; showWave: boolean;
}

const defaultConfig: Config = {
  companyName: '', phone: '', whatsapp: '', email: '', hours: '', coverage: '',
  instagram: '', facebook: '', whatsappUrl: '', tiktok: '', youtube: '',
  logoUrl: '', heroBgUrl: '', heroOverlayOpacity: 0.75, faviconUrl: '',
  colorPrimary: '#0A2342', colorAccent: '#C9A84C', colorText: '#FFFFFF',
  showHeroStats: true, heroAnimation: 'none',
  servicesBgColor: '', servicesCardStyle: 'bordered', showPriceLabel: true,
  footerBgColor: '', footerShowBrand: true, footerShowNav: true, footerShowSocial: true,
  footerCustomLinks: '[]', metaTitle: '', metaDesc: '',
  showGallery: false, showAnimations: true, showWave: true,
};

export default function ConfigPage() {
  const [config, setConfig] = useState<Config>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [heroBgPreview, setHeroBgPreview] = useState<string | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const logoFileRef = useRef<HTMLInputElement>(null) as React.MutableRefObject<HTMLInputElement>;
  const heroBgFileRef = useRef<HTMLInputElement>(null) as React.MutableRefObject<HTMLInputElement>;
  const faviconFileRef = useRef<HTMLInputElement>(null) as React.MutableRefObject<HTMLInputElement>;
  const { ToastEl, showToast } = useToast();
  const { T } = useAdminT();

  useEffect(() => {
    fetch('/api/admin/config')
      .then((r) => r.json())
      .then((data) => {
        setConfig({
          companyName: data.companyName ?? '', phone: data.phone ?? '', whatsapp: data.whatsapp ?? '',
          email: data.email ?? '', hours: data.hours ?? '', coverage: data.coverage ?? '',
          instagram: data.instagram ?? '', facebook: data.facebook ?? '', whatsappUrl: data.whatsappUrl ?? '',
          tiktok: data.tiktok ?? '', youtube: data.youtube ?? '', logoUrl: data.logoUrl ?? '',
          heroBgUrl: data.heroBgUrl ?? '', heroOverlayOpacity: data.heroOverlayOpacity ?? 0.75,
          faviconUrl: data.faviconUrl ?? '',
          colorPrimary: data.colorPrimary ?? '#0A2342', colorAccent: data.colorAccent ?? '#C9A84C',
          colorText: data.colorText ?? '#FFFFFF',
          showHeroStats: data.showHeroStats !== false, heroAnimation: data.heroAnimation ?? 'none',
          servicesBgColor: data.servicesBgColor ?? '', servicesCardStyle: data.servicesCardStyle ?? 'bordered',
          showPriceLabel: data.showPriceLabel !== false,
          footerBgColor: data.footerBgColor ?? '', footerShowBrand: data.footerShowBrand !== false,
          footerShowNav: data.footerShowNav !== false, footerShowSocial: data.footerShowSocial !== false,
          footerCustomLinks: data.footerCustomLinks ?? '[]',
          metaTitle: data.metaTitle ?? '', metaDesc: data.metaDesc ?? '',
          showGallery: data.showGallery !== undefined ? data.showGallery : false,
          showAnimations: data.showAnimations !== false,
          showWave: data.showWave !== false,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'logoUrl' | 'heroBgUrl' | 'faviconUrl',
    setPreview: (url: string) => void,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setUploadingField(field);
    setUploadError(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) {
        setUploadError(json.error ?? 'Upload failed');
        showToast(T.toast_upload_error, 'error');
        return;
      }
      const { url } = json;
      setConfig((c) => ({ ...c, [field]: url }));
      // Auto-save to DB immediately
      await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: url }),
      });
      showToast(T.toast_logo_uploaded);
    } catch {
      setUploadError('Upload failed');
      showToast(T.toast_upload_error, 'error');
    } finally {
      setUploadingField(null);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/admin/config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config),
    });
    setSaving(false);
    if (res.ok) showToast(T.toast_saved);
    else showToast(T.toast_save_error, 'error');
  }

  // Custom links helpers
  let customLinks: CustomLink[] = [];
  try { customLinks = JSON.parse(config.footerCustomLinks || '[]'); } catch { customLinks = []; }

  function setCustomLinks(links: CustomLink[]) {
    setConfig((c) => ({ ...c, footerCustomLinks: JSON.stringify(links) }));
  }

  const ic = 'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-navy';

  const Field = ({ label, field, type = 'text', placeholder = '' }: { label: string; field: keyof Config; type?: string; placeholder?: string }) => (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      <input
        type={type}
        value={String(config[field])}
        onChange={(e) => setConfig({ ...config, [field]: e.target.value })}
        className={ic}
        placeholder={placeholder}
      />
    </div>
  );

  const Toggle = ({ label, field }: { label: string; field: keyof Config }) => (
    <label className="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={Boolean(config[field])}
        onChange={(e) => setConfig({ ...config, [field]: e.target.checked })}
        className="w-4 h-4 rounded accent-navy"
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );

  const ColorField = ({ label, field }: { label: string; field: keyof Config }) => (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      <div className="flex gap-2 items-center">
        <input
          type="color"
          value={String(config[field])}
          onChange={(e) => setConfig({ ...config, [field]: e.target.value })}
          className="w-12 h-10 rounded border border-gray-200 cursor-pointer p-0.5"
        />
        <input
          type="text"
          value={String(config[field])}
          onChange={(e) => setConfig({ ...config, [field]: e.target.value })}
          className={`flex-1 ${ic}`}
          placeholder="#000000"
        />
      </div>
    </div>
  );

  const UploadField = ({
    label, urlField, preview, setPreview, fileRef, accept, uploadKey,
  }: {
    label: string;
    urlField: 'logoUrl' | 'heroBgUrl' | 'faviconUrl';
    preview: string | null;
    setPreview: (url: string) => void;
    fileRef: React.RefObject<HTMLInputElement>;
    accept: string;
    uploadKey: string;
  }) => {
    const currentUrl = config[urlField];
    const displayUrl = preview || currentUrl;
    const isImg = displayUrl && !displayUrl.endsWith('.ico');
    return (
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
        {isImg && (
          <div className="w-32 h-20 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
            <Image src={displayUrl} alt="" width={128} height={80} className="w-full h-full object-contain" unoptimized />
          </div>
        )}
        {displayUrl && displayUrl.endsWith('.ico') && (
          <p className="text-xs text-gray-500">{displayUrl}</p>
        )}
        <div className="flex gap-2 items-center flex-wrap">
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => handleUpload(e, urlField, setPreview)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploadingField === uploadKey}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:border-navy transition-colors disabled:opacity-60"
          >
            {uploadingField === uploadKey ? T.config_uploading : T.config_upload_btn}
          </button>
          <span className="text-xs text-gray-400">or paste URL:</span>
        </div>
        <input
          type="text"
          value={currentUrl}
          onChange={(e) => { setConfig({ ...config, [urlField]: e.target.value }); setPreview(e.target.value); }}
          className={ic}
          placeholder="https://..."
        />
        {uploadError && uploadingField === null && (
          <p className="text-xs text-red-500">{uploadError}</p>
        )}
      </div>
    );
  };

  if (loading) return <div className="text-gray-400">{T.dash_loading}</div>;

  return (
    <div>
      {ToastEl}
      <h1 className="font-heading text-3xl font-bold text-navy mb-8">{T.config_title}</h1>
      <form onSubmit={handleSave} className="max-w-2xl space-y-6">

        {/* Logo */}
        <div className="card space-y-4">
          <h2 className="font-heading text-lg font-bold text-navy">{T.config_logo_section}</h2>
          <UploadField
            label={T.config_logo_section}
            urlField="logoUrl"
            preview={logoPreview}
            setPreview={setLogoPreview}
            fileRef={logoFileRef}
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            uploadKey="logoUrl"
          />
        </div>

        {/* Hero Background */}
        <div className="card space-y-4">
          <h2 className="font-heading text-lg font-bold text-navy">{T.config_hero_section}</h2>
          <UploadField
            label={T.config_hero_bg_btn}
            urlField="heroBgUrl"
            preview={heroBgPreview}
            setPreview={setHeroBgPreview}
            fileRef={heroBgFileRef}
            accept="image/jpeg,image/png,image/webp"
            uploadKey="heroBgUrl"
          />
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              {T.config_hero_overlay} ({config.heroOverlayOpacity})
            </label>
            <input
              type="range"
              min="0.4"
              max="0.9"
              step="0.05"
              value={config.heroOverlayOpacity}
              onChange={(e) => setConfig({ ...config, heroOverlayOpacity: Number(e.target.value) })}
              className="w-full accent-navy"
            />
          </div>
          <Toggle label={T.config_hero_stats} field="showHeroStats" />
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{T.config_hero_animation}</label>
            <select
              value={config.heroAnimation}
              onChange={(e) => setConfig({ ...config, heroAnimation: e.target.value })}
              className={ic}
            >
              <option value="none">None</option>
              <option value="fade">Fade in</option>
              <option value="slide">Slide up</option>
            </select>
          </div>
        </div>

        {/* Favicon */}
        <div className="card space-y-4">
          <h2 className="font-heading text-lg font-bold text-navy">{T.config_favicon_section}</h2>
          <UploadField
            label={T.config_favicon_btn}
            urlField="faviconUrl"
            preview={faviconPreview}
            setPreview={setFaviconPreview}
            fileRef={faviconFileRef}
            accept=".ico,image/png,image/svg+xml"
            uploadKey="faviconUrl"
          />
        </div>

        {/* Brand Colors */}
        <div className="card space-y-4">
          <h2 className="font-heading text-lg font-bold text-navy">{T.config_colors_section}</h2>
          <ColorField label={T.config_color_primary} field="colorPrimary" />
          <ColorField label={T.config_color_accent} field="colorAccent" />
          <ColorField label={T.config_color_text} field="colorText" />
        </div>

        {/* Company Info */}
        <div className="card space-y-4">
          <h2 className="font-heading text-lg font-bold text-navy">{T.config_company_section}</h2>
          <Field label={T.config_company_name} field="companyName" placeholder="MJP Marine Service" />
          <Field label={T.config_phone} field="phone" placeholder="+34 600 000 000" />
          <Field label={T.config_whatsapp} field="whatsapp" placeholder="34600000000" />
          <Field label={T.config_email} field="email" type="email" placeholder="info@mjpmarine.es" />
          <Field label={T.config_hours} field="hours" placeholder="Mon–Sat 8:00–19:00" />
          <Field label={T.config_coverage} field="coverage" placeholder="Alicante · Dénia · Torrevieja" />
        </div>

        {/* Social Links */}
        <div className="card space-y-4">
          <h2 className="font-heading text-lg font-bold text-navy">{T.config_social_section}</h2>
          <p className="text-xs text-gray-400">{T.config_social_note}</p>
          <Field label={T.config_instagram} field="instagram" />
          <Field label={T.config_facebook} field="facebook" />
          <Field label={T.config_whatsapp_url} field="whatsappUrl" />
          <Field label={T.config_tiktok} field="tiktok" />
          <Field label={T.config_youtube} field="youtube" />
        </div>

        {/* Services Section */}
        <div className="card space-y-4">
          <h2 className="font-heading text-lg font-bold text-navy">{T.config_services_section}</h2>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{T.config_services_bg}</label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={config.servicesBgColor || '#f5f0e8'}
                onChange={(e) => setConfig({ ...config, servicesBgColor: e.target.value })}
                className="w-12 h-10 rounded border border-gray-200 cursor-pointer p-0.5"
              />
              <input
                type="text"
                value={config.servicesBgColor}
                onChange={(e) => setConfig({ ...config, servicesBgColor: e.target.value })}
                className={`flex-1 ${ic}`}
                placeholder="Leave empty for default"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{T.config_services_card_style}</label>
            <select
              value={config.servicesCardStyle}
              onChange={(e) => setConfig({ ...config, servicesCardStyle: e.target.value })}
              className={ic}
            >
              <option value="bordered">Bordered</option>
              <option value="filled">Filled (navy)</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>
          <Toggle label={T.config_services_show_price} field="showPriceLabel" />
        </div>

        {/* Footer Settings */}
        <div className="card space-y-4">
          <h2 className="font-heading text-lg font-bold text-navy">{T.config_footer_section}</h2>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{T.config_footer_bg}</label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={config.footerBgColor || '#0b1f35'}
                onChange={(e) => setConfig({ ...config, footerBgColor: e.target.value })}
                className="w-12 h-10 rounded border border-gray-200 cursor-pointer p-0.5"
              />
              <input
                type="text"
                value={config.footerBgColor}
                onChange={(e) => setConfig({ ...config, footerBgColor: e.target.value })}
                className={`flex-1 ${ic}`}
                placeholder="Leave empty for default"
              />
            </div>
          </div>
          <Toggle label={T.config_footer_show_brand} field="footerShowBrand" />
          <Toggle label={T.config_footer_show_nav} field="footerShowNav" />
          <Toggle label={T.config_footer_show_social} field="footerShowSocial" />

          {/* Custom links */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{T.config_footer_custom_links}</label>
            <div className="space-y-2">
              {customLinks.map((cl, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={cl.label}
                    onChange={(e) => {
                      const next = [...customLinks];
                      next[i] = { ...next[i], label: e.target.value };
                      setCustomLinks(next);
                    }}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-navy"
                    placeholder={T.config_footer_link_label}
                  />
                  <input
                    type="text"
                    value={cl.url}
                    onChange={(e) => {
                      const next = [...customLinks];
                      next[i] = { ...next[i], url: e.target.value };
                      setCustomLinks(next);
                    }}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-navy"
                    placeholder={T.config_footer_link_url}
                  />
                  <button
                    type="button"
                    onClick={() => setCustomLinks(customLinks.filter((_, j) => j !== i))}
                    className="p-2 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
              {customLinks.length < 5 && (
                <button
                  type="button"
                  onClick={() => setCustomLinks([...customLinks, { label: '', url: '' }])}
                  className="text-sm text-navy border border-dashed border-gray-300 rounded-lg px-4 py-2 hover:border-navy transition-colors w-full"
                >
                  {T.config_footer_add_link}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* SEO */}
        <div className="card space-y-4">
          <h2 className="font-heading text-lg font-bold text-navy">{T.config_seo_section}</h2>
          <Field label={T.config_meta_title} field="metaTitle" />
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">{T.config_meta_desc}</label>
              <span className={`text-xs ${config.metaDesc.length > 160 ? 'text-red-500' : 'text-gray-400'}`}>
                {config.metaDesc.length}/160
              </span>
            </div>
            <textarea
              value={config.metaDesc}
              onChange={(e) => setConfig({ ...config, metaDesc: e.target.value })}
              rows={3}
              maxLength={200}
              className={ic}
            />
          </div>
        </div>

        {/* Visual Settings */}
        <div className="card space-y-4">
          <h2 className="font-heading text-lg font-bold text-navy">Visual Settings</h2>
          <p className="text-xs text-gray-400">Changes save instantly on toggle.</p>
          {([
            { label: 'Show before/after gallery section', field: 'showGallery' as const },
            { label: 'Enable scroll animations', field: 'showAnimations' as const },
            { label: 'Show animated wave on hero', field: 'showWave' as const },
          ] as const).map(({ label, field }) => (
            <label key={field} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(config[field])}
                onChange={async (e) => {
                  const val = e.target.checked;
                  setConfig(c => ({ ...c, [field]: val }));
                  await fetch('/api/admin/config', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ [field]: val }),
                  });
                  showToast(T.toast_saved);
                }}
                className="w-4 h-4 rounded accent-navy"
              />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </div>

        <button type="submit" disabled={saving} className="btn-primary px-8 py-3 disabled:opacity-60">
          {saving ? T.config_saving : T.config_save}
        </button>
      </form>
    </div>
  );
}
