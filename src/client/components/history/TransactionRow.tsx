/**
 * Truespace — Барный кейтеринг и финансы
 * Transaction Row Component (`src/client/components/history/TransactionRow.tsx`)
 */

import React, { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Trash2 } from 'lucide-react';
import { Transaction } from '../../../shared/types.js';
import { formatRubles, formatDateTimeRu } from '../../utils/formatters.js';
import { useFinance } from '../../context/FinanceContext.js';
import { useAuth } from '../../context/AuthContext.js';

interface Props {
  transaction: Transaction;
  onClick?: (transaction: Transaction) => void;
  isSelected?: boolean;
  onToggleSelect?: (transaction: Transaction) => void;
}

export const TransactionRow: React.FC<Props> = ({ transaction, onClick, isSelected, onToggleSelect }) => {
  const { accounts, categories, events, deleteTransaction } = useFinance();
  const { userRole, isSuperAdmin } = useAuth();
  const canDelete = isSuperAdmin || userRole === 'owner' || userRole === 'admin';
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const accMap = new Map(accounts.map((a) => [a.id, a.name]));
  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const eventMap = new Map(events.map((e) => [e.id, e.title]));

  const categoryName = catMap.get(transaction.categoryId) || (transaction.categoryId === 'uncategorized' ? 'Без статьи' : 'Операция');
  const eventTitle = transaction.eventId ? eventMap.get(transaction.eventId) || 'Мероприятие' : 'Общие расходы';
  const needsReview = Boolean(transaction.needsReview || transaction.categoryId === 'uncategorized');

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);
    await deleteTransaction(transaction.id);
    setIsDeleting(false);
    setIsConfirming(false);
  };

  const isIncome = transaction.type === 'income';
  const isExpense = transaction.type === 'expense';
  const amountColor = isIncome ? 'var(--color-success)' : isExpense ? 'var(--color-destructive)' : 'var(--color-accent)';
  const iconBgColor = isIncome ? 'rgba(5, 150, 105, 0.08)' : isExpense ? 'rgba(220, 38, 38, 0.08)' : 'rgba(37, 99, 235, 0.08)';
  const sign = isIncome ? '+' : isExpense ? '−' : '';

  const accountLabel = transaction.type === 'transfer'
    ? `${accMap.get(transaction.fromAccountId || '') || '—'} → ${accMap.get(transaction.toAccountId || '') || '—'}`
    : isExpense ? `Счёт: ${accMap.get(transaction.fromAccountId || '') || '—'}` : `Счёт: ${accMap.get(transaction.toAccountId || '') || '—'}`;

  return (
    <div
      className={`compact-tx-row ${needsReview ? 'compact-tx-needs-review' : ''}`}
      onClick={() => onClick?.(transaction)}
      style={{
        cursor: 'pointer',
        backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.08)' : undefined,
        borderColor: isSelected ? 'rgba(59, 130, 246, 0.4)' : undefined,
      }}
      title="Нажмите, чтобы отредактировать статью, мероприятие или сумму"
    >
      {/* Left Icon & Meta */}
      <div className="compact-tx-left">
        {onToggleSelect && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(transaction);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              paddingRight: '6px',
              cursor: 'pointer',
            }}
            title={isSelected ? 'Снять выбор' : 'Выбрать для массовых действий'}
          >
            <input
              type="checkbox"
              checked={Boolean(isSelected)}
              onChange={() => {}}
              style={{
                width: '16px',
                height: '16px',
                cursor: 'pointer',
                accentColor: 'var(--color-accent)',
              }}
            />
          </div>
        )}
        <div
          className="compact-tx-icon"
          style={{ backgroundColor: iconBgColor, color: amountColor }}
        >
          {isIncome ? <ArrowDownLeft size={16} /> : isExpense ? <ArrowUpRight size={16} /> : <ArrowLeftRight size={16} />}
        </div>

        <div className="compact-tx-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span className="compact-tx-category">{categoryName}</span>
            {needsReview && (
              <span className="compact-tx-review-badge">
                ⚠️ Не разобрано
              </span>
            )}
            {transaction.eventId && (
              <span className="compact-tx-event-tag">
                {eventTitle}
              </span>
            )}
          </div>
          <span className="compact-tx-account-tag">{accountLabel}</span>
          {transaction.description && (
            <span className="compact-tx-memo" title={transaction.description}>
              «{transaction.description}»
            </span>
          )}
          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
            {formatDateTimeRu(transaction.transactionDate)}
          </span>
          {transaction.createdBy && (
            <span
              style={{
                fontSize: '0.675rem',
                padding: '1px 6px',
                borderRadius: '4px',
                background: 'rgba(100, 116, 139, 0.1)',
                color: 'var(--color-mid-gray)',
                whiteSpace: 'nowrap',
              }}
              title={`Запись внёс сотрудник: ${typeof transaction.createdBy === 'object' ? transaction.createdBy.name : transaction.createdBy}`}
            >
              👤 {typeof transaction.createdBy === 'object' ? transaction.createdBy.name : transaction.createdBy}
            </span>
          )}
        </div>
      </div>

      {/* Right Amount & Actions */}
      <div className="compact-tx-right" onClick={(e) => e.stopPropagation()}>
        <span className="compact-tx-amount" style={{ color: amountColor }}>
          {sign}{formatRubles(transaction.amount)}
        </span>

        {canDelete && (
          isConfirming ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <button type="button" onClick={handleDelete} disabled={isDeleting} className="btn-confirm-yes" style={{ fontSize: '0.7rem', padding: '6px 8px', minHeight: '36px' }}>
                {isDeleting ? '...' : 'Да'}
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); setIsConfirming(false); }} className="btn-confirm-no" style={{ fontSize: '0.7rem', padding: '6px 8px', minHeight: '36px' }}>
                Нет
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsConfirming(true);
              }}
              title="Удалить операцию"
              className="btn-touch-target"
              style={{
                color: 'var(--color-text-muted)',
                minWidth: '44px',
                minHeight: '44px',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Trash2 size={16} />
            </button>
          )
        )}
      </div>
    </div>
  );
};

export default TransactionRow;
