/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Poppins', 'Inter', 'sans-serif'],
        body: ['Poppins', 'Inter', 'sans-serif'],
      },
      colors: {
        ink: 'rgb(var(--clr-ink) / <alpha-value>)',
        paper: 'rgb(var(--clr-paper) / <alpha-value>)',
        card: 'rgb(var(--clr-card) / <alpha-value>)',
        teal: {
          50: '#F7F5FF',
          100: '#EEE9FF',
          600: '#5C41DD',
          700: '#4D35C0',
        },
        amber: {
          50: '#FFF3DA',
          100: '#FFE7B0',
          600: '#FF9F1C',
          700: '#D97D00',
        },
        coral: {
          50: '#FFE8E8',
          100: '#FFCBCD',
          600: '#FF5A5F',
          700: '#D94349',
        },
        sage: {
          50: '#E6FAF2',
          100: '#C6F2E0',
          600: '#38C793',
          700: '#229C70',
        },
      },
      boxShadow: {
        soft: '0 4px 14px rgba(37,35,45,0.08)',
      },
      borderRadius: {
        card: '14px',
      },
    },
  },
  plugins: [],
}
