/**
 * Truespace — Барный кейтеринг и финансы
 * Accounts Grid Component (`src/client/components/accounts/AccountsGrid.tsx`)
 *
 * Renders the responsive grid of 5 catering accounts with loading states.
 */

import React from 'react';
import { WalletCards, RefreshCw } from 'lucide-react';
import { useAccounts } from '../../hooks/useAccounts.js';
import { AccountCard } from './AccountCard.js';

interface AccountsGridProps {
  onOpenEntryWithAccount?: (accountId: string) => void;
}

export const AccountsGrid: React.FC<AccountsGridProps> = ({ onOpenEntryWithAccount }) => {
  const { accounts, totalBalance, isLoading, refetch } = useAccounts();

  return (
    <section className="accounts-section" aria-label="Счета кейтеринга">
      {/* Section Header */}
      <div className="section-header-row">
        <div className="section-title-group">
          <div className="section-icon" aria-hidden="true">
            <WalletCards size={18} />
          </div>
          <div>
            <h2 className="section-heading">Счета кейтеринга (5 счетов)</h2>
            <p className="section-subtext">
              Раздельный учёт кассы на площадке, сейфа, расчетных счетов и СБП
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          disabled={isLoading}
          className="btn-refresh-accounts"
          title="Обновить остатки по счетам"
          aria-label="Обновить остатки"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} aria-hidden="true" />
          <span className="btn-text">Обновить</span>
        </button>
      </div>

      {/* Grid of 5 Accounts */}
      <div className="accounts-grid">
        {isLoading && accounts.length === 0 ? (
          // Skeleton loading placeholders
          Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="account-card-skeleton animate-pulse" />
          ))
        ) : (
          accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              totalBalance={totalBalance}
              onOpenEntryWithAccount={onOpenEntryWithAccount}
            />
          ))
        )}
      </div>
    </section>
  );
};
