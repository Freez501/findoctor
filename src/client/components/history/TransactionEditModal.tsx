/**
 * Truespace — Барный кейтеринг и финансы
 * Transaction Edit Modal Component (`src/client/components/history/TransactionEditModal.tsx`)
 *
 * Centered modal dialog to inspect and edit transaction properties:
 * - Category / Article attribution
 * - Event linkage (or general bar overhead)
 * - Source and destination accounts
 * - Amount and Date/Time
 * - Memo / Description
 * - Reversal / Deletion in 1 click
 */

import React, { useState, useEffect } from 'react';
import { X, Trash2, AlertCircle } from 'lucide-react';
import { Transaction, TransactionType } from '../../../shared/types.js';
import { useFinance } from '../../context/FinanceContext.js';

interface Props {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
}

export const TransactionEditModal: React.FC<Props> = ({ transaction, isOpen, onClose }) => {
  const { accounts, categories, events, partners, updateTransaction, deleteTransaction } = useFinance();

  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState<number>(0);
  const [fromAccountId, setFromAccountId] = useState<string>('');
  const [toAccountId, setToAccountId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [eventId, setEventId] = useState<string>('general');
  const [partnerId, setPartnerId] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [dateTimeStr, setDateTimeStr] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isConfirmDelete, setIsConfirmDelete] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (transaction) {
      setType(transaction.type);
      setAmount(transaction.amount);
      setFromAccountId(transaction.fromAccountId || '');
      setToAccountId(transaction.toAccountId || '');
      setCategoryId(transaction.categoryId || '');
      setEventId(transaction.eventId || 'general');
      setPartnerId(transaction.partnerId || '');
      setDescription(transaction.description || '');

      try {
        const d = new Date(transaction.transactionDate);
        const pad = (n: number) => String(n).padStart(2, '0');
        const localIso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        setDateTimeStr(localIso);
      } catch {
        setDateTimeStr(new Date().toISOString().slice(0, 16));
      }

      setIsConfirmDelete(false);
      setError(null);
    }
  }, [transaction]);

  if (!isOpen || !transaction) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      setError('Сумма должна быть больше 0 ₽');
      return;
    }
    if (type === 'expense' && !fromAccountId) {
      setError('Выберите счёт списания');
      return;
    }
    if (type === 'income' && !toAccountId) {
      setError('Выберите счёт зачисления');
      return;
    }
    if (type === 'transfer') {
      if (!fromAccountId || !toAccountId) {
        setError('Укажите оба счёта для перевода');
        return;
      }
      if (fromAccountId === toAccountId) {
        setError('Счета списания и зачисления должны отличаться');
        return;
      }
    }

    setIsSaving(true);
    setError(null);

    let parsedIsoDate = transaction.transactionDate;
    if (dateTimeStr) {
      try {
        parsedIsoDate = new Date(dateTimeStr).toISOString();
      } catch {
        // keep old
      }
    }

    const res = await updateTransaction(transaction.id, {
      type,
      amount,
      fromAccountId: type === 'income' ? null : fromAccountId,
      toAccountId: type === 'expense' ? null : toAccountId,
      categoryId,
      eventId: eventId === 'general' ? null : eventId,
      partnerId: partnerId || null,
      description: description.trim(),
      transactionDate: parsedIsoDate,
      needsReview: false, // User explicitly reviewed and saved!
    });

    setIsSaving(false);
    if (res.success) {
      onClose();
    } else {
      setError(res.error || 'Ошибка при сохранении операции');
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const res = await deleteTransaction(transaction.id);
    setIsDeleting(false);
    if (res.success) {
      onClose();
    } else {
      setError(res.error || 'Ошибка при удалении операции');
    }
  };

  return (
    <div className="modal-backdrop-centered" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="settings-modal-dialog"
        style={{ maxWidth: '520px', width: '92%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header-row">
          <div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--foreground)' }}>
              Редактирование операции
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
              Корректировка статьи, мероприятия и суммы
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-modal-close"
            aria-label="Закрыть модальное окно"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
          {error && (
            <div className="modal-validation-error">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {/* Type Segmented Tabs */}
          <div>
            <label className="modal-label" style={{ marginBottom: '6px' }}>Тип операции</label>
            <div className="filter-type-tabs" style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <button
                type="button"
                onClick={() => setType('expense')}
                className={`filter-type-pill ${type === 'expense' ? 'filter-type-pill-active' : ''}`}
              >
                Расход
              </button>
              <button
                type="button"
                onClick={() => setType('income')}
                className={`filter-type-pill ${type === 'income' ? 'filter-type-pill-active' : ''}`}
              >
                Доход
              </button>
              <button
                type="button"
                onClick={() => setType('transfer')}
                className={`filter-type-pill ${type === 'transfer' ? 'filter-type-pill-active' : ''}`}
              >
                Перевод
              </button>
            </div>
          </div>

          {/* Amount & Date/Time in 2 columns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="modal-label">Сумма (₽)</label>
              <input
                type="number"
                min="1"
                step="any"
                value={amount || ''}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                className="modal-input"
                style={{ fontWeight: 700, fontSize: '1.05rem' }}
                required
              />
            </div>
            <div>
              <label className="modal-label">Дата и время</label>
              <input
                type="datetime-local"
                value={dateTimeStr}
                onChange={(e) => setDateTimeStr(e.target.value)}
                className="modal-input"
                style={{ fontSize: '0.8rem' }}
                required
              />
            </div>
          </div>

          {/* Account Selection */}
          {type === 'transfer' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="modal-label">Откуда (списать)</label>
                <select
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  className="modal-select"
                  required
                >
                  <option value="">Выберите счёт</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="modal-label">Куда (зачислить)</label>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="modal-select"
                  required
                >
                  <option value="">Выберите счёт</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className="modal-label">
                {type === 'expense' ? 'Счёт списания' : 'Счёт зачисления'}
              </label>
              <select
                value={type === 'expense' ? fromAccountId : toAccountId}
                onChange={(e) => {
                  if (type === 'expense') setFromAccountId(e.target.value);
                  else setToAccountId(e.target.value);
                }}
                className="modal-select"
                required
              >
                <option value="">Выберите счёт</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Category & Event in 2 columns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="modal-label">Статья (категория)</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="modal-select"
                required
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="modal-label">Мероприятие</label>
              <select
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="modal-select"
              >
                <option value="general">Общие расходы бара</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Partner Attribution (optional) */}
          {partners && partners.length > 0 && (
            <div>
              <label className="modal-label">Партнёр / Соучредитель (опционально)</label>
              <select
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
                className="modal-select"
              >
                <option value="">Без привязки к партнёру</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.role ? `(${p.role})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Description Memo */}
          <div>
            <label className="modal-label">Назначение / Комментарий</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Например: Закупка мяты и лаймов в Метро"
              className="modal-input"
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', paddingTop: '12px', borderTop: '1px solid var(--border)', marginTop: '4px' }}>
            {isConfirmDelete ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--destructive)', fontWeight: 600 }}>
                  Точно удалить?
                </span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="btn-confirm-yes"
                  style={{ padding: '6px 12px' }}
                >
                  {isDeleting ? '...' : 'Да, удалить'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmDelete(false)}
                  className="btn-confirm-no"
                  style={{ padding: '6px 12px' }}
                >
                  Отмена
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsConfirmDelete(true)}
                className="btn-modal-danger"
                title="Удалить / отменить операцию с пересчётом баланса"
              >
                <Trash2 size={14} />
                <span>Удалить</span>
              </button>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={onClose}
                className="btn-modal-secondary"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="btn-modal-primary"
              >
                {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransactionEditModal;
