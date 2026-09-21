/**
 * Truespace — Барный кейтеринг и финансы
 * Transaction Filter Bar Component (`src/client/components/history/TransactionFilterBar.tsx`)
 */

import React from 'react';
import { Search, X, Filter } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext.js';

interface Props {
  selectedAccountId: string;
  onSelectAccount: (id: string) => void;
  selectedEventId: string;
  onSelectEvent: (id: string) => void;
  selectedType: string;
  onSelectType: (type: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onReset: () => void;
}

const TYPE_TABS = [
  { id: 'all', label: 'Все' }, { id: 'expense', label: 'Расход' },
  { id: 'income', label: 'Доход' }, { id: 'transfer', label: 'Перевод' },
];

export const TransactionFilterBar: React.FC<Props> = ({
  selectedAccountId, onSelectAccount, selectedEventId, onSelectEvent,
  selectedType, onSelectType, searchQuery, onSearchChange, onReset,
}) => {
  const { accounts, events } = useFinance();
  const hasActiveFilters = selectedAccountId !== 'all' || selectedEventId !== 'all' || selectedType !== 'all' || searchQuery.trim() !== '';

  return (
    <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Search & Reset Row */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div className="simulator-input-wrapper" style={{ flex: 1, padding: '4px 10px' }}>
          <Search size={16} style={{ color: 'var(--color-text-muted)' }} aria-hidden="true" />
          <input
            type="text"
            className="simulator-text-input"
            placeholder="Поиск по описанию, сумме..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button type="button" onClick={() => onSearchChange('')} aria-label="Очистить поиск">
              <X size={16} style={{ color: 'var(--color-text-muted)' }} />
            </button>
          )}
        </div>
        {hasActiveFilters && (
          <button type="button" onClick={onReset} className="btn-confirm-no" style={{ padding: '8px 12px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
            Сбросить
          </button>
        )}
      </div>

      {/* Type Tabs */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
        {TYPE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectType(tab.id)}
            className={`preset-chip ${selectedType === tab.id ? 'preset-chip-active' : ''}`}
            style={{ fontSize: '0.8rem', padding: '5px 12px' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Account Chips & Event Dropdown */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', alignItems: 'center', maxWidth: '100%' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Счёт:</span>
          <button
            type="button"
            onClick={() => onSelectAccount('all')}
            className={`preset-chip ${selectedAccountId === 'all' ? 'preset-chip-active' : ''}`}
            style={{ fontSize: '0.75rem', padding: '3px 8px' }}
          >
            Все
          </button>
          {accounts.map((acc) => (
            <button
              key={acc.id}
              type="button"
              onClick={() => onSelectAccount(acc.id)}
              className={`preset-chip ${selectedAccountId === acc.id ? 'preset-chip-active' : ''}`}
              style={{ fontSize: '0.75rem', padding: '3px 8px' }}
            >
              {acc.name.split(' ')[0]} {acc.name.split(' ')[1] || ''}
            </button>
          ))}
        </div>

        {/* Event Select */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Filter size={14} style={{ color: 'var(--color-text-muted)' }} aria-hidden="true" />
          <select
            value={selectedEventId}
            onChange={(e) => onSelectEvent(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', fontSize: '0.75rem', backgroundColor: '#fff' }}
          >
            <option value="all">Все мероприятия</option>
            <option value="general">Общие расходы (без ивента)</option>
            {events.map((ev) => (<option key={ev.id} value={ev.id}>{ev.title}</option>))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default TransactionFilterBar;
