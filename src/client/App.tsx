/**
 * Brilliant Event — Барный кейтеринг и финансы
 * Root Application Component (`src/client/App.tsx`)
 */

import React, { useState } from 'react';
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
  const { isAuthenticated, enterDemoMode, isSuperAdmin } = useAuth();
  const [showAuthScreen, setShowAuthScreen] = useState<boolean>(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');
  const getInitialTab = (): TabType => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace(/^#\/?/, '').split('?')[0] as TabType;
      const validTabs: TabType[] = ['accounts', 'events', 'analytics', 'history', 'reports', 'settings', 'admin'];
      if (validTabs.includes(hash)) return hash;
      const saved = localStorage.getItem('truespace_active_tab') as TabType;
      if (validTabs.includes(saved)) return saved;
    }
    return 'accounts';
  };

  const [currentTab, setCurrentTabState] = useState<TabType>(getInitialTab);

  const setCurrentTab = React.useCallback((tab: TabType) => {
    setCurrentTabState(tab);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('truespace_active_tab', tab);
        window.history.replaceState(null, '', `#${tab}`);
      } catch {}
    }
  }, []);

  React.useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace(/^#\/?/, '').split('?')[0] as TabType;
      const validTabs: TabType[] = ['accounts', 'events', 'analytics', 'history', 'reports', 'settings', 'admin'];
      if (validTabs.includes(hash)) {
        setCurrentTabState(hash);
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

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
          {currentTab === 'admin' && (
            isSuperAdmin ? (
              <SuperAdminView />
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <div style={{ maxWidth: '420px', margin: '0 auto', background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border)', borderRadius: '16px', padding: '32px 24px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px', color: 'var(--foreground)' }}>Доступ ограничен</h3>
                  <p style={{ fontSize: '14px', color: 'var(--muted-foreground)', marginBottom: '20px', lineHeight: 1.5 }}>
                    Панель управления платформой доступна исключительно суперадминистраторам.
                  </p>
                  <button
                    type="button"
                    className="btn-form-submit"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => setCurrentTab('accounts')}
                  >
                    Вернуться к счетам
                  </button>
                </div>
              </div>
            )
          )}
        </ErrorBoundary>
      </main>

      {/* Quick Entry Modal & Toasts */}
      <QuickEntryModal isOpen={isOpen} onClose={handleCloseEntry} initialAccountId={selectedAccountId} />
      <Toast />
    </div>
  );
};

export default App;
