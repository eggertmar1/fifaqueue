/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#00D26A",
        accent: "#FFB800",
        dark: {
          bg: "#121212",
          surface: "#1E1E1E",
          card: "#2A2A2A",
          border: "#333333",
        },
      },
    },
  },
  plugins: [],
};
