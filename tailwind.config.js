/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        fuel: {
          cheap: '#22c55e',
          mid: '#f59e0b',
          expensive: '#ef4444',
        },
        nsw: {
          blue: '#002664',
          lightblue: '#cbedfd',
          red: '#d7153a',
        },
      },
    },
  },
  plugins: [],
};
