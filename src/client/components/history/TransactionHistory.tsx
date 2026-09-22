/**
 * Truespace — Барный кейтеринг и финансы
 * Transaction History Journal Component (`src/client/components/history/TransactionHistory.tsx`)
 */

import React, { useState, useMemo } from 'react';
import { History, ReceiptText, Trash2, ArrowLeftRight } from 'lucide-react';
import { Transaction } from '../../../shared/types.js';
import { useFinance } from '../../context/FinanceContext.js';
import { TransactionFilterBar } from './TransactionFilterBar.js';
import { TransactionRow } from './TransactionRow.js';
import { TransactionEditModal } from './TransactionEditModal.js';
import { StatementImportModal } from '../import/StatementImportModal.js';
import { BatchDeleteModal, BatchMoveModal } from './TransactionBatchModals.js';

export interface FilterState {
  accountId: string;
  eventId: string;
  categoryId?: string;
  type: string;
  searchQuery: string;
  onlyUnreviewed?: boolean;
  period?: 'all' | 'today' | 'week' | 'month' | 'prev_month' | 'custom' | string;
  startDate?: string;
  endDate?: string;
}

export function toLocalDateString(dateInput: string | Date): string {
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput;
  }
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isDateInPeriod(
  txDateStr: string,
  period?: string,
  startDate?: string,
  endDate?: string,
  nowDate: Date = new Date()
): boolean {
  if (!period || period === 'all') {
    if (!startDate && !endDate) return true;
  }

  const txDayStr = toLocalDateString(txDateStr);
  if (!txDayStr) return false;

  if (period === 'today') {
    const todayStr = toLocalDateString(nowDate);
    return txDayStr === todayStr;
  }

  if (period === 'week') {
    const dayOfWeek = (nowDate.getDay() + 6) % 7; // Mon = 0, Sun = 6
    const startOfWeek = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() - dayOfWeek);
    const endOfWeek = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() - dayOfWeek + 6);
    const startStr = toLocalDateString(startOfWeek);
    const endStr = toLocalDateString(endOfWeek);
    return txDayStr >= startStr && txDayStr <= endStr;
  }

  if (period === 'month') {
    const startOfMonth = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1);
    const endOfMonth = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 0);
    const startStr = toLocalDateString(startOfMonth);
    const endStr = toLocalDateString(endOfMonth);
    return txDayStr >= startStr && txDayStr <= endStr;
  }

  if (period === 'prev_month') {
    const startOfPrevMonth = new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(nowDate.getFullYear(), nowDate.getMonth(), 0);
    const startStr = toLocalDateString(startOfPrevMonth);
    const endStr = toLocalDateString(endOfPrevMonth);
    return txDayStr >= startStr && txDayStr <= endStr;
  }

  if (period === 'custom' || startDate || endDate) {
    if (startDate && txDayStr < startDate) return false;
    if (endDate && txDayStr > endDate) return false;
    return true;
  }

  return true;
}

