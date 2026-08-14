/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}", "./shared/**/*.{js,ts}"],
  theme: {
    extend: {
      colors: {
        // Dodo Payments-inspired chartreuse/lime brand accent
        lime: {
          50: "#fafef0",
          100: "#f2fbd4",
          200: "#e4f7a6",
          300: "#d3f16f",
          400: "#c3ee3f",
          500: "#aede1f",
          600: "#8fb818",
          700: "#6d8e15",
          800: "#576f16",
          900: "#485c17",
        },
        // pale lavender tint used for the secondary/enterprise-style card
        lavender: {
          50: "#f7f6fe",
          100: "#ede9fb",
          200: "#dcd4f7",
          300: "#c1b2f0",
          400: "#a488e6",
          500: "#8a67da",
          600: "#7550c4",
        },
        ink: {
          50: "#f7f8f7",
          100: "#e9ebe8",
          200: "#d3d6d1",
          300: "#b6bbb4",
          400: "#767d76",
          500: "#5d645d",
          600: "#464d46",
          700: "#2e332e",
          800: "#1c211c",
          900: "#0c0f0c",
        },
        paper: "#ffffff",
      },
      fontFamily: {
        // Wired to the next/font CSS variables declared in src/app/layout.tsx,
        // with a system stack behind each so text never renders unstyled.
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(12,15,12,0.04), 0 8px 24px rgba(12,15,12,0.06)",
        pop: "0 2px 0 rgba(12,15,12,0.9)",
      },
      borderRadius: {
        xl2: "1.5rem",
      },
    },
  },
  plugins: [],
};
