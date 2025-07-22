/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Retro console colors
        console: {
          bg: '#000000',
          fg: '#00ff00',
          dim: '#008800',
          bright: '#00ff00',
          error: '#ff0000',
          warning: '#ffff00',
          info: '#00ffff',
          success: '#00ff00',
          border: '#003300',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scan': 'scan-line 8s linear infinite',
        'flicker': 'text-flicker 2s infinite',
        'blink': 'terminal-blink 1s infinite',
        'glitch-1': 'glitch-1 0.5s infinite',
        'glitch-2': 'glitch-2 0.5s infinite',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(0, 255, 0, 0.5)',
        'glow-lg': '0 0 40px rgba(0, 255, 0, 0.6)',
        'glow-error': '0 0 20px rgba(255, 0, 0, 0.5)',
        'inner-glow': 'inset 0 0 20px rgba(0, 255, 0, 0.1)',
      },
      backgroundImage: {
        'scan-lines': 'linear-gradient(transparent 50%, rgba(0, 255, 0, 0.03) 50%)',
        'crt-overlay': 'radial-gradient(ellipse at center, rgba(0, 255, 0, 0.05) 0%, transparent 100%)',
      },
    },
  },
  plugins: [],
}