import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
        },
        coal: {
          800: "#1c1917",
          850: "#161311",
          900: "#100e0d",
          950: "#0a0908",
        },
      },
    },
  },
  plugins: [],
};
export default config;
