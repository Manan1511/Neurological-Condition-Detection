/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Parkinson's Friendly Palette (Cool Blue Theme)
        'park-sage': '#79a2c8',      // Cards
        'park-navy': '#1f2d3d',      // Primary Text/Headings
        'park-charcoal': '#1f2d3d',  // Body Text
        'park-shadow': '#476a9f',    // Shadow

        'park-bg': '#e5f9fc',        // Background
        'park-dark': '#111827',
      },
      fontFamily: {
        sans: ['"Libre Franklin"', 'sans-serif'],
        branding: ['"DM Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
