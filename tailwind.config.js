/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Sora', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      colors: {
        ink: 'rgb(var(--clr-ink) / <alpha-value>)',
        paper: 'rgb(var(--clr-paper) / <alpha-value>)',
        card: 'rgb(var(--clr-card) / <alpha-value>)',
        teal: {
          50: '#F8ECE8',
          100: '#F0D5CB',
          600: '#8A2D1C',
          700: '#6F2316',
        },
        amber: {
          50: '#FFF3DA',
          100: '#F8E2AF',
          600: '#D49A2A',
          700: '#AE7C1F',
        },
        coral: {
          50: '#FBE7DE',
          100: '#F5CCB9',
          600: '#B84C1C',
          700: '#943C16',
        },
        sage: {
          50: '#EEEEDF',
          100: '#DDDEC1',
          600: '#6D7552',
          700: '#586042',
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(43,20,16,0.08), 0 14px 34px -14px rgba(43,20,16,0.22)',
      },
      borderRadius: {
        card: '18px',
      },
    },
  },
  plugins: [],
}
