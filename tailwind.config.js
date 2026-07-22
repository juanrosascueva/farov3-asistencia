/** @type {import('tailwindcss').Config} */
const palette = (shades) => shades;

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
        neutral: palette({ 50: '#FAFAFC', 100: '#F5F3F8', 200: '#E5E7EE', 300: '#C5C1D3', 400: '#AAA6B6', 500: '#8A8798', 600: '#706D7D', 700: '#59566A', 800: '#3E3B4A', 900: '#25232D', 950: '#17151C' }),
        primary: palette({ 50: '#F7F5FF', 100: '#EEE9FF', 200: '#DCD4FF', 300: '#C4B7FF', 400: '#8066FF', 500: '#6849FF', 600: '#5C41DD', 700: '#4D35C0', 800: '#3F2B9A', 900: '#302174', 950: '#1F164B' }),
        success: palette({ 50: '#E6FAF2', 100: '#C6F2E0', 200: '#91E5C4', 300: '#65D6AA', 400: '#4CCE9D', 500: '#38C793', 600: '#2EAF7E', 700: '#229C70', 800: '#187654', 900: '#12573F', 950: '#093525' }),
        warning: palette({ 50: '#FFF3DA', 100: '#FFE7B0', 200: '#FFD47A', 300: '#FFC45A', 400: '#FFB33A', 500: '#FF9F1C', 600: '#E88B0B', 700: '#D97D00', 800: '#A95D00', 900: '#7A4300', 950: '#482600' }),
        danger: palette({ 50: '#FFE8E8', 100: '#FFCBCD', 200: '#FFA7AA', 300: '#FF858A', 400: '#FF6D72', 500: '#FF5A5F', 600: '#E84D53', 700: '#D94349', 800: '#AA3237', 900: '#7B2529', 950: '#481416' }),
        info: palette({ 50: '#EAF3FF', 100: '#D3E7FF', 200: '#A8D0FF', 300: '#7CB9FF', 400: '#519FFF', 500: '#2F80ED', 600: '#1E6FD6', 700: '#155AB4', 800: '#104789', 900: '#0D3768', 950: '#08203E' }),
        yellow: palette({ 50: '#FFF6D8', 100: '#FFEDAE', 200: '#FFE07A', 300: '#FFD453', 400: '#FFC43D', 500: '#E5AC25', 600: '#C68E17', 700: '#9A6C0E', 800: '#73500A', 900: '#513807', 950: '#301F02' }),
      },
      boxShadow: {
        soft: '0 4px 14px rgba(37,35,45,0.08)',
        floating: '0 8px 24px rgba(37,35,45,0.14)',
      },
      borderRadius: { card: '14px' },
    },
  },
  plugins: [],
};
