import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  base: "./",
  build: {
    outDir: "../../dist/viewer",
    emptyOutDir: true,
    target: "esnext",
  },
  resolve: {
    alias: {
      three: "super-three",
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
