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
        gold: '#C9A84C',
        'gold-light': '#d4b768',
        'navy-dark': '#071829',
        'navy-light': '#1a3a5c',
        orange: '#C9A84C',
        cream: '#FAF8F4',
        beige: '#F2EDE4',
        'beige-dark': '#E8DFD3',
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        heading: ['Cormorant Garamond', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
