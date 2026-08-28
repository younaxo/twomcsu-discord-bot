import type { Config } from 'tailwindcss';

// Цвета читаются из CSS-переменных (см. globals.css) — это и есть design tokens проекта.
// Имена ключей (brand/surface) сохранены ради совместимости с уже написанными компонентами,
// сами значения теперь ведут на тёплую тёмно-оранжевую палитру вместо старой сине-зелёной.
function withOpacity(variable: string) {
  return `rgb(var(${variable}) / <alpha-value>)`;
}

export default {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: withOpacity('--accent'),
          dark: withOpacity('--accent-solid'),
          accent: withOpacity('--accent-soft'),
        },
        surface: {
          DEFAULT: withOpacity('--bg'),
          raised: withOpacity('--bg-elevated'),
          glass: withOpacity('--glass'),
          border: withOpacity('--border'),
        },
        muted: withOpacity('--text-muted'),
        success: withOpacity('--success'),
        warning: withOpacity('--warning'),
        danger: withOpacity('--danger'),
      },
      fontFamily: {
        sans: ['Onest', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
