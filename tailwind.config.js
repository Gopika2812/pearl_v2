/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#4096d3", // Sky Blue
        secondary: "#001f3f", // Navy Blue
        navy: "#001f3f",
        sky: "#4096d3",
      },
      fontFamily: {
        poppins: ['Poppins', 'sans-serif'],
        sans: ['Poppins', 'sans-serif'],
      }

    },
  },
  plugins: [],
};
