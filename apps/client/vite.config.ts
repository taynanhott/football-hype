import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { developmentGameProxy } from './dev/game-proxy';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxy =
    command === 'serve' && env.VITE_USE_DEV_GAME_PROXY === 'true'
      ? developmentGameProxy(env.DEV_GAME_SERVER_TARGET, env.DEV_GAME_SERVER_ORIGIN)
      : undefined;
  return {
    ...(proxy ? { server: { host: 'localhost', port: 5173, strictPort: true, proxy } } : {}),
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
  };
});
