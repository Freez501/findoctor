/**
 * Truespace — Барный кейтеринг и финансы
 * Transaction Filter Bar Component (`src/client/components/history/TransactionFilterBar.tsx`)
 *
 * Modern shadcn-styled toolbar for transaction journal:
 * - Search by description, category name, or amount
 * - Type tabs (Все / Расход / Доход / Перевод)
 * - Event filter dropdown
 * - Category (статьи) filter dropdown
 * - Account chips
 * - Reset button
 */

import React from 'react';
import { Search, X, Calendar, Tag, ChevronDown, RotateCcw, UploadCloud, AlertTriangle, Briefcase } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext.js';

interface Props {
  selectedAccountId: string;
  onSelectAccount: (id: string) => void;
  selectedEventId: string;
  onSelectEvent: (id: string) => void;
  selectedCategoryId: string;
  onSelectCategory: (id: string) => void;
  selectedType: string;
  onSelectType: (type: string) => void;
  selectedPeriod?: string;
  onSelectPeriod?: (period: string) => void;
  startDate?: string;
  onStartDateChange?: (date: string) => void;
  endDate?: string;
  onEndDateChange?: (date: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onReset: () => void;
  onOpenImport?: () => void;
  onlyUnreviewed?: boolean;
  onToggleUnreviewed?: (val: boolean) => void;
  unreviewedCount?: number;
}

const TYPE_TABS = [
  { id: 'all', label: 'Все' },
  { id: 'expense', label: 'Расход' },
  { id: 'income', label: 'Доход' },
  { id: 'transfer', label: 'Перевод' },
];

export const TransactionFilterBar: React.FC<Props> = ({
  selectedAccountId,
  onSelectAccount,
  selectedEventId,
  onSelectEvent,
  selectedCategoryId,
  onSelectCategory,
  selectedType,
  onSelectType,
  selectedPeriod = 'all',
  onSelectPeriod,
  startDate = '',
  onStartDateChange,
  endDate = '',
  onEndDateChange,
  searchQuery,
  onSearchChange,
  onReset,
  onOpenImport,
  onlyUnreviewed = false,
  onToggleUnreviewed,
  unreviewedCount = 0,
}) => {
  const { accounts, events, categories } = useFinance();
  const hasActiveFilters =
    selectedAccountId !== 'all' ||
    selectedEventId !== 'all' ||
    selectedCategoryId !== 'all' ||
    selectedType !== 'all' ||
    (selectedPeriod && selectedPeriod !== 'all') ||
    Boolean(startDate && startDate.trim() !== '') ||
    Boolean(endDate && endDate.trim() !== '') ||
    onlyUnreviewed ||
    searchQuery.trim() !== '';

  return (
    <div className="transaction-filter-panel">
      {/* Row 1: Search Input + Import Button + Reset Button */}
      <div className="filter-search-row">
        <div className="filter-search-wrapper">
          <Search size={15} className="filter-search-icon" aria-hidden="true" />
          <input
            type="text"
            className="filter-search-input"
            placeholder="Поиск по описанию, категории, сумме..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="btn-filter-clear"
              aria-label="Очистить строку поиска"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Import Statement Button */}
        {onOpenImport && (
          <button
            type="button"
            onClick={onOpenImport}
            className="btn-filter-import"
            title="Импортировать выписку из банка или вставить текст из Telegram"
          >
            <UploadCloud size={14} aria-hidden="true" />
            <span>Импорт</span>
          </button>
        )}

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="btn-filter-reset"
            title="Сбросить все активные фильтры"
          >
            <RotateCcw size={13} aria-hidden="true" />
            <span>Сбросить</span>
          </button>
        )}
      </div>

      {/* Triage unreviewed banner/filter if unreviewed operations exist */}
      {unreviewedCount > 0 && onToggleUnreviewed && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => onToggleUnreviewed(!onlyUnreviewed)}
            className={`filter-unreviewed-pill ${onlyUnreviewed ? 'filter-unreviewed-active' : ''}`}
          >
            <AlertTriangle size={13} />
            <span>Требуют разметки ({unreviewedCount})</span>
          </button>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
            Операции без подтверждённой статьи или мероприятия
          </span>
        </div>
      )}

      {/* Row 2: Type Tabs + Dropdowns (Event & Category) */}
      <div className="filter-controls-row">
        {/* Segmented Type Tabs */}
        <div className="filter-type-tabs" role="tablist">
          {TYPE_TABS.map((tab) => {
            const active = selectedType === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelectType(tab.id)}
                className={`filter-type-pill ${active ? 'filter-type-pill-active' : ''}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Dropdowns Group */}
        <div className="filter-dropdowns-group">
          {/* Period Select Dropdown */}
          <div className="filter-select-wrapper">
            <Calendar size={13} className="filter-select-icon" aria-hidden="true" />
            <select
              value={selectedPeriod}
              onChange={(e) => onSelectPeriod && onSelectPeriod(e.target.value)}
              className="filter-custom-select"
              aria-label="Фильтр по периоду"
            >
              <option value="all">За всё время</option>
              <option value="today">Сегодня</option>
              <option value="week">Текущая неделя</option>
              <option value="month">Текущий месяц</option>
              <option value="prev_month">Прошлый месяц</option>
              <option value="custom">Свой период...</option>
            </select>
            <ChevronDown size={14} className="filter-select-arrow" aria-hidden="true" />
          </div>

          {/* Custom Date Range Picker */}
          {selectedPeriod === 'custom' && (
            <div className="filter-date-range-wrapper">
              <div className="filter-date-field">
                <span className="filter-date-label">от</span>
                <input
                  type="date"
                  className="filter-date-input"
                  value={startDate}
                  onChange={(e) => onStartDateChange && onStartDateChange(e.target.value)}
                  aria-label="Дата начала"
                />
              </div>
              <div className="filter-date-field">
                <span className="filter-date-label">до</span>
                <input
                  type="date"
                  className="filter-date-input"
                  value={endDate}
                  onChange={(e) => onEndDateChange && onEndDateChange(e.target.value)}
                  aria-label="Дата окончания"
                />
              </div>
            </div>
          )}

          {/* Event Select Dropdown */}
          <div className="filter-select-wrapper">
            <Briefcase size={13} className="filter-select-icon" aria-hidden="true" />
            <select
              value={selectedEventId}
              onChange={(e) => onSelectEvent(e.target.value)}
              className="filter-custom-select"
              aria-label="Фильтр по мероприятию"
            >
              <option value="all">Все мероприятия</option>
              <option value="general">Общие расходы бара (без ивента)</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="filter-select-arrow" aria-hidden="true" />
          </div>

          {/* Category Select Dropdown */}
          <div className="filter-select-wrapper">
            <Tag size={13} className="filter-select-icon" aria-hidden="true" />
            <select
              value={selectedCategoryId}
              onChange={(e) => onSelectCategory(e.target.value)}
              className="filter-custom-select"
              aria-label="Фильтр по статье расходов/доходов"
            >
              <option value="all">Все статьи (категории)</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} ({cat.type === 'income' ? 'Доход' : 'Расход'})
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="filter-select-arrow" aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* Row 3: Account Filter Chips */}
      <div className="filter-accounts-row">
        <span className="filter-row-caption">Счёт:</span>
        <div className="filter-accounts-track">
          <button
            type="button"
            onClick={() => onSelectAccount('all')}
            className={`filter-account-chip ${selectedAccountId === 'all' ? 'filter-chip-active' : ''}`}
          >
            Все счета
          </button>
          {accounts.map((acc) => {
            const active = selectedAccountId === acc.id;
            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => onSelectAccount(acc.id)}
                className={`filter-account-chip ${active ? 'filter-chip-active' : ''}`}
              >
                <span className={`chip-dot dot-${acc.type}`} aria-hidden="true" />
                <span>{acc.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TransactionFilterBar;
