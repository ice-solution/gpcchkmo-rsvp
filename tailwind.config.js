/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./views/**/*.ejs', './public/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        brand: {
          lime: '#c8ff00',
          blue: '#1361ae',
          deep: '#004080',
        },
      },
      fontFamily: {
        display: ['"Noto Sans TC"', '"Segoe UI"', 'sans-serif'],
        body: ['"Noto Sans TC"', '"Segoe UI"', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 18px 50px rgba(0, 64, 128, 0.12)',
      },
    },
  },
  plugins: [],
};
