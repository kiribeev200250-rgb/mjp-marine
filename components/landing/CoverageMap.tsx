'use client';

import { useEffect, useRef, useState } from 'react';
import { detectLang, type Lang } from '@/lib/i18n';

const COVERAGE_POLYGON: [number, number][] = [
  [38.843, 0.107],
  [38.790, 0.165],
  [38.644, 0.044],
  [38.599, -0.059],
  [38.540, -0.122],
  [38.503, -0.230],
  [38.345, -0.481],
  [38.209, -0.637],
  [38.017, -0.712],
  [37.986, -0.693],
  [37.828, -0.846],
  [37.604, -1.024],
  [37.606, -0.988],
  [37.605, -0.986],
  [37.630, -0.978],
];

const MARINAS = [
  { name: 'Dénia',                lat: 38.843, lng: 0.107 },
  { name: 'Jávea',                lat: 38.790, lng: 0.165 },
  { name: 'Calpe',                lat: 38.644, lng: 0.044 },
  { name: 'Altea',                lat: 38.599, lng: -0.059 },
  { name: 'Benidorm',             lat: 38.540, lng: -0.122 },
  { name: 'Villajoyosa',          lat: 38.503, lng: -0.230 },
  { name: 'Alicante',             lat: 38.345, lng: -0.481 },
  { name: 'Santa Pola',           lat: 38.209, lng: -0.637 },
  { name: 'Guardamar',            lat: 38.017, lng: -0.712 },
  { name: 'Torrevieja',           lat: 37.986, lng: -0.693 },
  { name: 'San Pedro del Pinatar',lat: 37.828, lng: -0.846 },
  { name: 'Mazarrón',             lat: 37.604, lng: -1.024 },
  { name: 'Cartagena',            lat: 37.606, lng: -0.988 },
];

const sectionTitles: Record<Lang, string> = {
  en: 'Our Coverage', es: 'Nuestra Cobertura', ru: 'Наша зона покрытия', uk: 'Наша зона покриття',
};

const statsText: Record<Lang, string> = {
  en: '244km of coastline · 13 marinas · 1 team',
  es: '244km de costa · 13 marinas · 1 equipo',
  ru: '244 км побережья · 13 марин · 1 команда',
  uk: '244 км узбережжя · 13 марин · 1 команда',
};

const popupText: Record<Lang, string> = {
  en: 'We service this port',
  es: 'Atendemos este puerto',
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
    if (mapRef.current) return; // already initialized

    let mounted = true;

    const initLeaflet = async () => {
      /* Inject leaflet CSS once */
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      const L = (await import('leaflet')).default;
      if (!mounted || !mapContainerRef.current) return;

      // Fix default icon path issue with webpack
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapContainerRef.current, {
        center: [38.3452, -0.4810],
        zoom: 8,
        zoomControl: false,
        scrollWheelZoom: true,
        attributionControl: false,
      });

      mapRef.current = map;

      // CartoDB Dark Matter tiles
      L.tileLayer(
        'https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
        { subdomains: 'abcd', maxZoom: 19 }
      ).addTo(map);

      // Coverage polygon
      L.polygon(COVERAGE_POLYGON, {
        color: '#C9A84C',
        weight: 2,
        opacity: 0.8,
        fillColor: '#C9A84C',
        fillOpacity: 0.08,
      }).addTo(map);

      // Custom gold anchor marker
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
        {/* Header */}
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

        {/* Map container */}
        <div
          style={{
            border: '1px solid rgba(201,168,76,0.2)',
            borderRadius: 0,
            overflow: 'hidden',
          }}
        >
          <div
            ref={mapContainerRef}
            style={{ height: 520, width: '100%', background: '#061729' }}
          />
        </div>

        {/* Stats below map */}
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