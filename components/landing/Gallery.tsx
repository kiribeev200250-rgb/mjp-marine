'use client';

import { useEffect, useRef, useState } from 'react';
import { detectLang, type Lang } from '@/lib/i18n';

interface GalleryItem {
  id: number;
  title: string; titleEs: string; titleRu: string; titleUk: string;
  description: string; descEs: string; descRu: string; descUk: string;
  beforeUrl: string; afterUrl: string;
  serviceTag: string;
}

interface GalleryProps {
  items: GalleryItem[];
  showAnimations?: boolean | null;
}

const titleByLang: Record<Lang, { title: string; subtitle: string; before: string; after: string }> = {
  en: { title: 'Before & After', subtitle: 'See the transformation. Drag the slider to compare.', before: 'Before', after: 'After' },
  es: { title: 'Antes y Después', subtitle: 'Observa la transformación. Arrastra el deslizador para comparar.', before: 'Antes', after: 'Después' },
  ru: { title: 'До и после', subtitle: 'Смотрите трансформацию. Перетащите ползунок для сравнения.', before: 'До', after: 'После' },
  uk: { title: 'До і після', subtitle: 'Дивіться трансформацію. Перетягніть повзунок для порівняння.', before: 'До', after: 'Після' },
};

function getTitle(item: GalleryItem, lang: Lang) {
  return { en: item.title, es: item.titleEs || item.title, ru: item.titleRu || item.title, uk: item.titleUk || item.title }[lang];
}
function getDesc(item: GalleryItem, lang: Lang) {
  return { en: item.description, es: item.descEs || item.description, ru: item.descRu || item.description, uk: item.descUk || item.description }[lang];
}

function BeforeAfterSlider({ item, labels }: { item: GalleryItem; labels: { before: string; after: string } }) {
  const [pos, setPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  function getX(e: MouseEvent | TouchEvent) {
    const touch = (e as TouchEvent).touches?.[0];
    return touch ? touch.clientX : (e as MouseEvent).clientX;
  }

  function updatePos(clientX: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const p = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setPos(p);
  }

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => { if (dragging.current) updatePos(getX(e)); };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove as EventListener);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove as EventListener);
      window.removeEventListener('touchend', onUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video overflow-hidden cursor-col-resize select-none"
      style={{ background: '#061729', borderRadius: 0 }}
      onMouseDown={(e) => { dragging.current = true; updatePos(e.clientX); }}
      onTouchStart={(e) => { dragging.current = true; updatePos(e.touches[0].clientX); }}
    >
      {/* After image */}
      <img src={item.afterUrl} alt={`After: ${item.title}`} className="absolute inset-0 w-full h-full object-cover" draggable={false} />

      {/* Before image (clipped) */}
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img src={item.beforeUrl} alt={`Before: ${item.title}`} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      </div>

      {/* Labels */}
      <span
        className="absolute top-3 left-3 label-caps"
        style={{ background: 'rgba(0,0,0,0.7)', color: 'rgba(255,255,255,0.8)', padding: '3px 8px', fontSize: '10px' }}
      >
        {labels.before}
      </span>
      <span
        className="absolute top-3 right-3 label-caps"
        style={{ background: 'rgba(201,168,76,0.9)', color: '#0A2342', padding: '3px 8px', fontSize: '10px' }}
      >
        {labels.after}
      </span>

      {/* Divider line */}
      <div className="absolute top-0 bottom-0 w-px shadow-lg pointer-events-none" style={{ left: `${pos}%`, background: 'rgba(255,255,255,0.8)' }} />

      {/* Handle */}
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 flex items-center justify-center pointer-events-none z-10"
        style={{ left: `${pos}%`, background: 'white', border: '2px solid #C9A84C', borderRadius: 0 }}
      >
        <svg className="w-4 h-4" style={{ color: '#0A2342' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l-4 3 4 3M16 9l4 3-4 3" />
        </svg>
      </div>
    </div>
  );
}

export default function Gallery({ items, showAnimations }: GalleryProps) {
  const [lang, setLang] = useState<Lang>('en');
  const animate = showAnimations !== false;
  const titleRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [titleVisible, setTitleVisible] = useState(false);
  const [gridVisible, setGridVisible] = useState(false);

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
    if (!animate) { setTitleVisible(true); setGridVisible(true); return; }
    const observe = (el: HTMLElement | null, setter: (v: boolean) => void) => {
      if (!el) return;
      const io = new IntersectionObserver(
        ([e]) => { if (e.isIntersecting) { setter(true); io.disconnect(); } },
        { threshold: 0.1 }
      );
      io.observe(el);
      return () => io.disconnect();
    };
    const d1 = observe(titleRef.current, setTitleVisible);
    const d2 = observe(gridRef.current, setGridVisible);
    return () => { d1?.(); d2?.(); };
  }, [animate]);

  if (!items.length) return null;

  const labels = titleByLang[lang];

  return (
    <section id="gallery" style={{ background: '#0A2342', paddingTop: '5rem', paddingBottom: '5rem' }}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
        {/* Header */}
        <div
          ref={titleRef}
          className={`text-center mb-12 ${animate ? 'reveal' : ''} ${animate && titleVisible ? 'visible' : ''}`}
        >
          <p className="label-caps mb-3" style={{ color: 'rgba(201,168,76,0.7)' }}>Our work</p>
          <h2
            style={{
              fontFamily: 'Cormorant Garamond, serif',
              fontWeight: 600,
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              color: '#FFFFFF',
              lineHeight: 1.1,
              marginBottom: '1rem',
            }}
            data-i18n="gallery.title"
          >
            {labels.title}
          </h2>
          <div style={{ width: 48, height: 1, background: '#C9A84C', margin: '0 auto 1rem' }} />
          <p style={{ color: 'rgba(255,255,255,0.5)', maxWidth: '32rem', margin: '0 auto', fontFamily: 'Mulish, sans-serif', fontWeight: 300 }} data-i18n="gallery.subtitle">
            {labels.subtitle}
          </p>
        </div>

        {/* Grid */}
        <div
          ref={gridRef}
          className={`grid md:grid-cols-2 xl:grid-cols-3 gap-6 ${animate ? 'reveal-stagger' : ''} ${animate && gridVisible ? 'visible' : ''}`}
        >
          {items.map((item) => (
            <div key={item.id}>
              <BeforeAfterSlider item={item} labels={labels} />
              <div className="mt-3 px-0">
                <div className="flex items-center justify-between">
                  <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 600, fontSize: '1.1rem', color: 'white' }}>
                    {getTitle(item, lang)}
                  </h3>
                  {item.serviceTag && (
                    <span
                      className="label-caps"
                      style={{
                        background: 'rgba(201,168,76,0.1)',
                        color: '#C9A84C',
                        padding: '2px 8px',
                        border: '1px solid rgba(201,168,76,0.3)',
                        fontSize: '10px',
                      }}
                    >
                      {item.serviceTag}
                    </span>
                  )}
                </div>
                {getDesc(item, lang) && (
                  <p style={{ fontFamily: 'Mulish, sans-serif', fontWeight: 300, fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', marginTop: '0.3rem', lineHeight: 1.6 }}>
                    {getDesc(item, lang)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}