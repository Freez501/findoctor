import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, CheckCircle2, Clock, AlertTriangle, ArrowDownLeft, Calendar } from 'lucide-react';
import { CateringEvent, EventPaymentMilestone } from '../../../shared/types.js';
import { useFinance } from '../../context/FinanceContext.js';
import { api } from '../../api/apiClient.js';
import { formatRubles, formatDateRu } from '../../utils/formatters.js';

interface EventMilestonesTabProps {
  event: CateringEvent;
  onMilestonesUpdated?: () => void;
}

export const EventMilestonesTab: React.FC<EventMilestonesTabProps> = ({ event, onMilestonesUpdated }) => {
  const { accounts, addToast, refreshAccounts, refreshTransactions, refreshEvents } = useFinance();
  const [milestones, setMilestones] = useState<EventPaymentMilestone[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingMilestone, setEditingMilestone] = useState<EventPaymentMilestone | null>(null);

  // Receive modal state
  const [receivingMilestone, setReceivingMilestone] = useState<EventPaymentMilestone | null>(null);
  const [receiveAmount, setReceiveAmount] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('bank_1');
  const [isReceiving, setIsReceiving] = useState<boolean>(false);

  // Form inputs
  const [title, setTitle] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>(event.eventDate || '');
  const [status, setStatus] = useState<'pending' | 'received' | 'overdue'>('pending');
  const [notes, setNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const loadMilestones = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.getMilestones(event.id);
      setMilestones(res.milestones || []);
    } catch (err: any) {
      addToast(err.message || 'Ошибка загрузки графика оплат', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [event.id, addToast]);

  useEffect(() => {
    loadMilestones();
  }, [loadMilestones]);

  const totals = React.useMemo(() => {
    let totalScheduled = 0;
    let totalReceived = 0;
    let totalPending = 0;

    milestones.forEach((m) => {
      totalScheduled += m.amount;
      if (m.status === 'received') {
        totalReceived += m.paidAmount || m.amount;
      } else {
        totalPending += m.amount;
      }
    });

    const contractAmount = event.contractAmount || totalScheduled;
    const unscheduled = Math.max(0, contractAmount - totalScheduled);

    return { totalScheduled, totalReceived, totalPending, contractAmount, unscheduled };
  }, [milestones, event.contractAmount]);

  const handleOpenCreate = () => {
    setEditingMilestone(null);
    setTitle('Транш оплаты');
    setAmount(totals.unscheduled > 0 ? String(totals.unscheduled) : '');
    setDueDate(event.eventDate || '');
    setStatus('pending');
    setNotes('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (m: EventPaymentMilestone) => {
    setEditingMilestone(m);
    setTitle(m.title);
    setAmount(String(m.amount));
    setDueDate(m.dueDate);
    setStatus(m.status);
    setNotes(m.notes || '');
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!title.trim()) {
      addToast('Укажите название этапа оплаты', 'error');
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      addToast('Укажите корректную сумму этапа', 'error');
      return;
    }

    setIsSaving(true);
    try {
      if (editingMilestone) {
        await api.updateMilestone(event.id, editingMilestone.id, {
          title: title.trim(),
          amount: parsedAmount,
          dueDate,
          status,
          notes: notes.trim() || undefined,
        });
        addToast('Этап обновлен', 'success');
      } else {
        await api.createMilestone(event.id, {
          title: title.trim(),
          amount: parsedAmount,
          dueDate,
          status,
          notes: notes.trim() || undefined,
        });
        addToast('Этап добавлен в график', 'success');
      }
      setIsFormOpen(false);
      await loadMilestones();
      onMilestonesUpdated?.();
    } catch (err: any) {
      addToast(err.message || 'Ошибка сохранения этапа', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Удалить этап из графика?')) return;
    try {
      await api.deleteMilestone(event.id, id);
      addToast('Этап удален', 'info');
      await loadMilestones();
      onMilestonesUpdated?.();
    } catch (err: any) {
      addToast(err.message || 'Ошибка удаления этапа', 'error');
    }
  };

  const handleOpenReceive = (m: EventPaymentMilestone) => {
    setReceivingMilestone(m);
    setReceiveAmount(String(m.amount));
    setSelectedAccountId(accounts[0]?.id || 'bank_1');
  };

  const handleExecuteReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingMilestone) return;

    const parsedAmount = parseFloat(receiveAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      addToast('Укажите корректную сумму прихода', 'error');
      return;
    }

    setIsReceiving(true);
    try {
      // 1. Create income transaction linked to event
      await api.createTransaction({
        type: 'income',
        amount: parsedAmount,
        toAccountId: selectedAccountId,
        eventId: event.id,
        categoryId: 'cat_bar_catering', // default catering revenue
        description: `Оплата от заказчика: ${receivingMilestone.title} (${event.title})`,
        transactionDate: new Date().toISOString(),
      });

      // 2. Mark milestone as received
      await api.updateMilestone(event.id, receivingMilestone.id, {
        status: 'received',
        paidAmount: parsedAmount,
        paidDate: new Date().toISOString().split('T')[0],
      });

      addToast(`Принята оплата ${formatRubles(parsedAmount)} по этапу "${receivingMilestone.title}"`, 'success');
      setReceivingMilestone(null);
      await Promise.all([loadMilestones(), refreshAccounts(), refreshTransactions(), refreshEvents()]);
      onMilestonesUpdated?.();
    } catch (err: any) {
      addToast(err.message || 'Ошибка проведения прихода', 'error');
    } finally {
      setIsReceiving(false);
    }
  };

  return (
    <div className="dossier-tab-content">
      {/* Summary KPI Cards */}
      <div className="dossier-kpi-grid">
        <div className="dossier-kpi-card">
          <span className="dossier-kpi-label">Сумма договора</span>
          <span className="dossier-kpi-val">{formatRubles(totals.contractAmount)}</span>
        </div>
        <div className="dossier-kpi-card">
          <span className="dossier-kpi-label">Фактически получено</span>
          <span className="dossier-kpi-val val-green">{formatRubles(totals.totalReceived)}</span>
        </div>
        <div className="dossier-kpi-card">
          <span className="dossier-kpi-label">Ожидается к поступлению</span>
          <span
            className="dossier-kpi-val"
            style={{ color: totals.totalPending > 0 ? '#d97706' : 'var(--muted-foreground)' }}
          >
            {formatRubles(totals.totalPending)}
          </span>
        </div>
      </div>

      {/* Header Actions */}
      <div className="dossier-section-header">
        <h4 className="dossier-section-title">График платежей и траншей от заказчика</h4>
        <button type="button" onClick={handleOpenCreate} className="btn-dossier-primary">
          <Plus size={15} />
          <span>Добавить этап</span>
        </button>
      </div>

      {/* Quick Receive Modal */}
      {receivingMilestone && (
        <div className="dossier-submodal-overlay">
          <div className="dossier-submodal-card">
            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
              Принять оплату: {receivingMilestone.title}
            </h4>
            <p style={{ margin: '4px 0 16px', fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
              Сумма транша: <strong>{formatRubles(receivingMilestone.amount)}</strong>
            </p>

            <form onSubmit={handleExecuteReceive}>
              <div className="settings-input-group" style={{ marginBottom: '12px' }}>
                <label className="settings-input-label">Счет зачисления *</label>
                <select
                  className="settings-text-input"
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  required
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatRubles(acc.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="settings-input-group" style={{ marginBottom: '16px' }}>
                <label className="settings-input-label">Фактически поступило (₽) *</label>
                <input
                  type="number"
                  step="any"
                  required
                  className="settings-text-input"
                  value={receiveAmount}
                  onChange={(e) => setReceiveAmount(e.target.value)}
                />
              </div>

              <div className="settings-form-actions">
                <button
                  type="button"
                  onClick={() => setReceivingMilestone(null)}
                  className="btn-form-cancel"
                >
                  Отмена
                </button>
                <button type="submit" disabled={isReceiving} className="btn-form-submit">
                  {isReceiving ? 'Зачисление...' : `Принять ${formatRubles(parseFloat(receiveAmount) || 0)}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Form */}
      {isFormOpen && (
        <form onSubmit={handleSave} className="dossier-form-card">
          <h5 className="dossier-form-title">
            {editingMilestone ? 'Редактировать этап графика' : 'Новый транш оплаты'}
          </h5>
          <div className="dossier-form-grid">
            <div className="settings-input-group">
              <label className="settings-input-label">Название этапа *</label>
              <input
                type="text"
                required
                placeholder="Аванс 30% (бронь даты)"
                className="settings-text-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="settings-input-group">
              <label className="settings-input-label">Сумма этапа (₽) *</label>
              <input
                type="number"
                step="any"
                required
                placeholder="100000"
                className="settings-text-input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="settings-input-group">
              <label className="settings-input-label">Дата платежа *</label>
              <input
                type="date"
                required
                className="settings-text-input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="settings-input-group">
              <label className="settings-input-label">Статус этапа</label>
              <select
                className="settings-text-input"
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
              >
                <option value="pending">Ожидается к оплате</option>
                <option value="received">Получен (оплачен)</option>
                <option value="overdue">Просрочен</option>
              </select>
            </div>

            <div className="settings-input-group" style={{ gridColumn: '1 / -1' }}>
              <label className="settings-input-label">Примечание</label>
              <input
                type="text"
                placeholder="Условия транша, номер счета заказчика..."
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
              {isSaving ? 'Сохранение...' : editingMilestone ? 'Сохранить' : 'Добавить'}
            </button>
          </div>
        </form>
      )}

      {/* Milestones Timeline / Table */}
      {isLoading ? (
        <div className="dossier-loading">Загрузка графика платежей...</div>
      ) : milestones.length === 0 ? (
        <div className="dossier-empty-state">
          <Calendar size={32} style={{ color: 'var(--muted-foreground)', opacity: 0.5 }} />
          <p>В этом мероприятии пока нет разбивки на этапы оплаты.</p>
          <button type="button" onClick={handleOpenCreate} className="btn-dossier-secondary">
            <Plus size={14} /> Создать график траншей (Аванс, Расчет)
          </button>
        </div>
      ) : (
        <div className="dossier-milestones-list">
          {milestones.map((m) => {
            const isReceived = m.status === 'received';
            const isOverdue = m.status === 'overdue';

            return (
              <div key={m.id} className={`dossier-milestone-item ${isReceived ? 'item-received' : isOverdue ? 'item-overdue' : ''}`}>
                <div className="dossier-milestone-marker">
                  {isReceived ? (
                    <CheckCircle2 size={18} color="#059669" />
                  ) : isOverdue ? (
                    <AlertTriangle size={18} color="#dc2626" />
                  ) : (
                    <Clock size={18} color="#d97706" />
                  )}
                </div>

                <div className="dossier-milestone-body">
                  <div className="dossier-milestone-top">
                    <div>
                      <h5 className="dossier-milestone-title">{m.title}</h5>
                      <span className="dossier-milestone-date">
                        Срок: <strong>{formatDateRu(m.dueDate)}</strong>
                        {m.paidDate && isReceived && ` • Оплачено ${formatDateRu(m.paidDate)}`}
                      </span>
                    </div>

                    <div className="dossier-milestone-amount-box">
                      <span className="dossier-milestone-sum">{formatRubles(m.amount)}</span>
                      <span
                        className={`dossier-vendor-badge ${
                          isReceived ? 'badge-paid' : isOverdue ? 'badge-danger' : 'badge-pending'
                        }`}
                      >
                        {isReceived ? 'Получен' : isOverdue ? 'Просрочен' : 'Ожидается'}
                      </span>
                    </div>
                  </div>

                  {m.notes && <div className="dossier-item-notes">{m.notes}</div>}

                  <div className="dossier-milestone-actions">
                    {!isReceived && (
                      <button
                        type="button"
                        onClick={() => handleOpenReceive(m)}
                        className="btn-milestone-receive"
                      >
                        <ArrowDownLeft size={14} />
                        <span>Принять оплату</span>
                      </button>
                    )}

                    <div className="dossier-milestone-controls">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(m)}
                        className="btn-icon-tiny"
                        title="Редактировать этап"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(m.id)}
                        className="btn-icon-tiny btn-danger-tiny"
                        title="Удалить этап"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
