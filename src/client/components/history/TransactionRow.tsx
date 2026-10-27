/**
 * Truespace — Барный кейтеринг и финансы
 * Transaction Row Component (`src/client/components/history/TransactionRow.tsx`)
 */

import React, { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ArrowLeftRight, Trash2 } from 'lucide-react';
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
  const { userRole, isSuperAdmin, usersList, currentUser } = useAuth();
  const canDelete = isSuperAdmin || userRole === 'owner' || userRole === 'admin';
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const accMap = new Map(accounts.map((a) => [a.id, a.name]));
  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const eventMap = new Map(events.map((e) => [e.id, e.title]));

  const createdByDisplay = (() => {
    if (!transaction.createdBy) return null;
    const raw = typeof transaction.createdBy === 'object' ? (transaction.createdBy as any).name : String(transaction.createdBy);
    if (currentUser && raw === currentUser.id) return currentUser.fullName || currentUser.email;
    const foundUser = usersList.find((u) => u.id === raw);
    return foundUser ? foundUser.fullName || foundUser.email : raw;
  })();

  const isEventDeleted = Boolean(transaction.eventId && !eventMap.has(transaction.eventId));
  const categoryName = catMap.get(transaction.categoryId) || (transaction.categoryId === 'uncategorized' ? 'Без статьи' : 'Операция');
  const eventTitle = transaction.eventId ? eventMap.get(transaction.eventId) || 'Ивент удалён' : 'Общие расходы';
  const needsReview = Boolean(transaction.needsReview || transaction.categoryId === 'uncategorized' || isEventDeleted);

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

  // Юрлицо: явно указанное в операции или унаследованное от счёта
  const linkedAccount = accounts.find((a) => a.id === (isExpense ? transaction.fromAccountId : transaction.toAccountId));
  const legalEntityLabel = transaction.type !== 'transfer'
    ? transaction.legalEntityName || linkedAccount?.legalEntityName || ''
    : '';

  // Отчётный налоговый период (квартал), в который попадает операция
  const txDateObj = new Date(transaction.transactionDate);
  const quarterLabel = Number.isNaN(txDateObj.getTime())
    ? ''
    : `${['I', 'II', 'III', 'IV'][Math.floor(txDateObj.getMonth() / 3)]} кв. ${txDateObj.getFullYear()}`;

  const vatRateValue = transaction.vatRate ?? 20;
  const vatAmountValue = transaction.vatAmount ?? (vatRateValue > 0 ? Math.round((transaction.amount * vatRateValue) / (100 + vatRateValue)) : 0);
  const vatBadgeLabel = isExpense && transaction.hasVat
    ? vatRateValue > 0
      ? `НДС ${vatRateValue}% (${formatRubles(vatAmountValue)})`
      : 'Без НДС'
    : '';

  return (
    <div
      className={`compact-tx-row ${needsReview ? 'compact-tx-needs-review' : ''}`}
      onClick={() => onClick?.(transaction)}
      style={{
        cursor: 'pointer',
        backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.08)' : isEventDeleted ? 'rgba(245, 158, 11, 0.04)' : undefined,
        borderColor: isSelected ? 'rgba(59, 130, 246, 0.4)' : isEventDeleted ? 'rgba(245, 158, 11, 0.4)' : undefined,
        borderLeft: isEventDeleted ? '4px solid #f59e0b' : undefined,
      }}
      title={isEventDeleted ? '⚠️ Связанное мероприятие удалено! Нажмите, чтобы переназначить статью' : 'Нажмите, чтобы отредактировать операцию'}
    >
      {/* 1. Чекбокс */}
      <div className="compact-tx-col-check">
        {onToggleSelect && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(transaction);
            }}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            title={isSelected ? 'Снять выбор' : 'Выбрать'}
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
      </div>

      {/* 2. Иконка-стрелка */}
      <div className="compact-tx-col-icon">
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: iconBgColor,
            color: amountColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isIncome ? <ArrowUpRight size={14} /> : isExpense ? <ArrowDownRight size={14} /> : <ArrowLeftRight size={14} />}
        </div>
      </div>

      {/* 3. Дата и период */}
      <div className="compact-tx-col-date">
        <span className="date-main">
          {formatDateTimeRu(transaction.transactionDate).slice(0, 10)}
        </span>
        <span className="date-sub">
          {formatDateTimeRu(transaction.transactionDate).slice(12) || quarterLabel}
        </span>
      </div>

      {/* 4. Операция / Описание и Автор */}
      <div className="compact-tx-col-main">
        <span className="tx-title-text" title={transaction.description || categoryName}>
          {transaction.description ? `«${transaction.description}»` : categoryName}
        </span>
        <span className="tx-author-text">
          {createdByDisplay ? `👤 ${createdByDisplay}` : '—'}
          {needsReview && (
            <span style={{ color: '#d97706', fontWeight: 700, marginLeft: '4px' }}>
              ⚠️ Не разобрано
            </span>
          )}
        </span>
      </div>

      {/* 5. Статья ДДС */}
      <div className="compact-tx-col-cat">
        <span className={`compact-tx-category-pill ${isIncome ? 'type-income' : isExpense ? 'type-expense' : 'type-transfer'}`}>
          {categoryName}
        </span>
      </div>

      {/* 6. Проект / Мероприятие */}
      <div className="compact-tx-col-event">
        {transaction.eventId && !isEventDeleted ? (
          <span className="compact-tx-event-pill" title={eventTitle}>
            {eventTitle}
          </span>
        ) : isEventDeleted ? (
          <span className="compact-tx-event-pill" style={{ color: '#b45309', background: '#fef3c7', borderColor: '#fde68a' }}>
            ⚠️ Удалён
          </span>
        ) : (
          <span style={{ color: 'var(--muted-foreground)', fontSize: '0.8rem' }}>—</span>
        )}
      </div>

      {/* 7. Счёт и Юрлицо */}
      <div className="compact-tx-col-account">
        <span className="account-name" title={accountLabel}>
          {transaction.type === 'transfer'
            ? `${accMap.get(transaction.fromAccountId || '') || '—'} → ${accMap.get(transaction.toAccountId || '') || '—'}`
            : isExpense ? (accMap.get(transaction.fromAccountId || '') || '—') : (accMap.get(transaction.toAccountId || '') || '—')}
        </span>
        <span className="entity-badge">
          {legalEntityLabel ? `🏛️ ${legalEntityLabel}` : 'Управленческий'}
        </span>
      </div>

      {/* 8. Закрывающие документы и НДС */}
      <div className="compact-tx-col-vat">
        {vatBadgeLabel ? (
          <span
            className="compact-tx-vat-pill"
            style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#047857',
            }}
            title={vatBadgeLabel}
          >
            {vatBadgeLabel}
          </span>
        ) : (
          <span style={{ color: 'var(--muted-foreground)', fontSize: '0.8rem' }}>—</span>
        )}
      </div>

      {/* 9. Сумма */}
      <div className="compact-tx-col-amount" style={{ color: amountColor }}>
        {sign}{formatRubles(transaction.amount)}
      </div>

      {/* 10. Кнопка удаления */}
      <div className="compact-tx-col-action" onClick={(e) => e.stopPropagation()}>
        {canDelete && (
          isConfirming ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="btn-confirm-yes"
                style={{ fontSize: '0.7rem', padding: '4px 6px', minHeight: '30px' }}
              >
                {isDeleting ? '...' : 'Да'}
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setIsConfirming(false); }}
                className="btn-confirm-no"
                style={{ fontSize: '0.7rem', padding: '4px 6px', minHeight: '30px' }}
              >
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
              style={{
                color: 'var(--color-text-muted)',
                width: '32px',
                height: '32px',
                borderRadius: '4px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Trash2 size={15} />
            </button>
          )
        )}
      </div>
    </div>
  );
};

export default TransactionRow;
