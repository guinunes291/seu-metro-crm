import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";


const plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime()];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // Reduzir consumo de memória durante o build
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      maxParallelFileOps: 2,
      output: {
        // Dividir em chunks menores para reduzir pico de memória
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom')) return 'react-dom';
            if (id.includes('/react/')) return 'react-vendor';
            if (id.includes('@radix-ui')) return 'radix-vendor';
            if (id.includes('recharts') || id.includes('d3-')) return 'chart-vendor';
            if (id.includes('@tanstack') || id.includes('@trpc')) return 'data-vendor';
            if (id.includes('lucide-react')) return 'icons-vendor';
            return 'vendor';
          }
        },
      },
    },
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
