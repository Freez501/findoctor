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
import { X, ArrowDownRight, ArrowUpRight, ArrowLeftRight, Check, Loader2, AlertCircle } from 'lucide-react';
import { TransactionType } from '../../../shared/types.js';
import { DEFAULT_ACCOUNT_ID, DEFAULT_EXPENSE_CATEGORY_ID, DEFAULT_INCOME_CATEGORY_ID, CATEGORY_IDS, EVENT_IDS } from '../../../shared/constants.js';
import { useFinance } from '../../context/FinanceContext.js';
import { formatRubles } from '../../utils/formatters.js';
import { NumericPad } from './NumericPad.js';
import { CategoryChips } from './CategoryChips.js';
import { AccountChips } from './AccountChips.js';
import { EventSelector } from './EventSelector.js';

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
  const { createTransaction } = useFinance();

  // Form State
  const [type, setType] = useState<TransactionType>(initialType);
  const [amount, setAmount] = useState<number>(0);
  const [fromAccountId, setFromAccountId] = useState<string>(initialAccountId || DEFAULT_ACCOUNT_ID);
  const [toAccountId, setToAccountId] = useState<string>('cash_2');
  const [categoryId, setCategoryId] = useState<string>(DEFAULT_EXPENSE_CATEGORY_ID);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(EVENT_IDS.WEDDING);
  const [isGeneralExpense, setIsGeneralExpense] = useState<boolean>(false);
  const [description, setDescription] = useState<string>('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Sync initial account when opened
  useEffect(() => {
    if (initialAccountId) {
      setFromAccountId(initialAccountId);
    }
  }, [initialAccountId]);

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

    if (newType === 'expense') {
      setCategoryId(DEFAULT_EXPENSE_CATEGORY_ID);
      if (!fromAccountId) setFromAccountId(DEFAULT_ACCOUNT_ID);
    } else if (newType === 'income') {
      setCategoryId(DEFAULT_INCOME_CATEGORY_ID);
      if (!toAccountId) setToAccountId(DEFAULT_ACCOUNT_ID);
    } else if (newType === 'transfer') {
      setCategoryId(CATEGORY_IDS.TRANSFER_INTERNAL);
      setSelectedEventId(null);
      setIsGeneralExpense(false);
      // Ensure from and to accounts are distinct
      if (fromAccountId === toAccountId) {
        setToAccountId(fromAccountId === 'cash_1' ? 'cash_2' : 'cash_1');
      }
    }
  };

  // Keyboard escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validation
    if (amount <= 0) {
      setValidationError('Введите сумму операции больше 0 ₽.');
      return;
    }

    if (type === 'expense' && !fromAccountId) {
      setValidationError('Пожалуйста, выберите счёт списания.');
      return;
    }

    if (type === 'income' && !toAccountId) {
      setValidationError('Пожалуйста, выберите счёт зачисления.');
      return;
    }

    if (type === 'transfer') {
      if (!fromAccountId || !toAccountId) {
        setValidationError('Выберите счёт списания и счёт зачисления.');
        return;
      }
      if (fromAccountId === toAccountId) {
        setValidationError('Счёт списания и счёт зачисления не могут совпадать.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const result = await createTransaction({
        type,
        amount,
        fromAccountId: type === 'income' ? null : fromAccountId,
        toAccountId: type === 'expense' ? null : toAccountId,
        categoryId: type === 'transfer' ? CATEGORY_IDS.TRANSFER_INTERNAL : categoryId,
        eventId: type === 'transfer' || isGeneralExpense ? null : selectedEventId,
        description: description.trim(),
      });

      if (result.success) {
        // Reset form and close
        setAmount(0);
        setDescription('');
        onClose();
      } else {
        setValidationError(result.error || 'Ошибка при сохранении операции');
      }
    } finally {
      setIsSubmitting(false);
    }
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
    <div className="modal-backdrop animate-fade-in" onClick={onClose} role="presentation">
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
            onClick={onClose}
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
                label="Счёт списания:"
                selectedAccountId={fromAccountId}
                onSelectAccount={setFromAccountId}
                helperText="Откуда оплачено"
              />
            )}

            {/* Income: Destination Account */}
            {type === 'income' && (
              <AccountChips
                label="Счёт зачисления:"
                selectedAccountId={toAccountId}
                onSelectAccount={setToAccountId}
                helperText="Куда поступили деньги"
              />
            )}

            {/* Transfer: Both From & To Accounts with distinct validation */}
            {type === 'transfer' && (
              <div className="transfer-accounts-group">
                <AccountChips
                  label="Откуда списать:"
                  selectedAccountId={fromAccountId}
                  onSelectAccount={setFromAccountId}
                  disabledAccountId={toAccountId}
                  helperText="Исходный счёт"
                />

                <AccountChips
                  label="Куда зачислить:"
                  selectedAccountId={toAccountId}
                  onSelectAccount={setToAccountId}
                  disabledAccountId={fromAccountId}
                  helperText="Целевой счёт (не может совпадать)"
                />
              </div>
            )}

            {/* Categories (Expense and Income only) */}
            {type !== 'transfer' && (
              <div className="category-selection-container">
                <span className="field-block-label">Статья операции:</span>
                <CategoryChips
                  type={type}
                  selectedCategoryId={categoryId}
                  onSelectCategory={setCategoryId}
                  isGeneralExpense={isGeneralExpense}
                />
              </div>
            )}

            {/* Event selector (Expense and Income only) */}
            {type !== 'transfer' && (
              <EventSelector
                selectedEventId={selectedEventId}
                onSelectEventId={setSelectedEventId}
                isGeneralExpense={isGeneralExpense}
                onToggleGeneralExpense={setIsGeneralExpense}
              />
            )}

            {/* Optional memo description */}
            <div className="memo-field-wrapper">
              <label htmlFor="tx-memo-input" className="field-block-label">
                Заметка / комментарий (необязательно):
              </label>
              <input
                id="tx-memo-input"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Например: 10 мешков льда, такси двум барменам..."
                className="memo-input"
                maxLength={100}
              />
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
