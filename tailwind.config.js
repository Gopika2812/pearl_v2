/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#4096d3",
        secondary: "#08295f",
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }

    },
  },
  plugins: [],
};
