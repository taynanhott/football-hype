import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/'))
            return id.includes('/examples/')
              ? 'three-addons'
              : id.includes('three.core')
                ? 'three-core'
                : 'three-webgl';
          if (id.includes('/@firebase/firestore/')) return 'firebase-firestore';
          if (id.includes('/@firebase/auth/')) return 'firebase-auth';
          if (id.includes('/@firebase/')) return 'firebase-platform';
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/'))
            return 'react';
          if (id.includes('/node_modules/zod/')) return 'validation';
          if (id.includes('/motion') || id.includes('/framer-motion/')) return 'motion';
          return undefined;
        },
      },
    },
  },
});
