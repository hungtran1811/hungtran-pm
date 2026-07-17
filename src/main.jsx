import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { ThemeProvider } from './theme/ThemeProvider.jsx';
import { AuthProvider } from './state/auth.store.jsx';
import { SettingsProvider } from './state/settings.store.jsx';
import { ToastProvider } from './ui/components/Toast.jsx';
import { ErrorBoundary } from './ui/components/ErrorBoundary.jsx';
import { initErrorReporting, reportUnhandledRejection } from './lib/errorReporting.js';

function AppBootstrap() {
  useEffect(() => {
    initErrorReporting().catch(() => {});
    window.addEventListener('unhandledrejection', reportUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', reportUnhandledRejection);
  }, []);

  return (
    <BrowserRouter>
      <ErrorBoundary title="Ứng dụng gặp sự cố">
        <App />
      </ErrorBoundary>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <SettingsProvider>
            <AppBootstrap />
          </SettingsProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
);
