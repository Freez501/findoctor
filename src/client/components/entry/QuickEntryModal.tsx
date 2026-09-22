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
import { DEFAULT_ACCOUNT_ID, DEFAULT_EXPENSE_CATEGORY_ID, DEFAULT_INCOME_CATEGORY_ID, CATEGORY_IDS, EVENT_IDS } from '../../../shared/constants.js';
import { useFinance } from '../../context/FinanceContext.js';
import { useAuth } from '../../context/AuthContext.js';
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
  const { createTransaction, partners } = useFinance();
  const { currentUser, currentCompany } = useAuth();

  // Form State
  const [type, setType] = useState<TransactionType>(initialType);
  const [direction, setDirection] = useState<TransactionDirection>('operational');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [fromAccountId, setFromAccountId] = useState<string>(initialAccountId || DEFAULT_ACCOUNT_ID);
  const [toAccountId, setToAccountId] = useState<string>('cash_2');
  const [categoryId, setCategoryId] = useState<string>(DEFAULT_EXPENSE_CATEGORY_ID);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(EVENT_IDS.WEDDING);
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
      setDirection('operational');
      if (!fromAccountId) setFromAccountId(DEFAULT_ACCOUNT_ID);
    } else if (newType === 'income') {
      setCategoryId(DEFAULT_INCOME_CATEGORY_ID);
      setDirection('operational');
      if (!toAccountId) setToAccountId(DEFAULT_ACCOUNT_ID);
    } else if (newType === 'transfer') {
      setCategoryId(CATEGORY_IDS.TRANSFER_INTERNAL);
      setDirection('transfer');
      setSelectedEventId(null);
      // Ensure from and to accounts are distinct
      if (fromAccountId === toAccountId) {
        setToAccountId(fromAccountId === 'cash_1' ? 'cash_2' : 'cash_1');
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

  // Safe backdrop click handler preventing accidental close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      if (amount > 0) {
        if (window.confirm('Вы уже указали сумму. Закрыть окно ввода без сохранения?')) {
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

    if (type === 'expense' && direction === 'dividends' && !selectedPartnerId) {
      setValidationError('Пожалуйста, выберите партнёра для выплаты дивидендов.');
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
      const selectedPartner = partners.find((p) => p.id === selectedPartnerId);
      const result = await createTransaction({
        type,
        direction: type === 'transfer' ? 'transfer' : direction,
        amount,
        fromAccountId: type === 'income' ? null : fromAccountId,
        toAccountId: type === 'expense' ? null : toAccountId,
        categoryId: type === 'transfer' ? CATEGORY_IDS.TRANSFER_INTERNAL : categoryId,
        eventId: type === 'transfer' || direction !== 'operational' ? null : selectedEventId,
        partnerId: direction === 'dividends' ? selectedPartnerId : null,
        partnerName: direction === 'dividends' && selectedPartner ? selectedPartner.name : null,
        description: description.trim(),
        createdBy: currentUser?.fullName || currentUser?.email || 'Никита',
        companyId: currentCompany?.id,
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

