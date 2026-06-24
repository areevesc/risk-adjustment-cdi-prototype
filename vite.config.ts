import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.GITHUB_PAGES === "true" ? "/risk-adjustment-cdi-prototype/" : "/",
  plugins: [react()],
  test: {
    environment: "node",
    globals: true
  }
});
