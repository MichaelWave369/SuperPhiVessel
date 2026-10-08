import { defineConfig } from 'vite';

export default defineConfig({
  base: '/SuperPhiVessel/vessie/',
  build: {
    outDir: '../../site/vessie',
    emptyOutDir: true,
    sourcemap: false,
  },
});
