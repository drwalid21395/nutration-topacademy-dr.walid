import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ocean: {
          50: '#eef7fc',
          100: '#d6ebf8',
          200: '#b0d9f0',
          300: '#7cc0e5',
          400: '#419fd5',
          500: '#1d84bc',
          600: '#15699d',
          700: '#155480',
          800: '#15476b',
          900: '#0e3552',
          950: '#0a2438',
        },
        lagoon: {
          400: '#22c7c7',
          500: '#17a8ab',
          600: '#12878c',
        },
        gold: {
          300: '#f2cf6b',
          400: '#eab84b',
          500: '#d9a23a',
          600: '#b8862c',
        },
      },
      fontFamily: {
        sans: [
          'Cairo',
          'Tahoma',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 4px 20px -4px rgba(10, 36, 56, 0.12)',
        'card-lg': '0 12px 40px -8px rgba(10, 36, 56, 0.2)',
      },
      backgroundImage: {
        'hero-waves':
          'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(125,192,229,0.25), transparent), linear-gradient(180deg, #0a2438 0%, #0e3552 55%, #155480 100%)',
        'water-pattern':
          "url('/images/water-lanes.svg')",
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'wave': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s ease-out both',
        float: 'float 4s ease-in-out infinite',
        wave: 'wave 12s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
