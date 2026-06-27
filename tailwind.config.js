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
          50: '#E6F3F5',
          100: '#CCE7EA',
          600: '#0B7285',
          700: '#095F6E',
        },
        amber: {
          50: '#FDF3E4',
          100: '#FAE3C0',
          600: '#E08F22',
          700: '#B9711A',
        },
        coral: {
          50: '#FCE9DD',
          100: '#F8D2BB',
          600: '#C94C0A',
          700: '#A33E08',
        },
        sage: {
          50: '#E3F5EC',
          100: '#C7EBDA',
          600: '#26815E',
          700: '#1F6A4C',
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(28,37,65,0.06), 0 8px 24px -8px rgba(28,37,65,0.10)',
      },
      borderRadius: {
        card: '18px',
      },
    },
  },
  plugins: [],
}
