/**
 * Truespace — Барный кейтеринг и финансы
 * Transaction History Journal Component (`src/client/components/history/TransactionHistory.tsx`)
 */

import React, { useState, useMemo } from 'react';
import { History, ReceiptText } from 'lucide-react';
import { Transaction } from '../../../shared/types.js';
import { useFinance } from '../../context/FinanceContext.js';
import { TransactionFilterBar } from './TransactionFilterBar.js';
import { TransactionRow } from './TransactionRow.js';

export interface FilterState {
  accountId: string;
  eventId: string;
  type: string;
  searchQuery: string;
}

export function filterTransactions(txs: Transaction[], filters: FilterState): Transaction[] {
  return txs
    .filter((tx) => !tx.isDeleted)
    .filter((tx) => {
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
  const { transactions, isLoading } = useFinance();
  const [filters, setFilters] = useState<FilterState>({
    accountId: 'all', eventId: 'all', type: 'all', searchQuery: '',
  });

  const filtered = useMemo(() => filterTransactions(transactions, filters), [transactions, filters]);
  const handleReset = () => setFilters({ accountId: 'all', eventId: 'all', type: 'all', searchQuery: '' });

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
              История кассовых движений с возможностью отмены
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
        selectedType={filters.type}
        onSelectType={(t) => setFilters((prev) => ({ ...prev, type: t }))}
        searchQuery={filters.searchQuery}
        onSearchChange={(q) => setFilters((prev) => ({ ...prev, searchQuery: q }))}
        onReset={handleReset}
      />

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
          {filtered.map((tx) => (<TransactionRow key={tx.id} transaction={tx} />))}
        </div>
      )}
    </div>
  );
};

export default TransactionHistory;
