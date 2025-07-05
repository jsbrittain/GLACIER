import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: 'src/renderer', // React app source folder
  plugins: [react()],
  base: './',
  build: {
    outDir: '../../dist/renderer', // Output folder for built frontend
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer')
    }
  }
});
