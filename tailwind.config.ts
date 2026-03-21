import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      screens: {
        'xs': '475px',
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans:  ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        navy:   { DEFAULT: '#0B1628', 2: '#162035' },
        gold:   { DEFAULT: '#C9A84C', 2: '#E8C96A' },
        cream:  { DEFAULT: '#FAF8F3', 2: '#F2EDE4' },
        muted:  '#6B7280',
        border: '#E5E0D8',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}

export default config
