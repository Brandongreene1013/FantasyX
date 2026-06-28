import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        // Legacy semantic tokens (kept for backward compat with admin pages)
        ink: "#101820",
        chalk: "#F6F7F2",
        turf: "#0E7A53",
        // Primary palette
        field: "#12664F",
        gold: "#D7A94B",
        rush: "#A83224",
        // Dark theme surfaces
        surface: "#0D1117",
        panel: "#161C2A",
        panel2: "#1E2A3A",
        rim: "#1E293B",
        // Text on dark
        frost: "#E2E8F0",
        muted: "#64748B",
        // Accent
        neon: "#00D46A",
        charge: "#3B82F6",
        amber: "#F59E0B",
        crimson: "#EF4444",
        // Positions
        qb: "#F59E0B",
        rb: "#10B981",
        wr: "#3B82F6",
        te: "#8B5CF6"
      },
      boxShadow: {
        soft: "0 16px 40px rgba(16, 24, 32, 0.10)",
        glow: "0 0 24px rgba(0, 212, 106, 0.25)",
        "glow-gold": "0 0 24px rgba(213, 167, 75, 0.30)"
      },
      backgroundImage: {
        "hero-gradient": "radial-gradient(ellipse at top, #1E2A3A 0%, #0D1117 60%)",
        "card-gradient": "linear-gradient(135deg, #161C2A 0%, #1E2A3A 100%)",
        "neon-gradient": "linear-gradient(135deg, #00D46A 0%, #12664F 100%)",
        "gold-gradient": "linear-gradient(135deg, #F59E0B 0%, #D7A94B 100%)"
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-up": "slideUp 0.3s ease-out"
      },
      keyframes: {
        slideUp: {
          "0%": { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" }
        }
      }
    }
  },
  plugins: []
};

export default config;
