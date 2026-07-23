/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        glass: {
          light: "rgba(255, 255, 255, 0.12)",
          card: "rgba(255, 255, 255, 0.06)",
          border: "rgba(255, 255, 255, 0.18)",
          accent: "rgba(0, 122, 255, 0.3)",
          glow: "rgba(56, 189, 248, 0.2)",
        },
        ios: {
          bg: "#0B0E14",
          card: "#161B26",
          blue: "#007AFF",
          purple: "#BF5AF2",
          pink: "#FF375F",
          green: "#30D158",
          orange: "#FF9F0A",
          cyan: "#64D2FF",
        }
      },
      backdropBlur: {
        xs: '2px',
        glass: '24px',
      },
      boxShadow: {
        'glass-sm': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glass-lg': '0 20px 50px 0 rgba(0, 0, 0, 0.6)',
        'glow-blue': '0 0 25px rgba(0, 122, 255, 0.5)',
        'glow-cyan': '0 0 25px rgba(100, 210, 255, 0.5)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      }
    },
  },
  plugins: [],
}
