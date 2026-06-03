'use client';

import { useEffect, useRef, useState } from 'react';
import { detectLang, type Lang } from '@/lib/i18n';


const MARINAS = [
  { name: 'Puerto Dénia',                          lat: 38.8418, lng:  0.1089 },
  { name: 'Puerto Jávea',                          lat: 38.7934, lng:  0.1734 },
  { name: 'Puerto Calpe',                          lat: 38.6388, lng:  0.0461 },
  { name: 'Puerto Altea',                          lat: 38.5994, lng: -0.0492 },
  { name: 'Puerto Benidorm',                       lat: 38.5341, lng: -0.1186 },
  { name: 'Puerto Villajoyosa',                    lat: 38.5089, lng: -0.2298 },
  { name: 'Marina Alicante',                       lat: 38.3327, lng: -0.4812 },
  { name: 'Puerto Santa Pola',                     lat: 38.1894, lng: -0.5578 },
  { name: 'Marina Salinas Torrevieja',             lat: 37.9712, lng: -0.6891 },
  { name: 'Puerto Guardamar',                      lat: 38.0891, lng: -0.6534 },
  { name: 'Marina Internacional Campoamor',        lat: 37.8912, lng: -0.7234 },
  { name: 'Puerto San Pedro del Pinatar',          lat: 37.8234, lng: -0.7891 },
  { name: 'Marina de las Salinas',                 lat: 37.7012, lng: -0.8234 },
  { name: 'Puerto Mazarrón',                       lat: 37.5734, lng: -1.2612 },
  { name: 'Marina Carthagena',                     lat: 37.5891, lng: -0.9812 },
  { name: 'Puerto Cartagena',                      lat: 37.5981, lng: -0.9823 },
  { name: 'Mar Menor Marina Lo Pagán',             lat: 37.8456, lng: -0.7923 },
  { name: 'Puerto Tomás Maestre (Mar Menor)',      lat: 37.6934, lng: -0.7123 },
];

const sectionTitles: Record<Lang, string> = {
  en: 'Our Coverage', es: 'Nuestra Cobertura', ru: 'Наша зона покрытия', uk: 'Наша зона покриття',
};

const statsText: Record<Lang, string> = {
  en: '244km of coastline · 18 marinas · 1 team',
  es: '244km de costa · 18 marinas · 1 equipo',
  ru: '244 км побережья · 18 марин · 1 команда',
  uk: '244 км узбережжя · 18 марин · 1 команда',
};

const popupText: Record<Lang, string> = {
  en: 'We service this marina',
  es: 'Atendemos esta marina',
  ru: 'Обслуживаем эту марину',
  uk: 'Обслуговуємо цю марину',
};

export default function CoverageMap() {
  const [lang, setLang] = useState<Lang>('en');
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const [titleVisible, setTitleVisible] = useState(false);

  useEffect(() => {
    setLang(detectLang());
    const obs = new MutationObserver(() => {
      const stored = localStorage.getItem('mjp_lang') as Lang | null;
      if (stored) setLang(stored);
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setTitleVisible(true); io.disconnect(); } },
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    let mounted = true;

    const initLeaflet = async () => {
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      const L = (await import('leaflet')).default;
      if (!mounted || !mapContainerRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapContainerRef.current, {
        center: [38.2, -0.5],
        zoom: 8,
        minZoom: 7,
        maxZoom: 13,
        zoomControl: false,
        scrollWheelZoom: true,
        attributionControl: false,
      });

      mapRef.current = map;

      L.tileLayer(
        'https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
        { subdomains: 'abcd', maxZoom: 19 }
      ).addTo(map);

      const makeIcon = () => L.divIcon({
        html: `<div style="width:32px;height:32px;background:#0A2342;border-radius:50%;border:2px solid #C9A84C;display:flex;align-items:center;justify-content:center;font-size:14px;line-height:1;transition:transform 0.2s ease;cursor:pointer;">⚓</div>`,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -20],
      });

      MARINAS.forEach(({ name, lat, lng }) => {
        const marker = L.marker([lat, lng], { icon: makeIcon() }).addTo(map);

        marker.bindPopup(() => {
          const currentLang = (document.documentElement.lang as Lang) || 'en';
          return `<b>${name}</b><br/><small>${popupText[currentLang] ?? popupText.en}</small>`;
        });

        marker.on('mouseover', function () {
          const el = (marker.getElement() as HTMLElement)?.querySelector('div') as HTMLElement | null;
          if (el) el.style.transform = 'scale(1.2)';
        });
        marker.on('mouseout', function () {
          const el = (marker.getElement() as HTMLElement)?.querySelector('div') as HTMLElement | null;
          if (el) el.style.transform = 'scale(1)';
        });
      });
    };

    initLeaflet();

    return () => {
      mounted = false;
      if (mapRef.current) {
        (mapRef.current as { remove: () => void }).remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section style={{ background: '#0A2342', paddingTop: '5rem', paddingBottom: '5rem' }}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
        <div
          ref={titleRef}
          className={`text-center mb-10 reveal ${titleVisible ? 'visible' : ''}`}
        >
          <p className="label-caps mb-3" style={{ color: 'rgba(201,168,76,0.7)' }}>Service area</p>
          <h2
            style={{
              fontFamily: 'Cormorant Garamond, serif',
              fontWeight: 600,
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              color: '#FFFFFF',
              lineHeight: 1.1,
              marginBottom: '1rem',
            }}
            data-i18n="map.title"
          >
            {sectionTitles[lang]}
          </h2>
          <div style={{ width: 48, height: 1, background: '#C9A84C', margin: '0 auto' }} />
        </div>

        <div style={{ border: '1px solid rgba(201,168,76,0.2)', overflow: 'hidden', position: 'relative' }}>
          <div ref={mapContainerRef} style={{ height: 520, width: '100%', background: '#061729' }} />
          {/* Gold sea-side glow — above tiles (z 400) but below markers/popups (z 600+) */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to left, rgba(201,168,76,0.08) 0%, transparent 60%)',
              pointerEvents: 'none',
              zIndex: 400,
            }}
          />
        </div>

        <div className="mt-6 text-center">
          <p
            className="label-caps"
            style={{ color: 'rgba(201,168,76,0.7)', letterSpacing: '0.12em' }}
            data-i18n="map.stats"
          >
            {statsText[lang]}
          </p>
        </div>
      </div>
    </section>
  );
}