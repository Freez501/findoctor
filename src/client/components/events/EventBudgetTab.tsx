import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Edit2, Trash2, AlertTriangle, DollarSign } from 'lucide-react';
import { CateringEvent, EventBudgetItem } from '../../../shared/types.js';
import { useFinance } from '../../context/FinanceContext.js';
import { api } from '../../api/apiClient.js';
import { formatRubles } from '../../utils/formatters.js';

interface EventBudgetTabProps {
  event: CateringEvent;
  onBudgetUpdated?: () => void;
}

export const EventBudgetTab: React.FC<EventBudgetTabProps> = ({ event, onBudgetUpdated }) => {
  const { categories, transactions, addToast } = useFinance();
  const [budgetItems, setBudgetItems] = useState<EventBudgetItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<EventBudgetItem | null>(null);

  // Form state
  const [categoryId, setCategoryId] = useState<string>('');
  const [plannedAmount, setPlannedAmount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Load budget items for this event
  const loadBudget = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.getBudgetItems(event.id);
      setBudgetItems(res.budgetItems || []);
    } catch (err: any) {
      addToast(err.message || 'Ошибка загрузки сметы', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [event.id, addToast]);

  useEffect(() => {
    loadBudget();
  }, [loadBudget]);

  // Compute actual spent per category from real transactions for this event
  const actualByCategory = useMemo(() => {
    const map = new Map<string, number>();
    transactions.forEach((tx) => {
      if (tx.eventId === event.id && tx.type === 'expense') {
        const current = map.get(tx.categoryId) || 0;
        map.set(tx.categoryId, current + tx.amount);
      }
    });
    return map;
  }, [transactions, event.id]);

  // Aggregate totals
  const totals = useMemo(() => {
    let totalPlanned = 0;
    let totalActual = 0;

    budgetItems.forEach((b) => {
      totalPlanned += b.plannedAmount;
      const actual = actualByCategory.get(b.categoryId) || 0;
      totalActual += actual;
    });

    // Check if there are expenses in categories not explicitly in budget
    actualByCategory.forEach((actual, catId) => {
      const inBudget = budgetItems.some((b) => b.categoryId === catId);
      if (!inBudget) {
        totalActual += actual;
      }
    });

    const diff = totalPlanned - totalActual;
    const isOverbudget = totalActual > totalPlanned && totalPlanned > 0;
    const progressPercent = totalPlanned > 0 ? Math.min(200, Math.round((totalActual / totalPlanned) * 100)) : 0;

    return { totalPlanned, totalActual, diff, isOverbudget, progressPercent };
  }, [budgetItems, actualByCategory]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    // Default to first expense category not yet in budget
    const usedCatIds = new Set(budgetItems.map((b) => b.categoryId));
    const available = categories.find((c) => c.type === 'expense' && !usedCatIds.has(c.id));
    setCategoryId(available ? available.id : categories[0]?.id || '');
    setPlannedAmount('');
    setNotes('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (item: EventBudgetItem) => {
    setEditingItem(item);
    setCategoryId(item.categoryId);
    setPlannedAmount(String(item.plannedAmount));
    setNotes(item.notes || '');
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(plannedAmount);
    if (isNaN(amount) || amount <= 0) {
      addToast('Укажите корректную сумму статьи сметы', 'error');
      return;
    }
    if (!categoryId) {
      addToast('Выберите категорию расходов', 'error');
      return;
    }

    setIsSaving(true);
    try {
      await api.saveBudgetItem(event.id, {
        id: editingItem?.id,
        categoryId,
        plannedAmount: amount,
        notes: notes.trim() || undefined,
      });
      addToast(editingItem ? 'Статья сметы обновлена' : 'Статья добавлена в смету', 'success');
      setIsFormOpen(false);
      await loadBudget();
      onBudgetUpdated?.();
    } catch (err: any) {
      addToast(err.message || 'Ошибка сохранения статьи сметы', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Удалить статью из сметы?')) return;
    try {
      await api.deleteBudgetItem(event.id, id);
      addToast('Статья удалена из сметы', 'info');
      await loadBudget();
      onBudgetUpdated?.();
    } catch (err: any) {
      addToast(err.message || 'Ошибка удаления статьи', 'error');
    }
  };

  return (
    <div className="dossier-tab-content">
      {/* Summary KPI Cards */}
      <div className="dossier-kpi-grid">
        <div className="dossier-kpi-card">
          <span className="dossier-kpi-label">Заложено в смету (План)</span>
          <span className="dossier-kpi-val">{formatRubles(totals.totalPlanned)}</span>
        </div>
        <div className="dossier-kpi-card">
          <span className="dossier-kpi-label">Фактические расходы</span>
          <span className="dossier-kpi-val" style={{ color: totals.isOverbudget ? '#dc2626' : 'var(--foreground)' }}>
            {formatRubles(totals.totalActual)}
          </span>
        </div>
        <div className="dossier-kpi-card">
          <span className="dossier-kpi-label">
            {totals.diff >= 0 ? 'Остаток лимита' : 'Перерасход бюджета'}
          </span>
          <span
            className="dossier-kpi-val"
            style={{ color: totals.diff >= 0 ? 'var(--color-success)' : '#dc2626' }}
          >
            {totals.diff >= 0 ? `+${formatRubles(totals.diff)}` : formatRubles(totals.diff)}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      {totals.totalPlanned > 0 && (
        <div className="dossier-progress-box">
          <div className="dossier-progress-header">
            <span>Использование сметы: <strong>{totals.progressPercent}%</strong></span>
            {totals.isOverbudget && (
              <span className="dossier-badge-overbudget">
                <AlertTriangle size={13} />
                Лимит превышен на {formatRubles(Math.abs(totals.diff))}
              </span>
            )}
          </div>
          <div className="event-progress-bar" style={{ height: '8px' }}>
            <div
              className="event-progress-fill"
              style={{
                width: `${Math.min(100, totals.progressPercent)}%`,
                backgroundColor: totals.isOverbudget ? '#dc2626' : totals.progressPercent > 85 ? '#d97706' : '#059669',
              }}
            />
          </div>
        </div>
      )}

      {/* Action Header */}
      <div className="dossier-section-header">
        <h4 className="dossier-section-title">Статьи расходов проекта</h4>
        <button type="button" onClick={handleOpenCreate} className="btn-dossier-primary">
          <Plus size={15} />
          <span>Добавить статью</span>
        </button>
      </div>

      {/* Add / Edit Form Modal/Card */}
      {isFormOpen && (
        <form onSubmit={handleSave} className="dossier-form-card">
          <h5 className="dossier-form-title">
            {editingItem ? 'Редактировать статью сметы' : 'Новая статья в смете'}
          </h5>
          <div className="dossier-form-grid">
            <div className="settings-input-group">
              <label className="settings-input-label">Категория расхода *</label>
              <select
                className="settings-text-input"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
              >
                {categories
                  .filter((c) => c.type === 'expense')
                  .map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="settings-input-group">
              <label className="settings-input-label">Запланированная сумма (₽) *</label>
              <input
                type="number"
                step="any"
                required
                placeholder="50000"
                className="settings-text-input"
                value={plannedAmount}
                onChange={(e) => setPlannedAmount(e.target.value)}
              />
            </div>
            <div className="settings-input-group" style={{ gridColumn: '1 / -1' }}>
              <label className="settings-input-label">Примечание к статье</label>
              <input
                type="text"
                placeholder="Например: аренда посуды, закупка алкоголя на 80 гостей..."
                className="settings-text-input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <div className="settings-form-actions">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="btn-form-cancel"
            >
              Отмена
            </button>
            <button type="submit" disabled={isSaving} className="btn-form-submit">
              {isSaving ? 'Сохранение...' : editingItem ? 'Сохранить' : 'Добавить'}
            </button>
          </div>
        </form>
      )}

      {/* Budget Items Table */}
      {isLoading ? (
        <div className="dossier-loading">Загрузка сметы мероприятия...</div>
      ) : budgetItems.length === 0 ? (
        <div className="dossier-empty-state">
          <DollarSign size={32} style={{ color: 'var(--muted-foreground)', opacity: 0.5 }} />
          <p>В смете пока нет запланированных статей расходов.</p>
          <button type="button" onClick={handleOpenCreate} className="btn-dossier-secondary">
            <Plus size={14} /> Добавить первую статью (бар, декор, аренда)
          </button>
        </div>
      ) : (
        <div className="dossier-table-container">
          <table className="dossier-table">
            <thead>
              <tr>
                <th>Статья расхода</th>
                <th style={{ textAlign: 'right' }}>План</th>
                <th style={{ textAlign: 'right' }}>Факт</th>
                <th style={{ textAlign: 'right' }}>Отклонение</th>
                <th style={{ textAlign: 'center' }}>%</th>
                <th style={{ textAlign: 'right' }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {budgetItems.map((item) => {
                const cat = categories.find((c) => c.id === item.categoryId);
                const actual = actualByCategory.get(item.categoryId) || 0;
                const diff = item.plannedAmount - actual;
                const isOver = actual > item.plannedAmount;
                const percent = item.plannedAmount > 0 ? Math.round((actual / item.plannedAmount) * 100) : 0;

                return (
                  <tr key={item.id} className={isOver ? 'row-overbudget' : ''}>
                    <td>
                      <div className="dossier-item-cat-name">
                        <span className="dossier-cat-dot" style={{ backgroundColor: cat?.color || '#8a8580' }} />
                        <strong>{cat?.name || 'Без категории'}</strong>
                      </div>
                      {item.notes && <div className="dossier-item-notes">{item.notes}</div>}
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {formatRubles(item.plannedAmount)}
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {formatRubles(actual)}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 600,
                        color: isOver ? '#dc2626' : 'var(--color-success)',
                      }}
                    >
                      {diff >= 0 ? `+${formatRubles(diff)}` : formatRubles(diff)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`dossier-percent-badge ${isOver ? 'percent-danger' : percent > 85 ? 'percent-warning' : 'percent-ok'}`}>
                        {percent}%
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="dossier-row-actions">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className="btn-icon-tiny"
                          title="Редактировать статью"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="btn-icon-tiny btn-danger-tiny"
                          title="Удалить статью"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
