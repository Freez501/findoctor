/**
 * Brilliant Event — Барный кейтеринг и финансы
 * Root Application Component (`src/client/App.tsx`)
 */

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Header, TabType } from './components/common/Header.js';
import { TotalCapitalBanner } from './components/accounts/TotalCapitalBanner.js';
import { AccountsGrid } from './components/accounts/AccountsGrid.js';
import { AnalyticsDashboard } from './components/analytics/AnalyticsDashboard.js';
import { EventsView } from './components/events/EventsView.js';
import { TransactionHistory } from './components/history/TransactionHistory.js';
import { ReportsView } from './components/reports/ReportsView.js';
import { SettingsView } from './components/settings/SettingsView.js';
import { SuperAdminView } from './components/admin/SuperAdminView.js';
import { QuickEntryModal } from './components/entry/QuickEntryModal.js';
import { Toast } from './components/common/Toast.js';
import { AuthView } from './components/auth/AuthView.js';
import { ProductLanding } from './components/landing/ProductLanding.js';
import { OnboardingChecklist } from './components/onboarding/OnboardingChecklist.js';
import { ErrorBoundary } from './components/common/ErrorBoundary.js';
import { InviteAcceptView } from './components/auth/InviteAcceptView.js';
import { useAuth } from './context/AuthContext.js';

export const App: React.FC = () => {
  const { isAuthenticated, enterDemoMode } = useAuth();
  const [showAuthScreen, setShowAuthScreen] = useState<boolean>(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');
  const [currentTab, setCurrentTab] = useState<TabType>('accounts');
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(undefined);

  // Invite Token from URL param (?invite=token or #invite=token)
  const [inviteToken, setInviteToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const queryInvite = params.get('invite');
    if (queryInvite) return queryInvite;
    if (window.location.hash.startsWith('#invite=')) {
      return window.location.hash.replace('#invite=', '').trim();
    }
    return null;
  });

  const clearInviteUrl = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('invite');
      if (url.hash.startsWith('#invite=')) url.hash = '';
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + (url.hash ? url.hash : ''));
    } catch {}
    setInviteToken(null);
  };

  const handleOpenEntry = (accountId?: string) => {
    setSelectedAccountId(accountId);
    setIsOpen(true);
  };

  const handleCloseEntry = () => {
    setIsOpen(false);
    setSelectedAccountId(undefined);
  };

  // If user navigated via invite link, show Invite Acceptance gate
  if (inviteToken) {
    return (
      <>
        <InviteAcceptView
          token={inviteToken}
          onSuccess={() => {
            clearInviteUrl();
          }}
          onCancel={() => {
            clearInviteUrl();
          }}
        />
        <Toast />
      </>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        {showAuthScreen ? (
          <AuthView
            initialMode={authInitialMode}
            onBackToLanding={() => setShowAuthScreen(false)}
          />
        ) : (
          <ProductLanding
            onTryDemo={() => enterDemoMode()}
            onOpenAuth={(mode = 'login') => {
              setAuthInitialMode(mode);
              setShowAuthScreen(true);
            }}
          />
        )}
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
        <OnboardingChecklist
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          onOpenQuickEntry={() => handleOpenEntry()}
        />
        <ErrorBoundary key={currentTab}>
          {currentTab === 'accounts' && (
            <>
              <TotalCapitalBanner />
              <AccountsGrid onOpenEntryWithAccount={(accId) => handleOpenEntry(accId)} />
            </>
          )}
          {currentTab === 'events' && <EventsView />}
          {currentTab === 'analytics' && <AnalyticsDashboard />}
          {currentTab === 'history' && <TransactionHistory />}
          {currentTab === 'reports' && <ReportsView />}
          {currentTab === 'settings' && <SettingsView />}
          {currentTab === 'admin' && <SuperAdminView />}
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
