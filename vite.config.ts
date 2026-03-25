import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');

  // Firebase client config: prefer local file (dev), fall back to env var (CI/prod)
  const localConfigPath = path.resolve(__dirname, 'firebase-applet-config.json');
  const firebaseConfigStr = existsSync(localConfigPath)
    ? readFileSync(localConfigPath, 'utf-8').replace(/^\uFEFF/, '')
    : (env.FIREBASE_CONFIG ?? '{}');

  return {
    plugins: [react(), tailwindcss()],
    define: {
      __FIREBASE_CONFIG__: JSON.stringify(firebaseConfigStr),
      ...(env.GEMINI_API_KEY && {
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      }),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  };
});
