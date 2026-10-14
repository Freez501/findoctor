import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, CheckCircle2, Phone, ArrowUpRight } from 'lucide-react';
import { CateringEvent, EventVendor } from '../../../shared/types.js';
import { useFinance } from '../../context/FinanceContext.js';
import { api } from '../../api/apiClient.js';
import { formatRubles } from '../../utils/formatters.js';

interface EventContractorsTabProps {
  event: CateringEvent;
  onVendorsUpdated?: () => void;
}

export const EventContractorsTab: React.FC<EventContractorsTabProps> = ({ event, onVendorsUpdated }) => {
  const { accounts, categories, addToast, refreshAccounts, refreshTransactions } = useFinance();
  const [vendors, setVendors] = useState<EventVendor[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingVendor, setEditingVendor] = useState<EventVendor | null>(null);

  // Pay modal state
  const [payingVendor, setPayingVendor] = useState<EventVendor | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('cash_1');
  const [payCategoryId, setPayCategoryId] = useState<string>('staff');
  const [isPaying, setIsPaying] = useState<boolean>(false);

  // Form inputs
  const [name, setName] = useState<string>('');
  const [role, setRole] = useState<string>('Ведущий');
  const [phone, setPhone] = useState<string>('');
  const [agreedFee, setAgreedFee] = useState<string>('');
  const [paidAmount, setPaidAmount] = useState<string>('0');
  const [dueDate, setDueDate] = useState<string>(event.eventDate || '');
  const [createAdvanceTx, setCreateAdvanceTx] = useState<boolean>(true);
  const [advanceAccountId, setAdvanceAccountId] = useState<string>('cash_1');
  const [advanceCategoryId, setAdvanceCategoryId] = useState<string>('staff');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const expenseCategories = React.useMemo(() => {
    return categories.filter((c) => c.type === 'expense' || c.type === 'both');
  }, [categories]);

  const loadVendors = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.getVendors(event.id);
      setVendors(res.vendors || []);
    } catch (err: any) {
      addToast(err.message || 'Ошибка загрузки подрядчиков', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [event.id, addToast]);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  // Aggregate totals
  const totals = React.useMemo(() => {
    let totalFee = 0;
    let totalPaid = 0;
    let totalRemaining = 0;

    vendors.forEach((v) => {
      totalFee += v.agreedFee;
      totalPaid += v.paidAmount;
      totalRemaining += v.remainingAmount;
    });

    return { totalFee, totalPaid, totalRemaining };
  }, [vendors]);

  const handleOpenCreate = () => {
    setEditingVendor(null);
    setName('');
    setRole('Ведущий');
    setPhone('');
    setAgreedFee('');
    setPaidAmount('0');
    setDueDate(event.eventDate || '');
    setCreateAdvanceTx(true);
    setAdvanceAccountId(accounts[0]?.id || 'cash_1');
    setAdvanceCategoryId('staff');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (v: EventVendor) => {
    setEditingVendor(v);
    setName(v.name);
    setRole(v.role);
    setPhone(v.phone || '');
    setAgreedFee(String(v.agreedFee));
    setPaidAmount(String(v.paidAmount));
    setDueDate(v.dueDate || event.eventDate || '');
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const fee = parseFloat(agreedFee);
    const paid = parseFloat(paidAmount || '0');

    if (!name.trim()) {
      addToast('Укажите имя специалиста или название подрядчика', 'error');
      return;
    }
    if (isNaN(fee) || fee <= 0) {
      addToast('Укажите корректный согласованный гонорар', 'error');
      return;
    }

    setIsSaving(true);
    try {
      if (editingVendor) {
        await api.updateVendor(event.id, editingVendor.id, {
          name: name.trim(),
          role: role.trim(),
          phone: phone.trim() || undefined,
          agreedFee: fee,
          paidAmount: isNaN(paid) ? 0 : paid,
          dueDate: dueDate || undefined,
        });
        addToast('Данные подрядчика обновлены', 'success');
      } else {
        // If user wants to execute advance payment directly in Cash Flow / ДДС
        if (createAdvanceTx && paid > 0) {
          const res = await api.createVendor(event.id, {
            name: name.trim(),
            role: role.trim(),
            phone: phone.trim() || undefined,
            agreedFee: fee,
            paidAmount: 0,
            dueDate: dueDate || undefined,
          });
          const createdVendor = res.vendor;
          // Create real expense transaction in Cash Flow
          await api.createTransaction({
            type: 'expense',
            amount: paid,
            fromAccountId: advanceAccountId,
            eventId: event.id,
            vendorId: createdVendor.id,
            vendorName: createdVendor.name,
            categoryId: advanceCategoryId,
            description: `Аванс подрядчику: ${createdVendor.role} ${createdVendor.name}`,
            transactionDate: new Date().toISOString(),
          });
          await Promise.all([refreshAccounts(), refreshTransactions()]);
          addToast(`Подрядчик добавлен, аванс ${formatRubles(paid)} списан в ДДС`, 'success');
        } else {
          await api.createVendor(event.id, {
            name: name.trim(),
            role: role.trim(),
            phone: phone.trim() || undefined,
            agreedFee: fee,
            paidAmount: isNaN(paid) ? 0 : paid,
            dueDate: dueDate || undefined,
          });
          addToast('Подрядчик добавлен в команду проекта', 'success');
        }
      }
      setIsFormOpen(false);
      await loadVendors();
      onVendorsUpdated?.();
    } catch (err: any) {
      addToast(err.message || 'Ошибка сохранения подрядчика', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Удалить подрядчика из проекта?')) return;
    try {
      await api.deleteVendor(event.id, id);
      addToast('Подрядчик удален', 'info');
      await loadVendors();
      onVendorsUpdated?.();
    } catch (err: any) {
      addToast(err.message || 'Ошибка удаления', 'error');
    }
  };

  const handleOpenPay = (v: EventVendor) => {
    setPayingVendor(v);
    setPayAmount(String(v.remainingAmount));
    setSelectedAccountId(accounts[0]?.id || 'cash_1');
    const roleLower = v.role.toLowerCase();
    const defaultCat = roleLower.includes('звук') || roleLower.includes('dj') || roleLower.includes('декор')
      ? 'equipment'
      : roleLower.includes('транспорт') || roleLower.includes('логистик')
      ? 'logistics'
      : 'staff';
    setPayCategoryId(defaultCat);
  };

  const handleExecutePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingVendor) return;

    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      addToast('Укажите корректную сумму выплаты', 'error');
      return;
    }

    setIsPaying(true);
    try {
      // Create expense transaction linked to this event and vendor
      await api.createTransaction({
        type: 'expense',
        amount,
        fromAccountId: selectedAccountId,
        eventId: event.id,
        vendorId: payingVendor.id,
        vendorName: payingVendor.name,
        categoryId: payCategoryId || 'staff',
        description: `Выплата подрядчику: ${payingVendor.role} ${payingVendor.name}`,
        transactionDate: new Date().toISOString(),
      });

      addToast(`Выплачено ${formatRubles(amount)} специалисту ${payingVendor.name}`, 'success');
      setPayingVendor(null);
      await Promise.all([loadVendors(), refreshAccounts(), refreshTransactions()]);
      onVendorsUpdated?.();
    } catch (err: any) {
      addToast(err.message || 'Ошибка проведения выплаты', 'error');
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className="dossier-tab-content">
      {/* Summary KPI Cards */}
      <div className="dossier-kpi-grid">
        <div className="dossier-kpi-card">
          <span className="dossier-kpi-label">Общий бюджет команды</span>
          <span className="dossier-kpi-val">{formatRubles(totals.totalFee)}</span>
        </div>
        <div className="dossier-kpi-card">
          <span className="dossier-kpi-label">Выплачено авансами</span>
          <span className="dossier-kpi-val" style={{ color: 'var(--color-success)' }}>
            {formatRubles(totals.totalPaid)}
          </span>
        </div>
        <div className="dossier-kpi-card">
          <span className="dossier-kpi-label">К выплате на площадке</span>
          <span
            className="dossier-kpi-val"
            style={{ color: totals.totalRemaining > 0 ? '#d97706' : 'var(--muted-foreground)' }}
          >
            {formatRubles(totals.totalRemaining)}
          </span>
        </div>
      </div>

      {/* Header Actions */}
      <div className="dossier-section-header">
        <h4 className="dossier-section-title">Команда и подрядчики мероприятия</h4>
        <button type="button" onClick={handleOpenCreate} className="btn-dossier-primary">
          <Plus size={15} />
          <span>Добавить подрядчика</span>
        </button>
      </div>

      {/* Quick Pay Modal */}
      {payingVendor && (
        <div className="dossier-submodal-overlay">
          <div className="dossier-submodal-card">
            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
              Выплата: {payingVendor.role} {payingVendor.name}
            </h4>
            <p style={{ margin: '4px 0 16px', fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
              Остаток по договору: <strong>{formatRubles(payingVendor.remainingAmount)}</strong>
            </p>

            <form onSubmit={handleExecutePayment}>
              <div className="settings-input-group" style={{ marginBottom: '12px' }}>
                <label className="settings-input-label">Счет списания *</label>
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

              <div className="settings-input-group" style={{ marginBottom: '12px' }}>
                <label className="settings-input-label">Статья расхода в ДДС *</label>
                <select
                  className="settings-text-input"
                  value={payCategoryId}
                  onChange={(e) => setPayCategoryId(e.target.value)}
                  required
                >
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="settings-input-group" style={{ marginBottom: '16px' }}>
                <label className="settings-input-label">Сумма к выплате (₽) *</label>
                <input
                  type="number"
                  step="any"
                  required
                  className="settings-text-input"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
              </div>

              <div className="settings-form-actions">
                <button
                  type="button"
                  onClick={() => setPayingVendor(null)}
                  className="btn-form-cancel"
                >
                  Отмена
                </button>
                <button type="submit" disabled={isPaying} className="btn-form-submit">
                  {isPaying ? 'Проведение...' : `Выплатить ${formatRubles(parseFloat(payAmount) || 0)}`}
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
            {editingVendor ? 'Редактировать данные подрядчика' : 'Новый специалист / подрядчик'}
          </h5>
          <div className="dossier-form-grid">
            <div className="settings-input-group">
              <label className="settings-input-label">Роль / Специализация *</label>
              <select
                className="settings-text-input"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="Ведущий">Ведущий</option>
                <option value="DJ / Звукорежиссер">DJ / Звукорежиссер</option>
                <option value="Фотограф / Видеограф">Фотограф / Видеограф</option>
                <option value="Декор и флористика">Декор и флористика</option>
                <option value="Аренда звука и света">Аренда звука и света</option>
                <option value="Бармен / Кейтеринг">Бармен / Кейтеринг</option>
                <option value="Координатор">Координатор</option>
                <option value="Логистика / Транспорт">Логистика / Транспорт</option>
                <option value="Другое">Другое</option>
              </select>
            </div>

            <div className="settings-input-group">
              <label className="settings-input-label">Имя специалиста / Компания *</label>
              <input
                type="text"
                required
                placeholder="Алексей Смирнов"
                className="settings-text-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="settings-input-group">
              <label className="settings-input-label">Телефон для связи</label>
              <input
                type="text"
                placeholder="+7 (999) 000-00-00"
                className="settings-text-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="settings-input-group">
              <label className="settings-input-label">Согласованный гонорар (₽) *</label>
              <input
                type="number"
                step="any"
                required
                placeholder="40000"
                className="settings-text-input"
                value={agreedFee}
                onChange={(e) => setAgreedFee(e.target.value)}
              />
            </div>

            <div className="settings-input-group">
              <label className="settings-input-label">Выплачено авансом (₽)</label>
              <input
                type="number"
                step="any"
                placeholder="0"
                className="settings-text-input"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
              />
              {parseFloat(paidAmount || '0') > parseFloat(agreedFee || '0') && parseFloat(agreedFee || '0') > 0 && (
                <div style={{ color: '#d97706', fontSize: '0.75rem', marginTop: '4px', fontWeight: 500 }}>
                  ⚠️ Аванс превышает гонорар на {formatRubles(parseFloat(paidAmount) - parseFloat(agreedFee))} (переплата)
                </div>
              )}
            </div>

            <div className="settings-input-group">
              <label className="settings-input-label">Срок финальной выплаты</label>
              <input
                type="date"
                className="settings-text-input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            {/* Advance Cash Flow execution toggle for new vendors */}
            {!editingVendor && parseFloat(paidAmount || '0') > 0 && (
              <div
                style={{
                  gridColumn: '1 / -1',
                  padding: '12px 14px',
                  background: 'var(--color-bg-secondary, rgba(59, 130, 246, 0.05))',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500, fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={createAdvanceTx}
                    onChange={(e) => setCreateAdvanceTx(e.target.checked)}
                  />
                  <span>Списать аванс со счёта сейчас (провести операцию расхода в ДДС и Cash Flow)</span>
                </label>

                {createAdvanceTx && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '10px' }}>
                    <div className="settings-input-group">
                      <label className="settings-input-label">Счёт списания аванса *</label>
                      <select
                        className="settings-text-input"
                        value={advanceAccountId}
                        onChange={(e) => setAdvanceAccountId(e.target.value)}
                        required
                      >
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({formatRubles(acc.currentBalance)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="settings-input-group">
                      <label className="settings-input-label">Статья расхода в ДДС *</label>
                      <select
                        className="settings-text-input"
                        value={advanceCategoryId}
                        onChange={(e) => setAdvanceCategoryId(e.target.value)}
                      >
                        {expenseCategories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}
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
              {isSaving ? 'Сохранение...' : editingVendor ? 'Сохранить' : 'Добавить'}
            </button>
          </div>
        </form>
      )}

      {/* Vendors Cards / List */}
      {isLoading ? (
        <div className="dossier-loading">Загрузка подрядчиков мероприятия...</div>
      ) : vendors.length === 0 ? (
        <div className="dossier-empty-state">
          <Phone size={32} style={{ color: 'var(--muted-foreground)', opacity: 0.5 }} />
          <p>В этом проекте пока нет назначенных подрядчиков.</p>
          <button type="button" onClick={handleOpenCreate} className="btn-dossier-secondary">
            <Plus size={14} /> Добавить подрядчика (Ведущий, DJ, Декор)
          </button>
        </div>
      ) : (
        <div className="dossier-vendors-grid">
          {vendors.map((v) => {
            const isPaid = v.status === 'paid' || v.remainingAmount <= 0;
            const isPartial = v.status === 'partial' || (v.paidAmount > 0 && v.remainingAmount > 0);

            return (
              <div key={v.id} className="dossier-vendor-card">
                <div className="dossier-vendor-header">
                  <div>
                    <span className="dossier-vendor-role">{v.role}</span>
                    <h5 className="dossier-vendor-name">{v.name}</h5>
                    {v.phone && (
                      <a href={`tel:${v.phone}`} className="dossier-vendor-phone">
                        <Phone size={12} /> {v.phone}
                      </a>
                    )}
                  </div>
                  <span
                    className={`dossier-vendor-badge ${
                      isPaid ? 'badge-paid' : isPartial ? 'badge-partial' : 'badge-pending'
                    }`}
                  >
                    {isPaid ? 'Оплачен' : isPartial ? 'Частично' : 'Не оплачен'}
                  </span>
                </div>

                <div className="dossier-vendor-finance-box">
                  <div className="dossier-vf-col">
                    <span className="dossier-vf-label">Гонорар</span>
                    <span className="dossier-vf-val">{formatRubles(v.agreedFee)}</span>
                  </div>
                  <div className="dossier-vf-col">
                    <span className="dossier-vf-label">Аванс</span>
                    <span className="dossier-vf-val val-green">{formatRubles(v.paidAmount)}</span>
                  </div>
                  <div className="dossier-vf-col">
                    <span className="dossier-vf-label">Остаток</span>
                    <span className={`dossier-vf-val ${v.remainingAmount > 0 ? 'val-amber' : ''}`}>
                      {formatRubles(v.remainingAmount)}
                    </span>
                  </div>
                </div>

                <div className="dossier-vendor-footer">
                  {v.remainingAmount > 0 ? (
                    <button
                      type="button"
                      onClick={() => handleOpenPay(v)}
                      className="btn-vendor-pay"
                    >
                      <ArrowUpRight size={14} />
                      <span>Выплатить {formatRubles(v.remainingAmount)}</span>
                    </button>
                  ) : (
                    <span className="dossier-vendor-settled">
                      <CheckCircle2 size={14} color="#059669" /> Расчет завершен
                    </span>
                  )}

                  <div className="dossier-vendor-controls">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(v)}
                      className="btn-icon-tiny"
                      title="Редактировать"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(v.id)}
                      className="btn-icon-tiny btn-danger-tiny"
                      title="Удалить"
                    >
                      <Trash2 size={13} />
                    </button>
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
