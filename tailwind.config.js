/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        board: {
          base: '#f2f2ee',
          panel: '#ffffff',
          raise: '#ecece6',
          line: 'rgba(30, 27, 20, 0.13)',
          text: '#1c1b18',
          dim: '#6b6a63',
          amber: '#a8570d',
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans JP"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
