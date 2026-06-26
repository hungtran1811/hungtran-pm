import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { ThemeProvider } from './theme/ThemeProvider.jsx';
import { AuthProvider } from './state/auth.store.jsx';
import { SettingsProvider } from './state/settings.store.jsx';
import { ToastProvider } from './ui/components/Toast.jsx';

import { ErrorBoundary } from './ui/components/ErrorBoundary.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary title="Ứng dụng gặp sự cố">
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <SettingsProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </SettingsProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
