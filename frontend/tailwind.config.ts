import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      colors: {
        vault: {
          DEFAULT: "#080C14",
          obsidian: "#080C14",
          card: "#0E1422",
          surface: "#121A2B",
          elevated: "#172136",
          border: "#1E2B45",
          highlight: "#2A3A5E",
        },
        parchment: {
          DEFAULT: "#F7F5EE",
          base: "#F7F5EE",
          card: "#FFFFFF",
          surface: "#F0EDE4",
          elevated: "#E8E4D8",
          border: "#E2DDD0",
          highlight: "#D6CFBF",
        },
        bullion: {
          50: "#FAF6EB",
          100: "#F4ECCF",
          200: "#E9D9A0",
          300: "#DDC570",
          400: "#D4B34B",
          500: "#C5A869",
          600: "#A68A3E",
          700: "#81682B",
          800: "#5F4B1E",
          900: "#3D2E11",
        },
        ledger: {
          mint: "#059669",
          credit: "#10B981",
          debit: "#EF4444",
          amber: "#F59E0B",
        },
      },
      boxShadow: {
        milled: "0 0 0 1px rgba(255, 255, 255, 0.07), 0 1px 3px 0 rgba(0, 0, 0, 0.4)",
        "milled-light": "0 0 0 1px rgba(15, 23, 42, 0.08), 0 1px 3px 0 rgba(0, 0, 0, 0.05)",
        "milled-elevated": "0 0 0 1px rgba(255, 255, 255, 0.09), 0 8px 24px -4px rgba(0, 0, 0, 0.6)",
        "bullion-glow": "0 0 25px -4px rgba(197, 168, 105, 0.3)",
        "card-depth": "0 14px 28px -6px rgba(0, 0, 0, 0.6), inset 0 1px 1px rgba(255, 255, 255, 0.12)",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-in-out",
        "slide-up": "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-right": "slideRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        "slip-feed": "slipFeed 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        "pulse-subtle": "pulseSubtle 3s infinite ease-in-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideRight: {
          "0%": { opacity: "0", transform: "translateX(-100%)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        slipFeed: {
          "0%": { opacity: "0", transform: "translateY(24px) scale(0.96)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        pulseSubtle: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
