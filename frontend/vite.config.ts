import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [
        tailwindcss({
          content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
          theme: {
            extend: {
              colors: {
                background: "#0F172A",
                card: "#1E293B",
                border: "#334155",
                primary: "#3B82F6",
                success: "#10B981",
                danger: "#EF4444",
                warning: "#F59E0B",
              },
            },
          },
        }),
        autoprefixer(),
      ],
    },
  },
  server: {
    port: 3000,
    host: true,
  },
});
