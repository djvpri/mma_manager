import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // MMA Manager palette
        octagon: {
          red:   '#E24B4A',
          teal:  '#1D9E75',
          amber: '#EF9F27',
          dark:  'rgb(var(--color-bg) / <alpha-value>)',
          card:  'rgb(var(--color-card) / <alpha-value>)',
          border:'rgb(var(--color-border) / <alpha-value>)',
        },
        // Tema-aware: white = warna foreground utama, gray-* = skala teks/divider
        white: 'rgb(var(--color-fg) / <alpha-value>)',
        gray: {
          100: 'rgb(var(--color-gray-100) / <alpha-value>)',
          200: 'rgb(var(--color-gray-200) / <alpha-value>)',
          300: 'rgb(var(--color-gray-300) / <alpha-value>)',
          400: 'rgb(var(--color-gray-400) / <alpha-value>)',
          500: 'rgb(var(--color-gray-500) / <alpha-value>)',
          600: 'rgb(var(--color-gray-600) / <alpha-value>)',
        },
        yellow: {
          300: 'rgb(var(--color-yellow-300) / <alpha-value>)',
          400: 'rgb(var(--color-yellow-400) / <alpha-value>)',
          500: 'rgb(var(--color-yellow-500) / <alpha-value>)',
        },
        blue: {
          300: 'rgb(var(--color-blue-300) / <alpha-value>)',
          400: 'rgb(var(--color-blue-400) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
