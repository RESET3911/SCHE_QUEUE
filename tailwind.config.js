/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        board: {
          base: '#0c0f14',
          panel: '#141922',
          raise: '#1b2230',
          line: 'rgba(148, 163, 184, 0.14)',
          text: '#e7edf5',
          dim: '#8b98a9',
          amber: '#ffb52e',
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
