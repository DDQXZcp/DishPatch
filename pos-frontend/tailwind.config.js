/** @type {import('tailwindcss').Config} */

import scrollbarHide from "tailwind-scrollbar-hide";

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],

  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#B7791F",
          hover: "#975A16",
          light: "#FFF7E6",
        },

        secondary: {
          DEFAULT: "#475569",
          hover: "#334155",
          light: "#F1F5F9",
        },

        background: "#F8FAFC",
        surface: "#FFFFFF",

        text: {
          primary: "#0F172A",
          secondary: "#64748B",
          muted: "#94A3B8",
        },

        border: {
          DEFAULT: "#E2E8F0",
          strong: "#CBD5E1",
        },
      },

      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "sans-serif",
        ],
      },

      boxShadow: {
        card: "0 8px 30px rgba(15, 23, 42, 0.06)",
      },
    },
  },

  plugins: [scrollbarHide],
};