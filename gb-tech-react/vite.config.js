import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `npm run dev` serves the React app on :5173 and forwards /api calls to Flask on :8000,
// so the session cookie works exactly as it does in production.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:8000" },
  },
  build: { outDir: "dist" },
});
