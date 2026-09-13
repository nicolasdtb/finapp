import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true, // Escuta em 0.0.0.0 para conexao via ZeroTier
  },
});
