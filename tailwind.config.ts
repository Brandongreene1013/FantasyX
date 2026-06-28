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
        ink: "#101820",
        field: "#12664F",
        turf: "#0E7A53",
        chalk: "#F6F7F2",
        gold: "#D7A94B",
        rush: "#A83224"
      },
      boxShadow: {
        soft: "0 16px 40px rgba(16, 24, 32, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;
