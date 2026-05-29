/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      keyframes: {
        toast: {
          from: { opacity: '0', transform: 'translateY(1rem)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        toast: 'toast 0.3s ease-out',
      },
      colors: {
        primary: {
          100: '#eff6ff',
          300: '#93c5fd',
          500: '#3b82f6',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
        neutral: {
          white: '#ffffff',
          50:  '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          950: '#030712',
        },
        error: {
          500: '#ef4444',
        },
      },
    },
  },
  plugins: [],
}
