/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f4edff',
          100: '#eadbff',
          200: '#d8bbff',
          500: '#8b2cff',
          600: '#6d00d9',
          700: '#5600ad'
        },
        candy: {
          pink: '#ff4f9a',
          mint: '#83f3de',
          sky: '#7bdcff'
        }
      },
      boxShadow: {
        soft: '0 18px 50px rgba(76, 29, 149, 0.12)',
        glow: '0 18px 40px rgba(109, 0, 217, 0.28)'
      }
    }
  },
  plugins: []
};
