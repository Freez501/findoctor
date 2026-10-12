/**
 * Truespace — Барный кейтеринг и финансы
 * 3-Step 5-Second Mobile Quick Entry Modal (`src/client/components/entry/QuickEntryModal.tsx`)
 *
 * Implements:
 * 1. Step 1: Type (Расход / Доход / Перевод)
 * 2. Step 2: Amount (large display + NumericPad with +500, +1000, +5000)
 * 3. Step 3: Account & Category chips & EventSelector with "Общие расходы бара" toggle
 * - Transfer between 2 accounts preventing identical source/target
 * - Optimistic balance update and fast toast feedback
 */

import React, { useState, useEffect } from 'react';
import { X, ArrowDownRight, ArrowUpRight, ArrowLeftRight, Check, Loader2, AlertCircle, Users, Briefcase, Calendar, FileText } from 'lucide-react';
import { TransactionType, TransactionDirection } from '../../../shared/types.js';
import { DEFAULT_EXPENSE_CATEGORY_ID, DEFAULT_INCOME_CATEGORY_ID, CATEGORY_IDS, EVENT_IDS } from '../../../shared/constants.js';
import { useFinance } from '../../context/FinanceContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { formatRubles, formatDateRu } from '../../utils/formatters.js';
import { NumericPad } from './NumericPad.js';
import { CategoryChips } from './CategoryChips.js';
import { AccountChips } from './AccountChips.js';
import { EventSelector } from './EventSelector.js';

const pad2 = (n: number) => String(n).padStart(2, '0');

const getTodayDateStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const getYesterdayDateStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const getIsoDateForSelectedDay = (dateStr: string) => {
  if (!dateStr) return new Date().toISOString();
  const now = new Date();
  const todayStr = getTodayDateStr();
  if (dateStr === todayStr) {
    return now.toISOString();
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  const targetDate = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
  return targetDate.toISOString();
};

interface QuickEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAccountId?: string;
  initialType?: TransactionType;
}

