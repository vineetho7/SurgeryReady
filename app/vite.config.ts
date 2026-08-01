import react from '@vitejs/plugin-react';
import dns from 'dns';
import { copyFileSync, existsSync } from 'fs';
import path from 'path';
import { defineConfig } from 'vite';

dns.setDefaultResultOrder('verbatim');

if (!existsSync(path.join(__dirname, '.env'))) {
  copyFileSync(path.join(__dirname, '.env.defaults'), path.join(__dirname, '.env'));
}

dns.setDefaultResultOrder('verbatim');

// https://vitejs.dev/config/
export default defineConfig({
  // VITE_ is ours: without it, VITE_AGENT_URL in VoicePanel resolves to undefined and
  // the override silently falls back to localhost.
  envPrefix: ['MEDPLUM_', 'GOOGLE_', 'RECAPTCHA_', 'VITE_'],
  plugins: [react()],
  server: {
    host: 'localhost',
    port: 3000,
  },
  test: {
    globals: true,
  },
});
