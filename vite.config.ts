import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  // Production builds are served from https://<user>.github.io/farewell-team-wrapped/
  // so all asset URLs need that prefix. Dev stays at root for normal localhost:5173 use.
  base: command === 'build' ? '/farewell-team-wrapped/' : '/',
  plugins: [react()],
}));
