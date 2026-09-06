import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-cairo)", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#f5f3f0",
          100: "#e8e2db",
          200: "#d4c8b9",
          300: "#b8a68f",
          400: "#9c8466",
          500: "#7d6543",
          600: "#655036",
          700: "#4f3e2b",
          800: "#3a2e20",
          900: "#241d14",
        },
      },
    },
  },
  plugins: [],
};

export default config;
