'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { useToast } from '@/components/admin/Toast';
import { useAdminT } from '@/components/admin/AdminProviders';

interface Config {
  companyName: string; phone: string; whatsapp: string; email: string;
  hours: string; coverage: string; instagram: string; facebook: string;
  whatsappUrl: string; tiktok: string; youtube: string; logoUrl: string;
  metaTitle: string; metaDesc: string;
}

const defaultConfig: Config = {
  companyName: '', phone: '', whatsapp: '', email: '', hours: '', coverage: '',
  instagram: '', facebook: '', whatsappUrl: '', tiktok: '', youtube: '',
  logoUrl: '', metaTitle: '', metaDesc: '',
};

export default function ConfigPage() {
  const [config, setConfig] = useState<Config>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
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
          metaTitle: data.metaTitle ?? '', metaDesc: data.metaDesc ?? '',
        });
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if (res.ok) {
      const { url } = await res.json();
      setConfig((c) => ({ ...c, logoUrl: url }));
      showToast(T.toast_logo_uploaded);
    } else {
      showToast(T.toast_upload_error, 'error');
    }
    setUploading(false);
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

  const ic = 'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-navy';

  const Field = ({ label, field, type = 'text', placeholder = '' }: { label: string; field: keyof Config; type?: string; placeholder?: string }) => (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      <input
        type={type}
        value={config[field]}
        onChange={(e) => setConfig({ ...config, [field]: e.target.value })}
        className={ic}
        placeholder={placeholder}
      />
    </div>
  );

  if (loading) return <div className="text-gray-400">{T.dash_loading}</div>;

  return (
    <div>
      {ToastEl}
      <h1 className="font-heading text-3xl font-bold text-navy mb-8">{T.config_title}</h1>
      <form onSubmit={handleSave} className="max-w-2xl space-y-6">

        {/* Logo */}
        <div className="card space-y-4">
          <h2 className="font-heading text-lg font-bold text-navy">{T.config_logo_section}</h2>
          <div className="flex items-start gap-4">
            <div className="w-24 h-16 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 overflow-hidden shrink-0">
              {(preview || config.logoUrl) ? (
                <Image src={preview ?? config.logoUrl} alt="Logo" width={96} height={64} className="w-full h-full object-contain" />
              ) : (
                <span className="text-gray-300 text-2xl">⚓</span>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:border-navy transition-colors disabled:opacity-60"
              >
                {uploading ? T.config_uploading : T.config_upload_btn}
              </button>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{T.config_logo_url}</label>
                <input
                  value={config.logoUrl}
                  onChange={(e) => { setConfig({ ...config, logoUrl: e.target.value }); setPreview(null); }}
                  className={ic}
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>
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

        <button type="submit" disabled={saving} className="btn-primary px-8 py-3 disabled:opacity-60">
          {saving ? T.config_saving : T.config_save}
        </button>
      </form>
    </div>
  );
}
