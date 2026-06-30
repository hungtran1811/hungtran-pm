import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function isEditorDep(id) {
  return (
    id.includes('@uiw/react-codemirror')
    || id.includes('@codemirror/')
    || id.includes('@lezer/')
    || id.includes('codemirror')
  );
}

function isVendorDep(id) {
  return (
    id.includes('/react/')
    || id.includes('react-dom')
    || id.includes('react-router')
    || id.includes('react-jsx-runtime')
    || id.includes('scheduler')
  );
}

function isFirebaseAuthDep(id) {
  return id.includes('@firebase/auth') || id.includes('/firebase/auth');
}

function isFirebaseFirestoreDep(id) {
  return (
    id.includes('@firebase/firestore')
    || id.includes('/firebase/firestore')
    || id.includes('@firebase/webchannel-wrapper')
  );
}

function isFirebaseDep(id) {
  return id.includes('@firebase/') || id.includes('/firebase/');
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ['react', 'react-dom', 'react-router-dom'],
  },
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (isFirebaseFirestoreDep(id)) return 'firebase-firestore';
          if (isFirebaseAuthDep(id)) return 'firebase-auth';
          if (isFirebaseDep(id)) return 'firebase-core';
          if (id.includes('recharts')) return 'charts';
          if (isEditorDep(id)) return 'editor';
          if (isVendorDep(id)) return 'vendor';
          return undefined;
        },
      },
    },
  },
});