export function filterTransactions(txs: Transaction[], filters: FilterState): Transaction[] {
  return txs
    .filter((tx) => !tx.isDeleted)
    .filter((tx) => {
      if (filters.onlyUnreviewed) {
        const isUnreviewed = tx.needsReview || tx.categoryId === 'uncategorized';
        if (!isUnreviewed) return false;
      }
      if (!isDateInPeriod(tx.transactionDate, filters.period, filters.startDate, filters.endDate)) {
        return false;
      }
      if (filters.accountId !== 'all') {
        const matchesAccount = tx.fromAccountId === filters.accountId || tx.toAccountId === filters.accountId;
        if (!matchesAccount) return false;
      }
      if (filters.eventId !== 'all') {
        if (filters.eventId === 'general') {
          if (tx.eventId) return false;
        } else {
          const normA = (tx.eventId || '').replace(/-/g, '_');
          const normB = filters.eventId.replace(/-/g, '_');
          if (normA !== normB) return false;
        }
      }
      if (filters.categoryId && filters.categoryId !== 'all') {
        if (tx.categoryId !== filters.categoryId) return false;
      }
      if (filters.type !== 'all' && tx.type !== filters.type) return false;
      if (filters.searchQuery.trim()) {
        const q = filters.searchQuery.trim().toLowerCase();
        const inDesc = (tx.description || '').toLowerCase().includes(q);
        const inCat = (tx.categoryId || '').toLowerCase().includes(q);
        const inAmount = tx.amount.toString().includes(q);
        if (!inDesc && !inCat && !inAmount) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());
}

export const TransactionHistory: React.FC = () => {
  const { transactions, accounts, isLoading, deleteBatchTransactions, updateBatchTransactions } = useFinance();
  const [filters, setFilters] = useState<FilterState>({
    accountId: 'all',
    eventId: 'all',
    categoryId: 'all',
    type: 'all',
    searchQuery: '',
    onlyUnreviewed: false,
    period: 'all',
    startDate: '',
    endDate: '',
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);
  const [isBatchDeleteOpen, setIsBatchDeleteOpen] = useState<boolean>(false);
  const [isBatchMoveOpen, setIsBatchMoveOpen] = useState<boolean>(false);
  const [isProcessingBatch, setIsProcessingBatch] = useState<boolean>(false);

  const unreviewedCount = useMemo(
    () => transactions.filter((tx) => !tx.isDeleted && (tx.needsReview || tx.categoryId === 'uncategorized')).length,
    [transactions]
  );

  const filtered = useMemo(() => filterTransactions(transactions, filters), [transactions, filters]);

  const isAllSelected = filtered.length > 0 && selectedIds.size === filtered.length;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((tx) => tx.id)));
    }
  };

  const handleToggleSelectOne = (tx: Transaction) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(tx.id)) {
        next.delete(tx.id);
      } else {
        next.add(tx.id);
      }
      return next;
    });
  };

  const targetBatchTxs = useMemo(() => {
    if (selectedIds.size > 0) {
      return filtered.filter((tx) => selectedIds.has(tx.id));
    }
    return filtered;
  }, [filtered, selectedIds]);

  const handleConfirmBatchDelete = async () => {
    const ids = targetBatchTxs.map((t) => t.id);
    if (ids.length === 0) return;
    setIsProcessingBatch(true);
    const res = await deleteBatchTransactions(ids);
    setIsProcessingBatch(false);
    if (res.success) {
      setSelectedIds(new Set());
      setIsBatchDeleteOpen(false);
    }
  };

  const handleConfirmBatchMove = async (newAccountId: string) => {
    const ids = targetBatchTxs.map((t) => t.id);
    if (ids.length === 0) return;
    setIsProcessingBatch(true);
    const res = await updateBatchTransactions(ids, { accountId: newAccountId });
    setIsProcessingBatch(false);
    if (res.success) {
      setSelectedIds(new Set());
      setIsBatchMoveOpen(false);
    }
  };

  const handleReset = () => {
    setFilters({
      accountId: 'all',
      eventId: 'all',
      categoryId: 'all',
      type: 'all',
      searchQuery: '',
      onlyUnreviewed: false,
      period: 'all',
      startDate: '',
      endDate: '',
    });
    setSelectedIds(new Set());
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <History size={20} aria-hidden="true" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Журнал операций</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              История кассовых движений с возможностью отмены и редактирования
            </span>
          </div>
        </div>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
          {filtered.length} {filtered.length === 1 ? 'запись' : 'записей'}
        </span>
      </div>

      {/* Filter Bar */}
      <TransactionFilterBar
        selectedAccountId={filters.accountId}
        onSelectAccount={(accId) => setFilters((prev) => ({ ...prev, accountId: accId }))}
        selectedEventId={filters.eventId}
        onSelectEvent={(evId) => setFilters((prev) => ({ ...prev, eventId: evId }))}
        selectedCategoryId={filters.categoryId || 'all'}
        onSelectCategory={(catId) => setFilters((prev) => ({ ...prev, categoryId: catId }))}
        selectedType={filters.type}
        onSelectType={(t) => setFilters((prev) => ({ ...prev, type: t }))}
        selectedPeriod={filters.period || 'all'}
        onSelectPeriod={(p) => setFilters((prev) => ({ ...prev, period: p }))}
        startDate={filters.startDate || ''}
        onStartDateChange={(d) => setFilters((prev) => ({ ...prev, startDate: d }))}
        endDate={filters.endDate || ''}
        onEndDateChange={(d) => setFilters((prev) => ({ ...prev, endDate: d }))}
        searchQuery={filters.searchQuery}
        onSearchChange={(q) => setFilters((prev) => ({ ...prev, searchQuery: q }))}
        onReset={handleReset}
        onOpenImport={() => setIsImportOpen(true)}
        onlyUnreviewed={filters.onlyUnreviewed}
        onToggleUnreviewed={(val) => setFilters((prev) => ({ ...prev, onlyUnreviewed: val }))}
        unreviewedCount={unreviewedCount}
      />

      {/* Mass Actions Toolbar */}
      {filtered.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: selectedIds.size > 0 ? 'rgba(59, 130, 246, 0.08)' : 'var(--color-bg-subtle, rgba(0,0,0,0.02))',
            border: selectedIds.size > 0 ? '1px solid rgba(59, 130, 246, 0.25)' : '1px solid var(--border)',
            fontSize: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={handleToggleSelectAll}
                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--color-accent)' }}
              />
              <span>{isAllSelected ? 'Снять выделение со всех' : `Выбрать все (${filtered.length})`}</span>
            </label>
            {selectedIds.size > 0 && !isAllSelected && (
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                (выбрано: {selectedIds.size})
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {selectedIds.size > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsBatchMoveOpen(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 10px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: '#2563eb',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                  }}
                  title="Перенести выбранные операции на другой счёт"
                >
                  <ArrowLeftRight size={14} />
                  Сменить счёт ({selectedIds.size})
                </button>
                <button
                  type="button"
                  onClick={() => setIsBatchDeleteOpen(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 10px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: '#dc2626',
                    backgroundColor: 'rgba(220, 38, 38, 0.1)',
                    border: '1px solid rgba(220, 38, 38, 0.3)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                  }}
                  title="Удалить выбранные операции с пересчётом балансов"
                >
                  <Trash2 size={14} />
                  Удалить ({selectedIds.size})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--color-text-muted)',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: '4px',
                  }}
                >
                  Сбросить выбор
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIds(new Set(filtered.map((tx) => tx.id)));
                    setIsBatchMoveOpen(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 8px',
                    fontSize: '0.78rem',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-bg)',
                    cursor: 'pointer',
                    color: 'var(--color-text-muted)',
                  }}
                  title="Перенести все отображаемые операции на другой счёт"
                >
                  <ArrowLeftRight size={13} />
                  Сменить счёт для всех ({filtered.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIds(new Set(filtered.map((tx) => tx.id)));
                    setIsBatchDeleteOpen(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 8px',
                    fontSize: '0.78rem',
                    border: '1px solid rgba(220, 38, 38, 0.25)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-bg)',
                    cursor: 'pointer',
                    color: '#dc2626',
                  }}
                  title="Удалить все отображаемые операции за период"
                >
                  <Trash2 size={13} />
                  Удалить все за период ({filtered.length})
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Transactions List */}
      {isLoading && transactions.length === 0 ? (
        <div className="glass-panel" style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          Загрузка журнала операций...
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <ReceiptText size={32} style={{ opacity: 0.5 }} aria-hidden="true" />
          <p style={{ fontWeight: 600 }}>Операций не найдено</p>
          <span style={{ fontSize: '0.8rem' }}>Попробуйте изменить параметры фильтрации</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map((tx) => (
            <TransactionRow
              key={tx.id}
              transaction={tx}
              isSelected={selectedIds.has(tx.id)}
              onToggleSelect={handleToggleSelectOne}
              onClick={(selected) => setEditingTx(selected)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <TransactionEditModal
        transaction={editingTx}
        isOpen={Boolean(editingTx)}
        onClose={() => setEditingTx(null)}
      />

      <StatementImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
      />

      <BatchDeleteModal
        isOpen={isBatchDeleteOpen}
        onClose={() => setIsBatchDeleteOpen(false)}
        onConfirm={handleConfirmBatchDelete}
        transactions={targetBatchTxs}
        accounts={accounts}
        isProcessing={isProcessingBatch}
      />

      <BatchMoveModal
        isOpen={isBatchMoveOpen}
        onClose={() => setIsBatchMoveOpen(false)}
        onConfirm={handleConfirmBatchMove}
        transactions={targetBatchTxs}
        accounts={accounts}
        isProcessing={isProcessingBatch}
      />
    </div>
  );
};

export default TransactionHistory;
