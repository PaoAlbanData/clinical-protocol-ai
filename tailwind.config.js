/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#eef7f7",
          100: "#d5ecec",
          200: "#aed9da",
          500: "#1f8a8c",
          600: "#167274",
          700: "#135c5e",
          900: "#0b3536",
        },
      },
    },
  },
  plugins: [],
};
