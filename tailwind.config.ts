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
        // Legacy tokens (kept for admin pages)
        ink: "#101820",
        chalk: "#F6F7F2",
        turf: "#0E7A53",
        field: "#12664F",
        gold: "#D7A94B",
        rush: "#A83224",
        // Surfaces
        surface: "#0D1117",
        panel: "#161C2A",
        panel2: "#1E2A3A",
        panel3: "#243447",
        rim: "#1E293B",
        // Text
        frost: "#E2E8F0",
        muted: "#E2E8F0",
        steel: "#F8FAFC",
        // Accents
        neon: "#00D46A",
        charge: "#3B82F6",
        amber: "#F59E0B",
        crimson: "#EF4444",
        violet: "#8B5CF6",
        // Positions
        qb: "#F59E0B",
        rb: "#10B981",
        wr: "#3B82F6",
        te: "#8B5CF6"
      },
      boxShadow: {
        soft: "0 16px 40px rgba(16, 24, 32, 0.10)",
        glow: "0 0 24px rgba(0, 212, 106, 0.30)",
        "glow-sm": "0 0 12px rgba(0, 212, 106, 0.20)",
        "glow-lg": "0 0 48px rgba(0, 212, 106, 0.40)",
        "glow-gold": "0 0 24px rgba(215, 169, 75, 0.35)",
        "glow-crimson": "0 0 24px rgba(239, 68, 68, 0.30)",
        "glow-charge": "0 0 24px rgba(59, 130, 246, 0.30)",
        depth: "0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
        card: "0 2px 12px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.03)"
      },
      backgroundImage: {
        "hero-gradient": "radial-gradient(ellipse at top, #1E2A3A 0%, #0D1117 60%)",
        "card-gradient": "linear-gradient(135deg, #161C2A 0%, #1E2A3A 100%)",
        "neon-gradient": "linear-gradient(135deg, #00D46A 0%, #12664F 100%)",
        "gold-gradient": "linear-gradient(135deg, #F59E0B 0%, #D7A94B 100%)",
        "fire-gradient": "linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)",
        "charge-gradient": "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)",
        "depth-gradient": "linear-gradient(180deg, #1E2A3A 0%, #0D1117 100%)",
        "exchange-gradient": "radial-gradient(ellipse at top left, rgba(0,212,106,0.08) 0%, transparent 50%), radial-gradient(ellipse at bottom right, rgba(59,130,246,0.06) 0%, transparent 50%), #0D1117"
      },
      animation: {
        "ticker": "ticker 40s linear infinite",
        "ticker-fast": "ticker 20s linear infinite",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-up": "slideUp 0.3s ease-out",
        "fade-up": "fadeUp 0.4s ease-out both",
        "fade-in": "fadeIn 0.3s ease-out both",
        "glow-pulse": "glowPulse 2.5s ease-in-out infinite",
        "float": "float 3s ease-in-out infinite",
        "scale-in": "scaleIn 0.2s ease-out both",
        "count-up": "fadeUp 0.5s ease-out both"
      },
      keyframes: {
        ticker: {
          "0%":   { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" }
        },
        slideUp: {
          "0%":   { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" }
        },
        fadeUp: {
          "0%":   { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" }
        },
        glowPulse: {
          "0%, 100%": { opacity: "0.7" },
          "50%":      { opacity: "1" }
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":      { transform: "translateY(-5px)" }
        },
        scaleIn: {
          "0%":   { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" }
        }
      }
    }
  },
  plugins: []
};

export default config;
