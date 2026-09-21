/**
 * Truespace — Барный кейтеринг и финансы
 * Root Application Component (`src/client/App.tsx`)
 */

import React, { useState } from 'react';
import { Plus, Wallet, BarChart3, History } from 'lucide-react';
import { Header } from './components/common/Header.js';
import { TotalCapitalBanner } from './components/accounts/TotalCapitalBanner.js';
import { AccountsGrid } from './components/accounts/AccountsGrid.js';
import { AnalyticsDashboard } from './components/analytics/AnalyticsDashboard.js';
import { TransactionHistory } from './components/history/TransactionHistory.js';
import { QuickEntryModal } from './components/entry/QuickEntryModal.js';
import { Toast } from './components/common/Toast.js';

type TabType = 'accounts' | 'analytics' | 'history';

const TABS = [
  { id: 'accounts' as TabType, label: 'Счета и ввод', icon: Wallet },
  { id: 'analytics' as TabType, label: 'Маржинальность', icon: BarChart3 },
  { id: 'history' as TabType, label: 'Журнал операций', icon: History },
];

export const App: React.FC = () => {
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

  return (
    <div className="min-h-screen" style={{ paddingBottom: '90px' }}>
      <Header onOpenQuickEntry={() => handleOpenEntry()} />

      {/* Main Navigation Tabs */}
      <nav className="app-container" style={{ paddingBottom: 0, paddingTop: '12px' }} aria-label="Разделы системы">
        <div style={{ display: 'flex', gap: '8px', backgroundColor: 'rgba(23, 32, 25, 0.05)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = currentTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setCurrentTab(id)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', fontWeight: 600,
                  backgroundColor: active ? '#fff' : 'transparent', color: active ? 'var(--color-text)' : 'var(--color-text-muted)',
                  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s ease',
                }}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Tab Content */}
      <main className="app-container">
        {currentTab === 'accounts' && (
          <>
            <TotalCapitalBanner />
            <AccountsGrid onOpenEntryWithAccount={(accId) => handleOpenEntry(accId)} />
          </>
        )}
        {currentTab === 'analytics' && <AnalyticsDashboard />}
        {currentTab === 'history' && <TransactionHistory />}
      </main>

      {/* Floating Action Button */}
      <button
        type="button"
        onClick={() => handleOpenEntry()}
        className="fab-quick-entry"
        title="Внести финансовую операцию"
        aria-label="Внести операцию"
      >
        <Plus size={20} aria-hidden="true" />
        <span>Внести операцию (+)</span>
      </button>

      {/* Quick Entry Modal & Toasts */}
      <QuickEntryModal isOpen={isOpen} onClose={handleCloseEntry} initialAccountId={selectedAccountId} />
      <Toast />
    </div>
  );
};

export default App;
