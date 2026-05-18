import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Universal Vite config. Copied verbatim into every per-niche template.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2020',
  },
});
