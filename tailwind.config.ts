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
        navy: '#111111',
        gold: '#F5C518',
        'gold-light': '#FFD84D',
        'navy-dark': '#0A0A0A',
        'navy-light': '#1C1C1C',
        orange: '#F97316',
        cream: '#FAF8F4',
        beige: '#F2EDE4',
        'beige-dark': '#E8DFD3',
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'sans-serif'],
        heading: ['var(--font-cormorant)', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
