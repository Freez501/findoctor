/**
 * Brilliant Event — Барный кейтеринг и финансы
 * Root Application Component (`src/client/App.tsx`)
 */

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Header, TabType } from './components/common/Header.js';
import { TotalCapitalBanner } from './components/accounts/TotalCapitalBanner.js';
import { AccountsGrid } from './components/accounts/AccountsGrid.js';
import { EventsView } from './components/events/EventsView.js';
import { AnalyticsDashboard } from './components/analytics/AnalyticsDashboard.js';
import { TransactionHistory } from './components/history/TransactionHistory.js';
import { SettingsView } from './components/settings/SettingsView.js';
import { SuperAdminView } from './components/admin/SuperAdminView.js';
import { QuickEntryModal } from './components/entry/QuickEntryModal.js';
import { Toast } from './components/common/Toast.js';
import { AuthView } from './components/auth/AuthView.js';
import { useAuth } from './context/AuthContext.js';

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
