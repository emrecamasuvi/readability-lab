import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  esbuild: { jsx: "automatic", jsxImportSource: "preact" },
  server: { fs: { allow: ["../.."] } },
  build: { target: "es2022", outDir: "dist", sourcemap: true },
});
