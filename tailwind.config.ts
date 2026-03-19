import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'void': '#0a0e1a',
        'deep': '#0f1628',
        'surface': '#161d33',
        'surface-light': '#1e2844',
        'border': '#2a3555',
        'teal': '#2dd4bf',
        'teal-dim': '#1a8a7a',
        'teal-glow': '#5eead4',
        'bloom-gold': '#fbbf24',
        'bloom-rose': '#f472b6',
        'bloom-violet': '#a78bfa',
        'text': '#e2e8f0',
        'text-dim': '#94a3b8',
        'text-muted': '#64748b',
      },
    },
  },
  plugins: [],
} satisfies Config
