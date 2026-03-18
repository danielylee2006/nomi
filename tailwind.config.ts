import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1f1a17",
        cream: "#f7f1e8",
        persimmon: "#d85d39",
        saffron: "#f1b24a",
        moss: "#5f7c53",
        mist: "#efe6da",
      },
      boxShadow: {
        card: "0 18px 50px rgba(38, 23, 11, 0.08)",
      },
      fontFamily: {
        sans: ["'Avenir Next'", "'Trebuchet MS'", "'Segoe UI'", "sans-serif"],
      },
      backgroundImage: {
        grain:
          "radial-gradient(circle at top left, rgba(255,255,255,0.9), transparent 35%), radial-gradient(circle at bottom right, rgba(216,93,57,0.16), transparent 28%)",
      },
    },
  },
  plugins: [],
};

export default config;
