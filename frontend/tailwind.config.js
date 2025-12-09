/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enable dark mode with class strategy
  theme: {
    extend: {
      colors: {
        gray: {
          // Extend gray scale with darker neutral values for dark mode
          925: '#0a0a0a',  // Main background (darker than 900)
          850: '#1a1a1a',  // Cards/panels (darker than 800)
          775: '#252525',  // Borders/dividers (darker than 700)
        }
      }
    },
  },
  plugins: [],
}