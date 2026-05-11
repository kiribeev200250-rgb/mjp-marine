'use client';

import { useEffect, useRef, useState } from 'react';
import { detectLang, type Lang } from '@/lib/i18n';

interface GalleryItem {
  id: number;
  title: string;
  titleEs: string;
  titleRu: string;
  titleUk: string;
  description: string;
  descEs: string;
  descRu: string;
  descUk: string;
  beforeUrl: string;
  afterUrl: string;
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
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video rounded-xl overflow-hidden cursor-col-resize select-none bg-navy-dark"
      onMouseDown={(e) => { dragging.current = true; updatePos(e.clientX); }}
      onTouchStart={(e) => { dragging.current = true; updatePos(e.touches[0].clientX); }}
    >
      {/* After image (full width base) */}
      <img
        src={item.afterUrl}
        alt={`After: ${item.title}`}
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />

      {/* Before image (clipped) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        <img
          src={item.beforeUrl}
          alt={`Before: ${item.title}`}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
      </div>

      {/* Labels */}
      <span className="absolute top-3 left-3 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded-md backdrop-blur-sm">
        {labels.before}
      </span>
      <span className="absolute top-3 right-3 bg-gold/90 text-navy text-xs font-bold px-2 py-1 rounded-md">
        {labels.after}
      </span>

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white/90 shadow-lg pointer-events-none"
        style={{ left: `${pos}%` }}
      />

      {/* Handle */}
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-white shadow-xl flex items-center justify-center pointer-events-none z-10 border-2 border-gold"
        style={{ left: `${pos}%` }}
      >
        <svg className="w-4 h-4 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      const stored = localStorage.getItem('lang') as Lang | null;
      if (stored) setLang(stored);
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!animate) return;
    const observe = (el: HTMLElement | null, setter: (v: boolean) => void) => {
      if (!el) return;
      const obs = new IntersectionObserver(
        ([e]) => { if (e.isIntersecting) { setter(true); obs.disconnect(); } },
        { threshold: 0.1 }
      );
      obs.observe(el);
      return () => obs.disconnect();
    };
    const d1 = observe(titleRef.current, setTitleVisible);
    const d2 = observe(gridRef.current, setGridVisible);
    return () => { d1?.(); d2?.(); };
  }, [animate]);

  if (!items.length) return null;

  const labels = titleByLang[lang];

  return (
    <section id="gallery" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          ref={titleRef}
          className={`text-center mb-12 ${animate ? 'reveal' : ''} ${animate && titleVisible ? 'visible' : ''}`}
        >
          <h2 className="section-title mb-3" data-i18n="gallery.title">{labels.title}</h2>
          <div className="w-16 h-1 bg-gradient-to-r from-gold to-orange mx-auto rounded-full mb-4" />
          <p className="text-gray-500 max-w-lg mx-auto" data-i18n="gallery.subtitle">{labels.subtitle}</p>
        </div>

        <div
          ref={gridRef}
          className={`grid md:grid-cols-2 xl:grid-cols-3 gap-8 ${animate ? 'reveal-stagger' : ''} ${animate && gridVisible ? 'visible' : ''}`}
        >
          {items.map((item) => (
            <div key={item.id} className="group">
              <BeforeAfterSlider item={item} labels={labels} />
              <div className="mt-3 px-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-base font-bold text-navy">
                    {getTitle(item, lang)}
                  </h3>
                  {item.serviceTag && (
                    <span className="text-xs bg-gold/10 text-gold font-semibold px-2 py-0.5 rounded-full border border-gold/30">
                      {item.serviceTag}
                    </span>
                  )}
                </div>
                {getDesc(item, lang) && (
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{getDesc(item, lang)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
