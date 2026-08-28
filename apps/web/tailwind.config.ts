import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#5865f2',
          dark: '#3f47b3',
          accent: '#00d3a7',
        },
        surface: {
          DEFAULT: '#0f1117',
          raised: '#161923',
          border: '#242938',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
