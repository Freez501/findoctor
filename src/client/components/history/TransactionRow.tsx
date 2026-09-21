/**
 * Truespace — Барный кейтеринг и финансы
 * Transaction Row Component (`src/client/components/history/TransactionRow.tsx`)
 */

import React, { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Trash2, Calendar } from 'lucide-react';
import { Transaction } from '../../../shared/types.js';
import { formatRubles, formatDateTimeRu } from '../../utils/formatters.js';
import { useFinance } from '../../context/FinanceContext.js';

interface Props {
  transaction: Transaction;
}

export const TransactionRow: React.FC<Props> = ({ transaction }) => {
  const { accounts, categories, events, deleteTransaction } = useFinance();
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const accMap = new Map(accounts.map((a) => [a.id, a.name]));
  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const eventMap = new Map(events.map((e) => [e.id, e.title]));

  const categoryName = catMap.get(transaction.categoryId) || 'Операция';
  const eventTitle = transaction.eventId ? eventMap.get(transaction.eventId) || 'Мероприятие' : 'Общие расходы';

  const handleDelete = async () => {
    setIsDeleting(true);
    await deleteTransaction(transaction.id);
    setIsDeleting(false);
    setIsConfirming(false);
  };

  const isIncome = transaction.type === 'income';
  const isExpense = transaction.type === 'expense';
  const amountColor = isIncome ? '#059669' : isExpense ? '#dc2626' : '#2563eb';
  const sign = isIncome ? '+' : isExpense ? '−' : '';

  const accountLabel = transaction.type === 'transfer'
    ? `${accMap.get(transaction.fromAccountId || '') || '—'} → ${accMap.get(transaction.toAccountId || '') || '—'}`
    : isExpense ? `Счёт: ${accMap.get(transaction.fromAccountId || '') || '—'}` : `Счёт: ${accMap.get(transaction.toAccountId || '') || '—'}`;

  return (
    <div className="glass-panel" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', backgroundColor: '#fff' }}>
      {/* Left Icon & Meta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
        <div
          style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-sm)', backgroundColor: `${amountColor}15`, color: amountColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          {isIncome ? <ArrowDownLeft size={18} /> : isExpense ? <ArrowUpRight size={18} /> : <ArrowLeftRight size={18} />}
        </div>

        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{categoryName}</span>
            <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(23,32,25,0.06)', color: 'var(--color-text-muted)' }}>
              {eventTitle}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
            <span>{accountLabel}</span>
            <span>•</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Calendar size={12} />
              {formatDateTimeRu(transaction.transactionDate)}
            </span>
          </div>

          {transaction.description && (
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              «{transaction.description}»
            </span>
          )}
        </div>
      </div>

      {/* Right Amount & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <span style={{ fontSize: '1.05rem', fontWeight: 700, color: amountColor }}>
          {sign}{formatRubles(transaction.amount)}
        </span>

        {isConfirming ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button type="button" onClick={handleDelete} disabled={isDeleting} className="btn-confirm-yes" style={{ fontSize: '0.7rem', padding: '4px 6px' }}>
              {isDeleting ? '...' : 'Да'}
            </button>
            <button type="button" onClick={() => setIsConfirming(false)} className="btn-confirm-no" style={{ fontSize: '0.7rem', padding: '4px 6px' }}>
              Нет
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsConfirming(true)}
            title="Отменить и удалить операцию"
            style={{ color: 'var(--color-text-muted)', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default TransactionRow;
