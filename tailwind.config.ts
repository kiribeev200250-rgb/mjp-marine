import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── CRM & site brand ──────────────────────────────────────────
        navy: {
          DEFAULT: '#0A2342',
          900:     '#061729',  // сайдбар / топбар CRM
          deep:    '#061729',  // legacy alias
          light:   '#0D2D4A',  // legacy
          dark:    '#071829',  // legacy
        },
        gold: {
          DEFAULT: '#C9A84C',
          light:   '#E8C96A',
          dark:    '#A8893A',
        },
        // ── Семантика статусов ────────────────────────────────────────
        success: '#27AE60',  // оплачено / выполнено / положительная дельта
        danger:  '#C0392B',  // ошибка / просрочка / отрицательная дельта
        info:    '#2980B9',  // в работе / информация / новый лид
        warning: '#E67E22',  // внимание / ожидание / pending
        // ── Нейтральная шкала (контент CRM) ──────────────────────────
        gray: {
          900: '#101828',  // основной текст
          500: '#6B7688',  // вторичный текст / подписи
          200: '#E2E5EA',  // границы / разделители
          50:  '#F7F8FA',  // фон страницы / зебра таблиц
        },
        // ── Унаследованные цвета сайта ────────────────────────────────
        orange:       '#C9A84C',
        paper:        '#F5F0E8',
        'paper-dark': '#EDE7D9',
        cream:        '#FAF8F4',
        beige:        '#F2EDE4',
        'beige-dark': '#E8DFD3',
      },
      fontFamily: {
        sans:    ['Mulish', 'sans-serif'],            // основной сайт
        inter:   ['var(--font-inter)', 'Inter', 'sans-serif'], // CRM
        heading: ['Cormorant Garamond', 'serif'],
        mono:    ['Space Mono', 'monospace'],
      },
      fontSize: {
        // ── CRM именованные размеры ───────────────────────────────────
        display:    ['32px', { lineHeight: '1.15', fontWeight: '800' }],
        heading:    ['22px', { lineHeight: '1.25', fontWeight: '700' }],
        subheading: ['16px', { lineHeight: '1.4',  fontWeight: '600' }],
        body:       ['14px', { lineHeight: '1.5',  fontWeight: '400' }],
        label:      ['12px', { lineHeight: '1.3',  fontWeight: '600' }],
      },
      borderRadius: {
        card:    '10px',
        control: '8px',
        chip:    '999px',
      },
      boxShadow: {
        e1: '0 1px 2px rgba(16,24,40,0.05)',
        e2: '0 1px 3px rgba(16,24,40,0.08), 0 1px 2px rgba(16,24,40,0.06)',
        e3: '0 4px 12px rgba(16,24,40,0.10)',
        e4: '0 12px 32px rgba(16,24,40,0.16)',
      },
    },
  },
  plugins: [],
};

export default config;