/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      colors: {
        // Phosphor Green Palette
        'phosphor': {
          'bright': '#00ff00',
          'normal': '#00cc00',
          'dim': '#008800',
          'dark': '#004400',
          'shadow': '#002200',
        },
        // Terminal Background
        'terminal': {
          'black': '#000000',
          'screen': '#000500',
        }
      },
      fontFamily: {
        'mono': ['Courier New', 'Consolas', 'Monaco', 'Lucida Console', 'monospace'],
      },
      animation: {
        'cursor-blink': 'cursor-blink 1s step-end infinite',
        'scanline': 'scanline-move 8s linear infinite',
        'flicker': 'flicker 0.1s infinite alternate',
        'matrix-fall': 'matrix-fall 20s linear infinite',
        'glitch': 'glitch-skew 0.5s infinite alternate',
        'type': 'type-text 3s steps(40, end)',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'boot': 'boot-appear 0.1s ease-in forwards',
        'screen-on': 'screen-turn-on 0.5s ease-out',
        'screen-off': 'screen-turn-off 0.3s ease-in forwards',
      },
      keyframes: {
        'cursor-blink': {
          '0%, 50%': { opacity: '1' },
          '51%, 100%': { opacity: '0' },
        },
        'scanline-move': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'flicker': {
          '0%': { opacity: '0.98' },
          '100%': { opacity: '1' },
        },
        'matrix-fall': {
          'to': { transform: 'translateY(200vh)' },
        },
        'glitch-skew': {
          '0%': { transform: 'skew(0deg)' },
          '20%': { transform: 'skew(2deg)' },
          '40%': { transform: 'skew(-1deg)' },
          '60%': { transform: 'skew(0.5deg)' },
          '80%': { transform: 'skew(-0.5deg)' },
          '100%': { transform: 'skew(0deg)' },
        },
        'type-text': {
          'from': { width: '0' },
          'to': { width: '100%' },
        },
        'pulse-glow': {
          '0%, 100%': {
            opacity: '1',
            textShadow: '0 0 5px #00ff00, 0 0 10px #00cc00',
          },
          '50%': {
            opacity: '0.8',
            textShadow: '0 0 10px #00ff00, 0 0 20px #00cc00, 0 0 30px #008800',
          },
        },
        'boot-appear': {
          'to': { opacity: '1' },
        },
        'screen-turn-on': {
          '0%': {
            transform: 'scaleY(0.01) scaleX(1)',
            filter: 'brightness(3)',
          },
          '50%': {
            transform: 'scaleY(1) scaleX(1)',
            filter: 'brightness(1.5)',
          },
          '100%': {
            transform: 'scaleY(1) scaleX(1)',
            filter: 'brightness(1)',
          },
        },
        'screen-turn-off': {
          '0%': {
            transform: 'scaleY(1) scaleX(1)',
            filter: 'brightness(1)',
          },
          '60%': {
            transform: 'scaleY(0.01) scaleX(1)',
            filter: 'brightness(3)',
          },
          '100%': {
            transform: 'scaleY(0) scaleX(0)',
            filter: 'brightness(0)',
          },
        },
      },
      boxShadow: {
        'terminal': '0 0 10px #004400, inset 0 0 10px #002200',
        'glow': '0 0 5px #00ff00, 0 0 10px #00cc00',
        'glow-lg': '0 0 10px #00ff00, 0 0 20px #00cc00, 0 0 30px #008800',
      },
      dropShadow: {
        'phosphor': '0 0 3px #00ff00',
        'phosphor-lg': '0 0 5px #00ff00',
      },
      backgroundImage: {
        'scanlines': 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0, 255, 0, 0.02) 1px, rgba(0, 255, 0, 0.02) 2px)',
        'crt-curve': 'radial-gradient(ellipse at center, transparent 0%, transparent 60%, rgba(0, 0, 0, 0.1) 80%, rgba(0, 0, 0, 0.4) 100%)',
      },
      // Custom utilities for CRT effects
      backdropFilter: {
        'crt': 'blur(0.8px)',
      },
    },
  },
  plugins: [
    // Custom plugin for phosphor text glow
    function({ addUtilities }) {
      const newUtilities = {
        '.text-phosphor': {
          color: '#00ff00',
          textShadow: '0 0 3px #00ff00, 0 0 6px #00cc00, 0 0 9px #004400',
        },
        '.text-phosphor-dim': {
          color: '#00cc00',
          textShadow: '0 0 2px #00cc00, 0 0 4px #008800',
        },
        '.border-phosphor': {
          borderColor: '#00cc00',
          boxShadow: '0 0 5px #004400, inset 0 0 5px #002200',
        },
        '.crt-screen': {
          borderRadius: '20px',
          boxShadow: 'inset 0 0 100px rgba(0, 0, 0, 0.5), 0 0 50px #002200',
        },
        '.ascii-border': {
          border: '2px solid #00cc00',
          padding: '1rem',
          position: 'relative',
        },
        '.terminal-window': {
          backgroundColor: '#000500',
          border: '2px solid #00cc00',
          borderRadius: '4px',
          boxShadow: '0 0 20px rgba(0, 255, 0, 0.1)',
        },
      }
      addUtilities(newUtilities)
    },
  ],
}