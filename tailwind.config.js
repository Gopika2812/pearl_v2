/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#319bab", 
      },
       fontFamily: {
        cursive: ['"Dancing Script"', 'cursive'],
      },
    },
  },
  plugins: [],
};
