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
        navy: '#0A2342',
        'navy-deep': '#061729',
        'navy-light': '#0D2D4A',
        'navy-dark': '#071829',
        gold: '#C9A84C',
        'gold-light': '#E8C96A',
        'gold-dark': '#A8893A',
        orange: '#C9A84C',
        paper: '#F5F0E8',
        'paper-dark': '#EDE7D9',
        cream: '#FAF8F4',
        beige: '#F2EDE4',
        'beige-dark': '#E8DFD3',
      },
      fontFamily: {
        sans: ['Mulish', 'sans-serif'],
        heading: ['Cormorant Garamond', 'serif'],
        mono: ['Space Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;