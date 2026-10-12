/**
 * Truespace — Барный кейтеринг и финансы
 * Client Entry Point (`src/client/main.tsx`)
 *
 * Mounts the React application with FinanceProvider and global styles.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import { AuthProvider } from './context/AuthContext.js';
import { FinanceProvider } from './context/FinanceContext.js';
import { ErrorBoundary } from './components/common/ErrorBoundary.js';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <FinanceProvider>
          <App />
        </FinanceProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  } else {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((r) => r.unregister());
    });
  }
}
