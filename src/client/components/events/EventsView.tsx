/**
 * Truespace — Барный кейтеринг и финансы
 * Events Management View (`src/client/components/events/EventsView.tsx`)
 *
 * Provides comprehensive tracking for catering projects:
 * - Contract amount & client receivables (дебиторская задолженность)
 * - Actual client payments received
 * - Direct event expenses & net project profitability
 * - Creation, editing and lifecycle management of catering events
 */

import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  Clock,
  MapPin,
  User,
  DollarSign,
  TrendingUp,
  AlertCircle,
  X,
} from 'lucide-react';
import { CateringEvent, EventStatus } from '../../../shared/types.js';
import { useFinance } from '../../context/FinanceContext.js';
import { formatRubles, formatDateRu } from '../../utils/formatters.js';

interface EventFormState {
  title: string;
  clientName: string;
  eventDate: string;
  status: EventStatus;
  contractAmount: string;
  budget: string;
  guestCount: string;
  location: string;
  notes: string;
}

const INITIAL_FORM: EventFormState = {
  title: '',
  clientName: '',
  eventDate: new Date().toISOString().split('T')[0],
  status: 'planned',
  contractAmount: '',
  budget: '',
  guestCount: '',
  location: '',
  notes: '',
};

export const EventsView: React.FC = () => {
  const { events, transactions, createEvent, updateEvent, deleteEvent } = useFinance();
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [formData, setFormData] = useState<EventFormState>(INITIAL_FORM);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Compute metrics for each event from active transactions
  const eventMetrics = useMemo(() => {
    const map = new Map<string, { received: number; costs: number }>();

    transactions.forEach((tx) => {
      if (!tx.eventId) return;
      const current = map.get(tx.eventId) || { received: 0, costs: 0 };
      if (tx.type === 'income') {
        current.received += tx.amount;
      } else if (tx.type === 'expense') {
        current.costs += tx.amount;
      }
      map.set(tx.eventId, current);
    });

    return map;
  }, [transactions]);

  // Overall totals across all events
  const totals = useMemo(() => {
    let totalContract = 0;
    let totalReceived = 0;
    let totalCosts = 0;
    let totalReceivables = 0;

    events.forEach((ev) => {
      const metrics = eventMetrics.get(ev.id) || { received: 0, costs: 0 };
      const contract = ev.contractAmount || metrics.received || 0;
      const debt = Math.max(0, contract - metrics.received);

      totalContract += contract;
      totalReceived += metrics.received;
      totalCosts += metrics.costs;
      totalReceivables += debt;
    });

    const totalProfit = totalReceived - totalCosts;
    return {
      totalContract,
      totalReceived,
      totalCosts,
      totalReceivables,
      totalProfit,
    };
  }, [events, eventMetrics]);

  const handleOpenCreate = () => {
    setEditingEventId(null);
    setFormData(INITIAL_FORM);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (ev: CateringEvent) => {
    setEditingEventId(ev.id);
    setFormData({
      title: ev.title,
      clientName: ev.clientName || '',
      eventDate: ev.eventDate,
      status: ev.status,
      contractAmount: ev.contractAmount !== undefined ? String(ev.contractAmount) : '',
      budget: ev.budget !== undefined ? String(ev.budget) : '',
      guestCount: ev.guestCount !== undefined ? String(ev.guestCount) : '',
      location: ev.location || '',
      notes: ev.notes || '',
    });
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingEventId(null);
    setFormData(INITIAL_FORM);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setIsSaving(true);
    const contractAmountNum = formData.contractAmount ? Number(formData.contractAmount) : undefined;
    const budgetNum = formData.budget ? Number(formData.budget) : undefined;
    const guestCountNum = formData.guestCount ? Number(formData.guestCount) : undefined;

    if (editingEventId) {
      await updateEvent(editingEventId, {
        title: formData.title.trim(),
        clientName: formData.clientName.trim() || undefined,
        eventDate: formData.eventDate,
        status: formData.status,
        contractAmount: contractAmountNum,
        budget: budgetNum,
        guestCount: guestCountNum,
        location: formData.location.trim() || undefined,
        notes: formData.notes.trim() || undefined,
      });
    } else {
      await createEvent({
        title: formData.title.trim(),
        clientName: formData.clientName.trim() || undefined,
        eventDate: formData.eventDate,
        status: formData.status,
        contractAmount: contractAmountNum,
        budget: budgetNum,
        guestCount: guestCountNum,
        location: formData.location.trim() || undefined,
        notes: formData.notes.trim() || undefined,
      });
    }

    setIsSaving(false);
    handleCloseForm();
  };

  const handleDelete = async (id: string) => {
    await deleteEvent(id);
    setDeletingId(null);
  };

  const getStatusBadge = (status: EventStatus) => {
    switch (status) {
      case 'active':
        return <span className="status-badge status-active">В работе</span>;
      case 'completed':
        return <span className="status-badge status-completed">Завершено</span>;
      case 'cancelled':
        return <span className="status-badge status-cancelled">Отменено</span>;
      default:
        return <span className="status-badge status-planned">Планируется</span>;
    }
  };

  return (
    <div className="events-container">
      {/* Header & Overall Summary */}
      <div className="events-header-panel">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={22} style={{ color: 'var(--color-accent)' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-accent-strong)' }}>
              Мероприятия и дебиторка
            </h2>
          </div>
          <p style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Контроль договоров выездных баров, входящих оплат от заказчиков и чистой проектной прибыли.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="btn-settings-add"
          style={{ alignSelf: 'flex-start' }}
        >
          <Plus size={16} />
          <span>Новое мероприятие</span>
        </button>
      </div>

      {/* Aggregate Financial Metrics */}
      <div className="events-summary-grid">
        <div className="events-summary-card">
          <div className="events-summary-header">
            <span>Сумма договоров</span>
            <DollarSign size={14} />
          </div>
          <div className="events-summary-amount" style={{ color: 'var(--foreground)' }}>
            {formatRubles(totals.totalContract)}
          </div>
        </div>

        <div className="events-summary-card">
          <div className="events-summary-header">
            <span>Оплачено клиентами</span>
            <CheckCircle size={14} style={{ color: 'var(--color-success)' }} />
          </div>
          <div className="events-summary-amount" style={{ color: 'var(--color-success)' }}>
            {formatRubles(totals.totalReceived)}
          </div>
        </div>

        <div className="events-summary-card">
          <div className="events-summary-header">
            <span>Остаток (дебиторка)</span>
            <Clock size={14} style={{ color: totals.totalReceivables > 0 ? '#d97706' : 'inherit' }} />
          </div>
          <div className="events-summary-amount" style={{ color: totals.totalReceivables > 0 ? '#d97706' : 'inherit' }}>
            {formatRubles(totals.totalReceivables)}
          </div>
        </div>

        <div className="events-summary-card">
          <div className="events-summary-header">
            <span>Прямые расходы</span>
            <AlertCircle size={14} style={{ color: 'var(--color-destructive)' }} />
          </div>
          <div className="events-summary-amount" style={{ color: 'var(--color-destructive)' }}>
            {formatRubles(totals.totalCosts)}
          </div>
        </div>

        <div className="events-summary-card">
          <div className="events-summary-header">
            <span>Чистая прибыль</span>
            <TrendingUp size={14} style={{ color: totals.totalProfit >= 0 ? 'var(--color-success)' : 'var(--color-destructive)' }} />
          </div>
          <div className="events-summary-amount" style={{ color: totals.totalProfit >= 0 ? 'var(--color-success)' : 'var(--color-destructive)' }}>
            {formatRubles(totals.totalProfit)}
          </div>
        </div>
      </div>

      {/* Inline Create / Edit Modal Form */}
      {isFormOpen && (
        <div className="glass-panel" style={{ padding: '20px', backgroundColor: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-accent-strong)' }}>
              {editingEventId ? 'Редактирование мероприятия' : 'Новое мероприятие'}
            </h3>
            <button type="button" onClick={handleCloseForm} style={{ color: 'var(--color-text-muted)' }}>
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="settings-form-grid">
              <div className="settings-input-group">
                <label className="settings-input-label">Название проекта *</label>
                <input
                  type="text"
                  required
                  placeholder="Свадьба в Усадьбе Муравьёвых"
                  className="settings-text-input"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div className="settings-input-group">
                <label className="settings-input-label">Заказчик / Клиент</label>
                <input
                  type="text"
                  placeholder="Анастасия и Дмитрий"
                  className="settings-text-input"
                  value={formData.clientName}
                  onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                />
              </div>

              <div className="settings-input-group">
                <label className="settings-input-label">Дата проведения *</label>
                <input
                  type="date"
                  required
                  className="settings-text-input"
                  value={formData.eventDate}
                  onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                />
              </div>

              <div className="settings-input-group">
                <label className="settings-input-label">Статус</label>
                <select
                  className="settings-text-input"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as EventStatus })}
                >
                  <option value="planned">Планируется</option>
                  <option value="active">В работе</option>
                  <option value="completed">Завершено</option>
                  <option value="cancelled">Отменено</option>
                </select>
              </div>

              <div className="settings-input-group">
                <label className="settings-input-label">Сумма договора (₽)</label>
                <input
                  type="number"
                  placeholder="250000"
                  className="settings-text-input"
                  value={formData.contractAmount}
                  onChange={(e) => setFormData({ ...formData, contractAmount: e.target.value })}
                />
              </div>

              <div className="settings-input-group">
                <label className="settings-input-label">Локация / Площадка</label>
                <input
                  type="text"
                  placeholder="Усадьба Муравьёвых, шатёр"
                  className="settings-text-input"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
            </div>

            <div className="settings-input-group">
              <label className="settings-input-label">Примечания к проекту</label>
              <textarea
                rows={2}
                placeholder="Коктейли, особенности меню, контакт организатора..."
                className="settings-text-input"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <div className="settings-form-actions">
              <button type="button" onClick={handleCloseForm} className="btn-form-cancel">
                Отмена
              </button>
              <button type="submit" disabled={isSaving} className="btn-form-submit">
                {isSaving ? 'Сохранение...' : editingEventId ? 'Сохранить изменения' : 'Создать мероприятие'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Events Grid */}
      <div className="event-cards-grid">
        {events.map((ev) => {
          const metrics = eventMetrics.get(ev.id) || { received: 0, costs: 0 };
          const contract = ev.contractAmount || (metrics.received > 0 ? metrics.received : 0);
          const debt = Math.max(0, contract - metrics.received);
          const profit = metrics.received - metrics.costs;
          const progressPercent = contract > 0 ? Math.min(100, Math.round((metrics.received / contract) * 100)) : 100;

          return (
            <div key={ev.id} className="event-card">
              <div className="event-card-top">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 className="event-card-title">{ev.title}</h3>
                    {getStatusBadge(ev.status)}
                  </div>

                  {ev.clientName && (
                    <div className="event-card-client" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <User size={13} />
                      <span>{ev.clientName}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Calendar size={12} />
                      {formatDateRu(ev.eventDate)}
                    </span>
                    {ev.location && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <MapPin size={12} />
                        {ev.location}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(ev)}
                    title="Редактировать мероприятие"
                    className="btn-touch-target"
                    style={{ minWidth: '44px', minHeight: '44px', color: 'var(--color-text-muted)', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    <Edit2 size={15} />
                  </button>
                  {deletingId === ev.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <button
                        type="button"
                        onClick={() => handleDelete(ev.id)}
                        className="btn-confirm-yes"
                        style={{ fontSize: '0.7rem', padding: '3px 6px' }}
                      >
                        Да
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingId(null)}
                        className="btn-confirm-no"
                        style={{ fontSize: '0.7rem', padding: '3px 6px' }}
                      >
                        Нет
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeletingId(ev.id)}
                      title="Удалить мероприятие"
                      className="btn-touch-target"
                      style={{ minWidth: '44px', minHeight: '44px', color: 'var(--color-text-muted)', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* Progress: payments received vs contract */}
              {contract > 0 && (
                <div className="event-progress-container">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem', color: 'var(--color-text-muted)' }}>
                    <span>Оплачено {progressPercent}%</span>
                    <span>Договор: {formatRubles(contract)}</span>
                  </div>
                  <div className="event-progress-bar">
                    <div className="event-progress-fill" style={{ width: `${progressPercent}%` }} />
                  </div>
                </div>
              )}

              {/* Metrics Grid */}
              <div className="event-metrics-grid">
                <div className="event-metric-box">
                  <span className="event-metric-label">Поступило</span>
                  <span className="event-metric-val val-positive">{formatRubles(metrics.received)}</span>
                </div>

                <div className="event-metric-box">
                  <span className="event-metric-label">Дебиторка</span>
                  <span className={`event-metric-val ${debt > 0 ? 'val-warning' : ''}`}>
                    {formatRubles(debt)}
                  </span>
                </div>

                <div className="event-metric-box">
                  <span className="event-metric-label">Расходы бара</span>
                  <span className="event-metric-val" style={{ color: '#dc2626' }}>{formatRubles(metrics.costs)}</span>
                </div>

                <div className="event-metric-box">
                  <span className="event-metric-label">Чистая прибыль</span>
                  <span className={`event-metric-val ${profit >= 0 ? 'val-positive' : ''}`} style={{ color: profit < 0 ? '#dc2626' : undefined }}>
                    {formatRubles(profit)}
                  </span>
                </div>
              </div>

              {ev.notes && (
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontStyle: 'italic', borderTop: '1px solid var(--color-border)', paddingTop: '6px' }}>
                  {ev.notes}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EventsView;
