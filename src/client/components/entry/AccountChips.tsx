/**
 * Truespace — Барный кейтеринг и финансы
 * Account Chips Component (`src/client/components/entry/AccountChips.tsx`)
 *
 * Displays the 5 liquidity accounts as clickable chips with live balances.
 * For transfers, strictly prevents selecting identical source and destination accounts.
 */

import React from 'react';
import { Banknote, Landmark, Smartphone, Coins, CreditCard } from 'lucide-react';
import { useAccounts } from '../../hooks/useAccounts.js';
import { formatRubles } from '../../utils/formatters.js';

interface AccountChipsProps {
  label: string;
  selectedAccountId: string | null | undefined;
  onSelectAccount: (accountId: string) => void;
  disabledAccountId?: string | null;
  helperText?: string;
}

export const AccountChips: React.FC<AccountChipsProps> = ({
  label,
  selectedAccountId,
  onSelectAccount,
  disabledAccountId,
  helperText,
}) => {
  const { accounts } = useAccounts();

  const getAccountIcon = (id: string) => {
    switch (id) {
      case 'cash_1':
        return <Banknote size={14} aria-hidden="true" />;
      case 'cash_2':
        return <Coins size={14} aria-hidden="true" />;
      case 'bank_1':
        return <Landmark size={14} aria-hidden="true" />;
      case 'bank_2':
        return <CreditCard size={14} aria-hidden="true" />;
      case 'card_sbp':
        return <Smartphone size={14} aria-hidden="true" />;
      default:
        return <Banknote size={14} aria-hidden="true" />;
    }
  };

  return (
    <div className="account-chips-block">
      <div className="account-chips-header">
        <span className="account-chips-label">{label}</span>
        {helperText && <span className="account-chips-helper">{helperText}</span>}
      </div>

      <div className="account-chips-list" role="radiogroup" aria-label={label}>
        {accounts.map((acc) => {
          const isSelected = selectedAccountId === acc.id;
          const isDisabled = disabledAccountId === acc.id;

          return (
            <button
              key={acc.id}
              type="button"
              onClick={() => onSelectAccount(acc.id)}
              disabled={isDisabled}
              className={`account-chip ${isSelected ? 'account-chip-selected' : ''} ${
                isDisabled ? 'account-chip-disabled' : ''
              }`}
              title={isDisabled ? 'Нельзя выбрать один и тот же счёт' : `${acc.name}: ${formatRubles(acc.currentBalance)}`}
              role="radio"
              aria-checked={isSelected}
              aria-disabled={isDisabled}
            >
              <span className={`chip-icon icon-type-${acc.type}`}>
                {getAccountIcon(acc.id)}
              </span>

              <span className="chip-content">
                <span className="chip-account-name">{acc.name}</span>
                <span className="chip-account-balance">{formatRubles(acc.currentBalance)}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

