import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Builds src/embed.jsx into a single, dependency-bundled dist/embed.js
// that any webpage can load with a plain <script> tag.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: "src/embed.jsx",
      name: "AIWidgetEmbed",
      formats: ["iife"],
      fileName: () => "embed.js",
    },
    rollupOptions: {
      output: {
        // Bundle React in so the host page needs zero setup.
        inlineDynamicImports: true,
      },
    },
  },
});
