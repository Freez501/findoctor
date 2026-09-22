/**
 * Truespace — Барный кейтеринг и финансы
 * Batch Transaction Modals (src/client/components/history/TransactionBatchModals.tsx)
 */

import React, { useState } from 'react';
import { X, Trash2, ArrowLeftRight, AlertTriangle, Info } from 'lucide-react';
import { Transaction, Account } from '../../../shared/types.js';
import { formatRubles } from '../../utils/formatters.js';

export function getOperationWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 19) return 'операций';
  if (mod10 === 1) return 'операцию';
  if (mod10 >= 2 && mod10 <= 4) return 'операции';
  return 'операций';
}

interface BatchDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  transactions: Transaction[];
  accounts: Account[];
  isProcessing: boolean;
}

export const BatchDeleteModal: React.FC<BatchDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  transactions,
  accounts,
  isProcessing,
}) => {
  if (!isOpen) return null;

  const count = transactions.length;
  const word = getOperationWord(count);

  const totalExpense = transactions
    .filter((tx) => tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalIncome = transactions
    .filter((tx) => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const accMap = new Map(accounts.map((a) => [a.id, a.name]));
  const involvedAccountIds = new Set<string>();
  transactions.forEach((tx) => {
    if (tx.fromAccountId) involvedAccountIds.add(tx.fromAccountId);
    if (tx.toAccountId) involvedAccountIds.add(tx.toAccountId);
  });
  const accountNames = Array.from(involvedAccountIds)
    .map((id) => accMap.get(id) || id)
    .filter(Boolean);

  return (
    <div className="modal-backdrop-centered" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="settings-modal-dialog"
        style={{ maxWidth: '480px', width: '92%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Trash2 size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)' }}>
                Удаление {count} {word}
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                Массовая отмена с пересчётом балансов
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-modal-close"
            disabled={isProcessing}
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-start',
            }}
          >
            <AlertTriangle size={18} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.85rem', color: 'var(--foreground)', lineHeight: 1.45 }}>
              Вы уверены, что хотите удалить <strong>{count} {word}</strong>?
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              fontSize: '0.85rem',
              backgroundColor: 'var(--color-bg-subtle, rgba(0,0,0,0.03))',
              padding: '12px',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            {totalIncome > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted-foreground)' }}>Поступления (доход):</span>
                <strong style={{ color: '#059669' }}>+{formatRubles(totalIncome)}</strong>
              </div>
            )}
            {totalExpense > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted-foreground)' }}>Списания (расход):</span>
                <strong style={{ color: '#dc2626' }}>−{formatRubles(totalExpense)}</strong>
              </div>
            )}
            {accountNames.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '6px', marginTop: '2px' }}>
                <span style={{ color: 'var(--muted-foreground)' }}>Затронутые счета:</span>
                <span style={{ fontWeight: 600 }}>{accountNames.join(', ')}</span>
              </div>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              fontSize: '0.78rem',
              color: 'var(--muted-foreground)',
              lineHeight: 1.4,
            }}
          >
            <Info size={16} style={{ flexShrink: 0 }} />
            <span>
              Балансы счетов будут автоматически возвращены в исходное состояние (все списания и поступления отменятся).
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="btn-modal-secondary"
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className="btn-modal-danger"
            style={{
              padding: '8px 16px',
              fontSize: '0.85rem',
              backgroundColor: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Trash2 size={16} />
            {isProcessing ? 'Удаление...' : `Удалить ${count} ${word}`}
          </button>
        </div>
      </div>
    </div>
  );
};

interface BatchMoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (targetAccountId: string) => Promise<void>;
  transactions: Transaction[];
  accounts: Account[];
  isProcessing: boolean;
}

export const BatchMoveModal: React.FC<BatchMoveModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  transactions,
  accounts,
  isProcessing,
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  if (!isOpen) return null;

  const count = transactions.length;
  const word = getOperationWord(count);

  const accMap = new Map(accounts.map((a) => [a.id, a.name]));
  const involvedAccountIds = new Set<string>();
  transactions.forEach((tx) => {
    if (tx.fromAccountId) involvedAccountIds.add(tx.fromAccountId);
    if (tx.toAccountId) involvedAccountIds.add(tx.toAccountId);
  });
  const sourceAccountNames = Array.from(involvedAccountIds)
    .map((id) => accMap.get(id) || id)
    .filter(Boolean);

  const activeAccounts = accounts.filter((a) => a.isActive !== false);

  const handleApply = async () => {
    if (!selectedAccountId) return;
    await onConfirm(selectedAccountId);
  };

  return (
    <div className="modal-backdrop-centered" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="settings-modal-dialog"
        style={{ maxWidth: '480px', width: '92%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(59, 130, 246, 0.12)',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ArrowLeftRight size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)' }}>
                Сменить счёт для {count} {word}
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                Быстрый перенос без повторного импорта
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-modal-close"
            disabled={isProcessing}
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              fontSize: '0.85rem',
              color: 'var(--foreground)',
              lineHeight: 1.45,
            }}
          >
            Перепутали счёт при загрузке выписки? Выберите правильный счёт, и мы перенесём все <strong>{count} {word}</strong> с автоматическим пересчётом балансов обоих счетов.
          </div>

          {sourceAccountNames.length > 0 && (
            <div style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)' }}>
              Текущий счёт в операциях: <strong>{sourceAccountNames.join(', ')}</strong>
            </div>
          )}

          <div>
            <label className="modal-label" style={{ marginBottom: '6px' }}>
              Выберите новый счёт для этих операций
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="modal-select"
              style={{ width: '100%' }}
              disabled={isProcessing}
            >
              <option value="">— Выберите счёт —</option>
              {activeAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.type === 'cash' ? 'наличные' : acc.type === 'bank' ? 'банк' : 'карта'}) — {formatRubles(acc.currentBalance)}
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              fontSize: '0.78rem',
              color: 'var(--muted-foreground)',
              lineHeight: 1.4,
            }}
          >
            <Info size={16} style={{ flexShrink: 0 }} />
            <span>
              Баланс прежнего счёта вернётся в исходное состояние, а на новом счёте отобразятся все движения.
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="btn-modal-secondary"
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!selectedAccountId || isProcessing}
            className="btn-modal-primary"
            style={{
              padding: '8px 16px',
              fontSize: '0.85rem',
              backgroundColor: 'var(--color-accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              cursor: !selectedAccountId || isProcessing ? 'not-allowed' : 'pointer',
              opacity: !selectedAccountId ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ArrowLeftRight size={16} />
            {isProcessing ? 'Перенос...' : 'Перенести на этот счёт'}
          </button>
        </div>
      </div>
    </div>
  );
};
