/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:      '#0c0c14',
        surface: '#16162a',
        frame:   '#252545',
        accent:  '#4fc3f7',
        danger:  '#ef5350',
        success: '#66bb6a',
        warn:    '#ffa726',
        muted:   '#5a5a7a',
      },
      fontFamily: {
        mono: ['"Courier New"', 'Courier', 'monospace'],
      },
    },
  },
  plugins: [],
};
