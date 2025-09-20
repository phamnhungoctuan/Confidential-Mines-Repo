import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    global: "globalThis", // ⚡ FIX cho @fhevm/sdk
  },
  resolve: {
    alias: {
      // nếu cần polyfill Buffer (nếu SDK yêu cầu)
      buffer: "buffer",
    },
  },
});
