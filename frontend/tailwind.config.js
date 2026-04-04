/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Zaltix brand — deep geometric purple
        violet: {
          50:  '#f2eeff',
          100: '#e4dcff',
          200: '#c9baff',
          300: '#a98eff',
          400: '#8660f5',
          500: '#6a3de8',
          600: '#3D1AA0', // primary brand
          700: '#2D1278', // hover
          800: '#1f0c56',
          900: '#130737',
        },
        gold: {
          50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d',
          400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309',
        },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      backdropBlur: { xs: '2px' },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideIn: { '0%': { transform: 'translateX(-10px)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
      },
    },
  },
  plugins: [],
};
