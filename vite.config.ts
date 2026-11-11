import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { posApiPlugin } from './server/posApi';

export default defineConfig({
  plugins: [react(), posApiPlugin()],
  server: { port: 5173, host: true },
  preview: { port: 5173, host: true },
});
