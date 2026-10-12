/**
 * Brilliant Event — Барный кейтеринг и финансы
 * Root Application Component (`src/client/App.tsx`)
 */

import React, { useState, Suspense, lazy } from 'react';
import { Plus } from 'lucide-react';
import { Header, TabType } from './components/common/Header.js';
import { TotalCapitalBanner } from './components/accounts/TotalCapitalBanner.js';
import { AccountsGrid } from './components/accounts/AccountsGrid.js';
import { AnalyticsDashboard } from './components/analytics/AnalyticsDashboard.js';
import { QuickEntryModal } from './components/entry/QuickEntryModal.js';
import { Toast } from './components/common/Toast.js';
import { AuthView } from './components/auth/AuthView.js';
import { ErrorBoundary } from './components/common/ErrorBoundary.js';
import { useAuth } from './context/AuthContext.js';

const EventsView = lazy(() =>
  import('./components/events/EventsView.js').then((m) => ({ default: m.EventsView }))
);
const TransactionHistory = lazy(() =>
  import('./components/history/TransactionHistory.js').then((m) => ({ default: m.TransactionHistory }))
);
const SettingsView = lazy(() =>
  import('./components/settings/SettingsView.js').then((m) => ({ default: m.SettingsView }))
);
const SuperAdminView = lazy(() =>
  import('./components/admin/SuperAdminView.js').then((m) => ({ default: m.SuperAdminView }))
);

export const App: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [currentTab, setCurrentTab] = useState<TabType>('accounts');
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(undefined);

  const handleOpenEntry = (accountId?: string) => {
    setSelectedAccountId(accountId);
    setIsOpen(true);
  };

  const handleCloseEntry = () => {
    setIsOpen(false);
    setSelectedAccountId(undefined);
  };

  if (!isAuthenticated) {
    return (
      <>
        <AuthView />
        <Toast />
      </>
    );
  }

  return (
    <div className="min-h-screen" style={{ paddingBottom: '90px' }}>
      <Header
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenQuickEntry={() => handleOpenEntry()}
        onNavigateToAdmin={() => setCurrentTab('admin')}
      />

      {/* Main Tab Content */}
      <main className="app-container app-main-content">
        <ErrorBoundary>
          <Suspense
            fallback={
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
                Загрузка раздела...
              </div>
            }
          >
            {currentTab === 'accounts' && (
              <>
                <TotalCapitalBanner />
                <AccountsGrid onOpenEntryWithAccount={(accId) => handleOpenEntry(accId)} />
              </>
            )}
            {currentTab === 'events' && <EventsView />}
            {currentTab === 'analytics' && <AnalyticsDashboard />}
            {currentTab === 'history' && <TransactionHistory />}
            {currentTab === 'settings' && <SettingsView />}
            {currentTab === 'admin' && <SuperAdminView />}
          </Suspense>
        </ErrorBoundary>
      </main>

      {/* Floating Action Button (Mobile) */}
      <button
        type="button"
        onClick={() => handleOpenEntry()}
        className="fab-quick-entry"
        title="Внести финансовую операцию"
        aria-label="Внести операцию"
      >
        <Plus size={20} aria-hidden="true" />
        <span>Внести операцию</span>
      </button>

      {/* Quick Entry Modal & Toasts */}
      <QuickEntryModal isOpen={isOpen} onClose={handleCloseEntry} initialAccountId={selectedAccountId} />
      <Toast />
    </div>
  );
};

export default App;