export const QuickEntryModal: React.FC<QuickEntryModalProps> = ({
  isOpen,
  onClose,
  initialAccountId,
  initialType = 'expense',
}) => {
  const { createTransaction, partners, accounts, events } = useFinance();
  const { currentUser, currentCompany } = useAuth();

  // Form State
  const [type, setType] = useState<TransactionType>(initialType);
  const [direction, setDirection] = useState<TransactionDirection>('operational');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [fromAccountId, setFromAccountId] = useState<string | null>(() => {
    if (initialAccountId && accounts.some((a) => a.id === initialAccountId)) {
      return initialAccountId;
    }
    return null;
  });
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string>(DEFAULT_EXPENSE_CATEGORY_ID);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(() => {
    if (events.some((e) => e.id === EVENT_IDS.WEDDING)) return EVENT_IDS.WEDDING;
    return events[0]?.id || null;
  });
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateStr());
  const [description, setDescription] = useState<string>('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [highlightedField, setHighlightedField] = useState<'fromAccount' | 'toAccount' | 'transferAccounts' | null>(null);

  // Sync initial date and reset highlights when opened
  useEffect(() => {
    if (isOpen) {
      setSelectedDate(getTodayDateStr());
      setHighlightedField(null);
      setValidationError(null);
      if (initialAccountId && accounts.some((a) => a.id === initialAccountId)) {
        setFromAccountId(initialAccountId);
      }
    }
  }, [isOpen, initialAccountId, accounts]);

  // Sync initial account when opened
  useEffect(() => {
    if (initialAccountId && accounts.some((a) => a.id === initialAccountId)) {
      setFromAccountId(initialAccountId);
    }
  }, [initialAccountId, accounts]);

  // Sync initial type when opened
  useEffect(() => {
    if (initialType) {
      setType(initialType);
    }
  }, [initialType]);

  // Reset category and event defaults when type changes
  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    setValidationError(null);
    setHighlightedField(null);

    if (newType === 'expense') {
      setCategoryId(DEFAULT_EXPENSE_CATEGORY_ID);
      setDirection('operational');
    } else if (newType === 'income') {
      setCategoryId(DEFAULT_INCOME_CATEGORY_ID);
      setDirection('operational');
    } else if (newType === 'transfer') {
      setCategoryId(CATEGORY_IDS.TRANSFER_INTERNAL);
      setDirection('transfer');
      setSelectedEventId(null);
      // Ensure from and to accounts are distinct
      if (fromAccountId && toAccountId && fromAccountId === toAccountId) {
        const otherAccount = accounts.find((a) => a.id !== fromAccountId);
        if (otherAccount) {
          setToAccountId(otherAccount.id);
        }
      }
    }
  };

  const handleDirectionChange = (newDir: TransactionDirection) => {
    setDirection(newDir);
    setValidationError(null);
    if (newDir === 'dividends') {
      setCategoryId(CATEGORY_IDS.DIVIDENDS || 'dividends');
      if (!selectedPartnerId && partners.length > 0) {
        setSelectedPartnerId(partners[0].id);
      }
    } else if (newDir === 'business') {
      setCategoryId(CATEGORY_IDS.TAXES || DEFAULT_EXPENSE_CATEGORY_ID);
    } else {
      setCategoryId(DEFAULT_EXPENSE_CATEGORY_ID);
    }
  };

  // Check whether user entered meaningful data
  const isDirty = amount > 0 || selectedDate !== getTodayDateStr() || description.trim() !== '';

  const handleRequestClose = () => {
    if (isDirty) {
      if (window.confirm('Вы уже указали данные операции. Закрыть окно ввода без сохранения?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  // Keyboard escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (isDirty) {
          if (window.confirm('Вы уже указали данные операции. Закрыть окно ввода без сохранения?')) {
            onClose();
          }
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDirty, onClose]);

  // Safe backdrop click handler preventing accidental close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      if (isDirty) {
        if (window.confirm('Вы уже указали данные операции. Закрыть окно ввода без сохранения?')) {
          onClose();
        }
      } else {
        onClose();
      }
    }
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setHighlightedField(null);

    // 1. Validation: Amount
    if (amount <= 0) {
      setValidationError('Введите сумму операции больше 0 ₽.');
      const padEl = document.querySelector('.numeric-pad-container');
      padEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // 2. Validation: Expense Account
    if (type === 'expense') {
      const isFromValid = fromAccountId && accounts.some((a) => a.id === fromAccountId);
      if (!isFromValid) {
        setHighlightedField('fromAccount');
        setValidationError('Пожалуйста, выберите счёт списания: укажите, откуда оплачено.');
        const el = document.getElementById('account-chips-expense');
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }

    // 3. Validation: Income Account
    if (type === 'income') {
      const isToValid = toAccountId && accounts.some((a) => a.id === toAccountId);
      if (!isToValid) {
        setHighlightedField('toAccount');
        setValidationError('Пожалуйста, выберите счёт зачисления: укажите, куда поступили деньги.');
        const el = document.getElementById('account-chips-income');
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }

    // 4. Validation: Dividends Partner
    if (type === 'expense' && direction === 'dividends' && !selectedPartnerId) {
      setValidationError('Пожалуйста, выберите партнёра для выплаты дивидендов.');
      return;
    }

    // 5. Validation: Transfer Accounts
    if (type === 'transfer') {
      const isFromValid = fromAccountId && accounts.some((a) => a.id === fromAccountId);
      const isToValid = toAccountId && accounts.some((a) => a.id === toAccountId);
      if (!isFromValid || !isToValid) {
        setHighlightedField('transferAccounts');
        setValidationError('Пожалуйста, выберите счёт списания и счёт зачисления для перевода.');
        const el = document.getElementById('account-chips-transfer');
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (fromAccountId === toAccountId) {
        setHighlightedField('transferAccounts');
        setValidationError('Счёт списания и счёт зачисления не могут совпадать.');
        const el = document.getElementById('account-chips-transfer');
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }

    const selectedPartner = partners.find((p) => p.id === selectedPartnerId);
    const payload = {
      type,
      direction: type === 'transfer' ? ('transfer' as const) : direction,
      amount,
      fromAccountId: type === 'income' ? null : fromAccountId,
      toAccountId: type === 'expense' ? null : toAccountId,
      categoryId: type === 'transfer' ? CATEGORY_IDS.TRANSFER_INTERNAL : categoryId,
      eventId: type === 'transfer' || direction !== 'operational' ? null : selectedEventId,
      partnerId: direction === 'dividends' ? selectedPartnerId : null,
      partnerName: direction === 'dividends' && selectedPartner ? selectedPartner.name : null,
      description: description.trim(),
      transactionDate: getIsoDateForSelectedDay(selectedDate),
      createdBy: currentUser?.id || undefined,
      companyId: currentCompany?.id,
    };

    // Reset form and close modal immediately (0ms optimistic update on dashboard & journal)
    setAmount(0);
    setDescription('');
    setSelectedDate(getTodayDateStr());
    onClose();

    void createTransaction(payload);
  };

  if (!isOpen) return null;

  // Submit button label
  const submitActionLabel =
    type === 'expense'
      ? `Записать расход: ${formatRubles(amount)}`
      : type === 'income'
      ? `Записать доход: ${formatRubles(amount)}`
      : `Перевести: ${formatRubles(amount)}`;

  return (
    <div className="modal-backdrop animate-fade-in" onClick={handleBackdropClick} role="presentation">
      <div
        className="quick-entry-bottom-sheet animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Быстрое внесение финансовой операции"
      >
        {/* Drag handle pill for mobile ergonomics */}
        <div className="sheet-drag-handle" aria-hidden="true" />

        {/* Header */}
        <div className="modal-header-row">
          <div>
            <h2 className="modal-title">Внести операцию</h2>
            <p className="modal-subtitle">Оперативный ввод за 3 действия</p>
          </div>

          <button
            type="button"
            onClick={handleRequestClose}
            className="btn-modal-close"
            aria-label="Закрыть окно"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="quick-entry-form">
          {/* STEP 1: Type Selector */}
          <div className="entry-step-block">
            <span className="step-badge-indicator">Шаг 1: Тип операции</span>
            <div className="type-pills-row" role="radiogroup" aria-label="Тип операции">
              {/* Expense */}
              <button
                type="button"
                onClick={() => handleTypeChange('expense')}
                className={`type-pill pill-expense ${type === 'expense' ? 'pill-active' : ''}`}
                role="radio"
                aria-checked={type === 'expense'}
              >
                <ArrowDownRight size={16} aria-hidden="true" />
                <span>Расход</span>
              </button>

              {/* Income */}
              <button
                type="button"
                onClick={() => handleTypeChange('income')}
                className={`type-pill pill-income ${type === 'income' ? 'pill-active' : ''}`}
                role="radio"
                aria-checked={type === 'income'}
              >
                <ArrowUpRight size={16} aria-hidden="true" />
                <span>Доход</span>
              </button>

              {/* Transfer */}
              <button
                type="button"
                onClick={() => handleTypeChange('transfer')}
                className={`type-pill pill-transfer ${type === 'transfer' ? 'pill-active' : ''}`}
                role="radio"
                aria-checked={type === 'transfer'}
              >
                <ArrowLeftRight size={16} aria-hidden="true" />
                <span>Перевод</span>
              </button>
            </div>
          </div>

          {/* STEP 2: Amount & Keypad */}
          <div className="entry-step-block">
            <span className="step-badge-indicator">Шаг 2: Сумма операции</span>
            <NumericPad amount={amount} onAmountChange={setAmount} />
          </div>

          {/* STEP 3: Context Routing (Accounts & Categories & Event) */}
          <div className="entry-step-block">
            <span className="step-badge-indicator">Шаг 3: Счёт, статья и мероприятие</span>

            {/* Expense: Source Account */}
            {type === 'expense' && (
              <AccountChips
                id="account-chips-expense"
                label="Счёт списания:"
                selectedAccountId={fromAccountId}
                onSelectAccount={(accId) => {
                  setFromAccountId(accId);
                  setHighlightedField(null);
                  setValidationError(null);
                }}
                helperText="Откуда оплачено"
                hasError={highlightedField === 'fromAccount' || highlightedField === 'transferAccounts'}
              />
            )}

            {/* Income: Destination Account */}
            {type === 'income' && (
              <AccountChips
                id="account-chips-income"
                label="Счёт зачисления:"
                selectedAccountId={toAccountId}
                onSelectAccount={(accId) => {
                  setToAccountId(accId);
                  setHighlightedField(null);
                  setValidationError(null);
                }}
                helperText="Куда поступили деньги"
                hasError={highlightedField === 'toAccount' || highlightedField === 'transferAccounts'}
              />
            )}

            {/* Transfer: Both From & To Accounts with distinct validation */}
            {type === 'transfer' && (
              <div id="account-chips-transfer" className="transfer-accounts-group">
                <AccountChips
                  label="Откуда списать:"
                  selectedAccountId={fromAccountId}
                  onSelectAccount={(accId) => {
                    setFromAccountId(accId);
                    setHighlightedField(null);
                    setValidationError(null);
                  }}
                  disabledAccountId={toAccountId}
                  helperText="Исходный счёт"
                  hasError={highlightedField === 'fromAccount' || highlightedField === 'transferAccounts'}
                />

                <AccountChips
                  label="Куда зачислить:"
                  selectedAccountId={toAccountId}
                  onSelectAccount={(accId) => {
                    setToAccountId(accId);
                    setHighlightedField(null);
                    setValidationError(null);
                  }}
                  disabledAccountId={fromAccountId}
                  helperText="Целевой счёт (не может совпадать)"
                  hasError={highlightedField === 'toAccount' || highlightedField === 'transferAccounts'}
                />
              </div>
            )}

            {/* Expense Direction Selector */}
            {type === 'expense' && (
              <div className="direction-selection-container">
                <div className="field-block-label-row">
                  <span className="field-block-label">Направление расхода:</span>
                  <span className="field-block-hint">Категория затрат</span>
                </div>
                <div className="direction-pills-row" role="radiogroup" aria-label="Направление расхода">
                  <button
                    type="button"
                    onClick={() => handleDirectionChange('operational')}
                    className={`direction-pill ${direction === 'operational' ? 'pill-active' : ''}`}
                    role="radio"
                    aria-checked={direction === 'operational'}
                  >
                    <Calendar size={14} aria-hidden="true" />
                    <span>Мероприятие</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDirectionChange('business')}
                    className={`direction-pill ${direction === 'business' ? 'pill-active' : ''}`}
                    role="radio"
                    aria-checked={direction === 'business'}
                  >
                    <Briefcase size={14} aria-hidden="true" />
                    <span>Бизнес / Склад</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDirectionChange('dividends')}
                    className={`direction-pill ${direction === 'dividends' ? 'pill-active' : ''}`}
                    role="radio"
                    aria-checked={direction === 'dividends'}
                  >
                    <Users size={14} aria-hidden="true" />
                    <span>Дивиденды</span>
                  </button>
                </div>
              </div>
            )}

            {/* Partner Selection (for Dividends) */}
            {type === 'expense' && direction === 'dividends' && (
              <div className="partner-chips-container animate-fade-in">
                <div className="field-block-label-row">
                  <span className="field-block-label" style={{ color: 'var(--color-accent-strong)' }}>
                    Партнёр (кому выплата):
                  </span>
                </div>
                {partners.length === 0 ? (
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                    Нет активных партнёров. Добавьте их во вкладке «Настройки».
                  </p>
                ) : (
                  <div className="partner-chips-grid">
                    {partners.map((p) => {
                      const isSelected = selectedPartnerId === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedPartnerId(p.id)}
                          className={`partner-chip ${isSelected ? 'partner-chip-selected' : ''}`}
                        >
                          <Users size={13} aria-hidden="true" />
                          <span>{p.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Categories (Expense and Income only) */}
            {type !== 'transfer' && (
              <div className="category-selection-container">
                <div className="field-block-label-row">
                  <span className="field-block-label">Статья операции:</span>
                  <span className="field-block-hint">
                    {type === 'expense' ? 'Куда потрачено' : 'Источник дохода'}
                  </span>
                </div>
                <CategoryChips
                  type={type}
                  selectedCategoryId={categoryId}
                  onSelectCategory={setCategoryId}
                  isGeneralExpense={direction !== 'operational'}
                />
              </div>
            )}

            {/* Event selector (Operational Expense and Income only) */}
            {type !== 'transfer' && direction === 'operational' && (
              <EventSelector
                selectedEventId={selectedEventId}
                onSelectEventId={setSelectedEventId}
              />
            )}

            {/* Transaction Date Selector */}
            <div className="date-selection-container">
              <div className="field-block-label-row">
                <span className="field-block-label">Дата операции:</span>
                <span className="field-block-hint">
                  {selectedDate === getTodayDateStr()
                    ? 'Сегодня'
                    : selectedDate === getYesterdayDateStr()
                    ? 'Вчера'
                    : formatDateRu(selectedDate)}
                </span>
              </div>
              <div className="date-pills-row">
                <button
                  type="button"
                  onClick={() => setSelectedDate(getTodayDateStr())}
                  className={`date-preset-pill ${selectedDate === getTodayDateStr() ? 'pill-active' : ''}`}
                >
                  <span>Сегодня</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDate(getYesterdayDateStr())}
                  className={`date-preset-pill ${selectedDate === getYesterdayDateStr() ? 'pill-active' : ''}`}
                >
                  <span>Вчера</span>
                </button>
                <div
                  className={`date-input-wrapper ${
                    selectedDate !== getTodayDateStr() && selectedDate !== getYesterdayDateStr()
                      ? 'date-input-active'
                      : ''
                  }`}
                >
                  <Calendar size={14} className="date-input-icon" aria-hidden="true" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      if (e.target.value) setSelectedDate(e.target.value);
                    }}
                    className="date-native-input"
                    aria-label="Выбрать произвольную дату"
                  />
                </div>
              </div>
            </div>

            {/* Memo / comment description */}
            <div className="memo-field-wrapper">
              <div className="field-block-label-row">
                <label htmlFor="tx-memo-input" className="field-block-label">
                  Заметка / комментарий:
                </label>
                <span className="field-block-hint">Необязательно</span>
              </div>
              <div className="memo-input-container">
                <FileText size={16} className="memo-input-icon" aria-hidden="true" />
                <input
                  id="tx-memo-input"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Например: 10 мешков льда, такси двум барменам..."
                  className="memo-input"
                  maxLength={100}
                />
                {description && (
                  <button
                    type="button"
                    onClick={() => setDescription('')}
                    className="btn-memo-clear"
                    title="Очистить заметку"
                    aria-label="Очистить"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Validation Alert */}
          {validationError && (
            <div className="modal-validation-error animate-fade-in" role="alert">
              <AlertCircle size={16} className="shrink-0" aria-hidden="true" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Submit CTA */}
          <div className="modal-submit-sticky">
            <button
              type="submit"
              disabled={isSubmitting || amount <= 0}
              className={`btn-modal-submit submit-type-${type}`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                  <span>Сохранение...</span>
                </>
              ) : (
                <>
                  <Check size={18} aria-hidden="true" />
                  <span>{submitActionLabel}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

