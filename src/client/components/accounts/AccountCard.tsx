/**
 * Truespace — Барный кейтеринг и финансы
 * Account Card Component (`src/client/components/accounts/AccountCard.tsx`)
 *
 * Displays individual liquidity node metrics:
 * - Current balance in Russian Rubles
 * - Type badge and descriptive icon
 * - Liquidity percentage of overall business capital
 * - Last update timestamp and quick entry trigger
 */

import React from 'react';
import {
  Banknote,
  Coins,
  Landmark,
  CreditCard,
  Smartphone,
  Plus,
} from 'lucide-react';
import { Account } from '../../../shared/types.js';
import { formatRubles, formatPercent, formatDateTimeRu } from '../../utils/formatters.js';
import { Badge, getAccountTypeLabel } from '../common/Badge.js';

interface AccountCardProps {
  account: Account;
  totalBalance: number;
  onOpenEntryWithAccount?: (accountId: string) => void;
}

export const AccountCard: React.FC<AccountCardProps> = ({
  account,
  totalBalance,
  onOpenEntryWithAccount,
}) => {
  // Select contextual Lucide icon
  let IconComponent = Banknote;
  if (account.id === 'cash_1') IconComponent = Banknote;
  else if (account.id === 'cash_2') IconComponent = Coins;
  else if (account.id === 'bank_1') IconComponent = Landmark;
  else if (account.id === 'bank_2') IconComponent = CreditCard;
  else if (account.id === 'card_sbp') IconComponent = Smartphone;

  // Calculate percentage of total liquidity
  const liquidityShare = totalBalance > 0 ? (account.currentBalance / totalBalance) * 100 : 0;
  const clampedShare = Math.max(0, Math.min(100, liquidityShare));

  return (
    <article className="account-card" aria-label={`Счёт ${account.name}`}>
      {/* Top row: Icon + Type Badge */}
      <div className="card-top-row">
        <div className={`card-icon-wrapper icon-type-${account.type}`} aria-hidden="true">
          <IconComponent size={20} />
        </div>

        <Badge variant={account.type} size="sm">
          {getAccountTypeLabel(account.type)}
        </Badge>
      </div>

      {/* Account Title */}
      <h3 className="account-name" title={account.name}>
        {account.name}
      </h3>

      {/* Live Balance */}
      <div className="account-balance">
        {formatRubles(account.currentBalance)}
      </div>

      {/* Account purpose description */}
      <p className="account-description">
        {account.description}
      </p>

      {/* Liquidity progress bar & percentage */}
      <div className="account-liquidity-section">
        <div className="liquidity-label-row">
          <span className="liquidity-caption">Доля в капитале:</span>
          <span className="liquidity-value">{formatPercent(clampedShare, 1)}</span>
        </div>
        <div className="account-mini-bar" role="progressbar" aria-valuenow={Math.round(clampedShare)} aria-valuemin={0} aria-valuemax={100}>
          <div
            className={`mini-bar-fill fill-${account.type}`}
            style={{ width: `${clampedShare}%` }}
          />
        </div>
      </div>

      {/* Footer metadata & quick action */}
      <div className="account-card-footer">
        <span className="account-updated-at" title="Время последнего изменения остатка">
          {account.updatedAt ? formatDateTimeRu(account.updatedAt) : 'Активен'}
        </span>

        {onOpenEntryWithAccount && (
          <button
            type="button"
            onClick={() => onOpenEntryWithAccount(account.id)}
            className="btn-card-quick-add"
            title={`Внести операцию по счёту ${account.name}`}
          >
            <Plus size={14} aria-hidden="true" />
            <span>Внести</span>
          </button>
        )}
      </div>
    </article>
  );
};
