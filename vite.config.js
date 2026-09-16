import { request as httpRequest } from 'node:http';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';

const FUNCTIONS_PORT = Number(process.env.FUNCTIONS_PORT || 8888);

/** Proxy /.netlify/functions → :8888, không bật overlay Vite khi functions tắt. */
function proxyNetlifyFunctions() {
  let lastDownLog = 0;
  return {
    name: 'proxy-netlify-functions',
    configureServer(server) {
      httpRequest(
        { hostname: '127.0.0.1', port: FUNCTIONS_PORT, path: '/', method: 'GET', timeout: 800 },
        (res) => res.resume(),
      )
        .on('error', () => {
          server.config.logger.warn(
            `Drive functions chưa chạy trên :${FUNCTIONS_PORT}. Terminal khác: npm run dev:functions`,
          );
        })
        .end();

      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/.netlify/functions')) {
          next();
          return;
        }

        const headers = { ...req.headers, host: `127.0.0.1:${FUNCTIONS_PORT}` };
        delete headers.connection;

        const proxyReq = httpRequest(
          {
            hostname: '127.0.0.1',
            port: FUNCTIONS_PORT,
            path: req.url,
            method: req.method,
            headers,
          },
          (proxyRes) => {
            const outHeaders = { ...proxyRes.headers };
            delete outHeaders.connection;
            delete outHeaders['keep-alive'];
            delete outHeaders['transfer-encoding'];
            res.writeHead(proxyRes.statusCode || 502, outHeaders);
            proxyRes.pipe(res);
          },
        );

        proxyReq.on('error', (err) => {
          const down = err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT';
          if (down) {
            const now = Date.now();
            if (now - lastDownLog > 10_000) {
              lastDownLog = now;
              server.config.logger.warn(
                `Drive functions chưa chạy trên :${FUNCTIONS_PORT}. Terminal khác: npm run dev:functions`,
              );
            }
          }
          if (!res.headersSent) {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(
              JSON.stringify({
                error:
                  'Không kết nối được máy chủ nộp bài. Chạy npm run dev:functions rồi tải lại trang.',
              }),
            );
          }
        });

        req.pipe(proxyReq);
      });
    },
  };
}

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

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    proxyNetlifyFunctions(),
    mode === 'analyze'
      && visualizer({
        filename: 'dist/bundle-stats.html',
        gzipSize: true,
        open: false,
      }),
  ].filter(Boolean),
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
          if (isEditorDep(id)) return 'editor';
          if (isVendorDep(id)) return 'vendor';
          return undefined;
        },
      },
    },
  },
}));
