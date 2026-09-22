/**
 * Truespace — Барный кейтеринг и финансы
 * Settings & Directories View (`src/client/components/settings/SettingsView.tsx`)
 *
 * Provides customization of:
 * 1. Accounts (Счета): Edit names, custom types, descriptions, add & delete accounts
 * 2. Partners (Партнёры): Add partners, editable custom roles (no hardcoding), delete
 * 3. Categories (Статьи): Clean compact cards, type, direction, color, add & delete
 *
 * All edits occur inside focused modal dialogs rather than inflating cards in the grid.
 */

import React, { useState } from 'react';
import {
  Wallet,
  Users,
  Tag,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Loader2,
  Building2,
  Landmark,
  CreditCard,
  Shield,
  RotateCcw,
  Banknote,
  Coins,
  Smartphone,
  PiggyBank,
  Briefcase,
  Zap,
  LucideIcon,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext.js';
import { api } from '../../api/apiClient.js';
import { formatRubles } from '../../utils/formatters.js';
import { Account, Category, Partner, TransactionDirection } from '../../../shared/types.js';

type SettingsTab = 'accounts' | 'partners' | 'categories';

const PRESET_COLORS = [
  '#10b981', // изумрудный (касса / наличные)
  '#2563eb', // синий (банк / р-счёт)
  '#7c3aed', // фиолетовый (карта / сбп)
  '#0284c7', // циан (резерв / сейф)
  '#d97706', // янтарный (золото / фонд)
  '#e11d48', // рубиновый (акцент)
  '#64748b', // сланцевый (нейтральный)
  '#ec4899', // розовый
  '#f97316', // оранжевый
];

const ACCOUNT_ICON_MAP: Record<string, LucideIcon> = {
  'banknote': Banknote,
  'coins': Coins,
  'landmark': Landmark,
  'credit-card': CreditCard,
  'smartphone': Smartphone,
  'wallet': Wallet,
  'shield': Shield,
  'piggy-bank': PiggyBank,
  'briefcase': Briefcase,
  'zap': Zap,
};

const ACCOUNT_ICONS = [
  { id: 'banknote', label: 'Купюры / Касса', icon: Banknote },
  { id: 'coins', label: 'Монеты / Мелочь', icon: Coins },
  { id: 'landmark', label: 'Банк / Р/с', icon: Landmark },
  { id: 'credit-card', label: 'Карта', icon: CreditCard },
  { id: 'smartphone', label: 'СБП / Онлайн', icon: Smartphone },
  { id: 'wallet', label: 'Кошелёк', icon: Wallet },
  { id: 'shield', label: 'Сейф / Защита', icon: Shield },
  { id: 'piggy-bank', label: 'Копилка / Резерв', icon: PiggyBank },
  { id: 'briefcase', label: 'Бизнес / Дела', icon: Briefcase },
  { id: 'zap', label: 'Молния / Быстрые', icon: Zap },
];

export const SettingsView: React.FC = () => {
  const {
    accounts,
    refreshAccounts,
    partners,
    refreshPartners,
    categories,
    refreshCategories,
    resetAccountBalances,
    addToast,
  } = useFinance();

  const [activeTab, setActiveTab] = useState<SettingsTab>('accounts');
  const [isSaving, setIsSaving] = useState(false);

  // ==========================================
  // MODAL DIALOG STATES
  // ==========================================
  const [modalAccount, setModalAccount] = useState<
    { mode: 'create' } | { mode: 'edit'; account: Account } | null
  >(null);
  const [accName, setAccName] = useState('');
  const [accTypeSelect, setAccTypeSelect] = useState<'cash' | 'bank' | 'card' | 'safe' | 'custom'>('cash');
  const [customAccTypeName, setCustomAccTypeName] = useState('');
  const [accBalance, setAccBalance] = useState<number>(0);
  const [accDesc, setAccDesc] = useState('');
  const [accColor, setAccColor] = useState<string>('#10b981');
  const [accIcon, setAccIcon] = useState<string>('banknote');

  const [modalPartner, setModalPartner] = useState<
    { mode: 'create' } | { mode: 'edit'; partner: Partner } | null
  >(null);
  const [partnerName, setPartnerName] = useState('');
  const [partnerRole, setPartnerRole] = useState('');

  const [modalCategory, setModalCategory] = useState<
    { mode: 'create' } | { mode: 'edit'; category: Category } | null
  >(null);
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<'expense' | 'income'>('expense');
  const [catDirection, setCatDirection] = useState<TransactionDirection | 'all'>('operational');
  const [catColor, setCatColor] = useState('#2563eb');

  // ==========================================
  // ACCOUNT ACTIONS
  // ==========================================
  const openCreateAccount = () => {
    setAccName('');
    setAccTypeSelect('cash');
    setCustomAccTypeName('');
    setAccBalance(0);
    setAccDesc('');
    setAccColor('#10b981');
    setAccIcon('banknote');
    setModalAccount({ mode: 'create' });
  };

  const openEditAccount = (acc: Account) => {
    setAccName(acc.name);
    if (acc.type === 'cash' || acc.type === 'bank' || acc.type === 'card' || acc.type === 'safe') {
      setAccTypeSelect(acc.type);
      setCustomAccTypeName('');
    } else {
      setAccTypeSelect('custom');
      setCustomAccTypeName(acc.type || '');
    }
    setAccBalance(acc.currentBalance);
    setAccDesc(acc.description || '');

    // Resolve color and icon with contextual defaults
    const fallbackColor = acc.color || (
      acc.type === 'bank' ? '#2563eb' :
      acc.type === 'card' ? '#7c3aed' :
      (acc.type as string) === 'safe' ? '#0284c7' :
      '#10b981'
    );
    const fallbackIcon = acc.icon || (
      acc.id === 'cash_2' ? 'coins' :
      acc.type === 'bank' || acc.id === 'bank_1' ? 'landmark' :
      acc.type === 'card' || acc.id === 'bank_2' || acc.id === 'card_sbp' ? 'credit-card' :
      (acc.type as string) === 'safe' ? 'shield' :
      'banknote'
    );
    setAccColor(fallbackColor);
    setAccIcon(fallbackIcon);
    setModalAccount({ mode: 'edit', account: acc });
  };

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) return;

    const resolvedType = accTypeSelect === 'custom'
      ? (customAccTypeName.trim() || 'Счёт')
      : accTypeSelect;

    setIsSaving(true);
    try {
      if (modalAccount?.mode === 'create') {
        await api.createAccount({
          name: accName.trim(),
          type: resolvedType,
          description: accDesc.trim(),
          initialBalance: accBalance || 0,
          color: accColor,
          icon: accIcon,
        });
        addToast('Новый счёт создан', 'success');
      } else if (modalAccount?.mode === 'edit') {
        await api.saveAccount(modalAccount.account.id, {
          name: accName.trim(),
          type: resolvedType,
          description: accDesc.trim(),
          currentBalance: accBalance,
          initialBalance: accBalance,
          color: accColor,
          icon: accIcon,
        });
        addToast('Счёт и остаток успешно сохранены', 'success');
      }
      await refreshAccounts();
      setModalAccount(null);
    } catch (err: any) {
      addToast(err.message || 'Ошибка сохранения счёта', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetBalances = async () => {
    if (!window.confirm('Обнулить остатки всех счетов до 0 ₽? Это полезно, если вы начинаете вести учёт с нуля и будете вносить реальные операции или выписки.')) {
      return;
    }
    await resetAccountBalances();
    await refreshAccounts();
  };

  const handleDeleteAccount = async (id: string, name: string) => {
    if (!window.confirm(`Вы уверены, что хотите удалить счёт «${name}»?`)) return;
    setIsSaving(true);
    try {
      await api.deleteAccount(id);
      await refreshAccounts();
      addToast(`Счёт «${name}» удалён`, 'success');
      setModalAccount(null);
    } catch (err: any) {
      addToast(err.message || 'Ошибка удаления счёта', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ==========================================
  // PARTNER ACTIONS
  // ==========================================
  const openCreatePartner = () => {
    setPartnerName('');
    setPartnerRole('');
    setModalPartner({ mode: 'create' });
  };

  const openEditPartner = (p: Partner) => {
    setPartnerName(p.name);
    setPartnerRole(p.role || '');
    setModalPartner({ mode: 'edit', partner: p });
  };

  const handlePartnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerName.trim()) return;

    setIsSaving(true);
    try {
      if (modalPartner?.mode === 'create') {
        await api.createPartner({
          name: partnerName.trim(),
          role: partnerRole.trim() || undefined,
        });
        addToast(`Партнёр ${partnerName} добавлен`, 'success');
      } else if (modalPartner?.mode === 'edit') {
        await api.updatePartner(modalPartner.partner.id, {
          name: partnerName.trim(),
          role: partnerRole.trim() || undefined,
        });
        addToast('Партнёр обновлён', 'success');
      }
      await refreshPartners();
      setModalPartner(null);
    } catch (err: any) {
      addToast(err.message || 'Ошибка сохранения партнёра', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePartner = async (id: string, name: string) => {
    if (!window.confirm(`Удалить партнёра «${name}»?`)) return;
    setIsSaving(true);
    try {
      await api.deletePartner(id);
      await refreshPartners();
      addToast(`Партнёр «${name}» удалён`, 'success');
      setModalPartner(null);
    } catch (err: any) {
      addToast(err.message || 'Ошибка удаления партнёра', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ==========================================
  // CATEGORY ACTIONS
  // ==========================================
  const openCreateCategory = () => {
    setCatName('');
    setCatType('expense');
    setCatDirection('operational');
    setCatColor('#2563eb');
    setModalCategory({ mode: 'create' });
  };

  const openEditCategory = (cat: Category) => {
    setCatName(cat.name);
    setCatType(cat.type === 'income' ? 'income' : 'expense');
    setCatDirection(cat.direction || (cat.isEventSpecific ? 'operational' : 'all'));
    setCatColor(cat.color || '#2563eb');
    setModalCategory({ mode: 'edit', category: cat });
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    setIsSaving(true);
    try {
      if (modalCategory?.mode === 'create') {
        await api.createCategory({
          name: catName.trim(),
          type: catType,
          direction: catDirection,
          color: catColor,
          isEventSpecific: catDirection === 'operational',
        });
        addToast(`Статья «${catName}» создана`, 'success');
      } else if (modalCategory?.mode === 'edit') {
        await api.saveCategory(modalCategory.category.id, {
          name: catName.trim(),
          type: catType,
          direction: catDirection,
          color: catColor,
          isEventSpecific: catDirection === 'operational',
        });
        addToast('Статья обновлена', 'success');
      }
      await refreshCategories();
      setModalCategory(null);
    } catch (err: any) {
      addToast(err.message || 'Ошибка сохранения статьи', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!window.confirm(`Удалить статью «${name}» из справочника?`)) return;
    setIsSaving(true);
    try {
      await api.deleteCategory(id);
      await refreshCategories();
      addToast(`Статья «${name}» удалена`, 'success');
      setModalCategory(null);
    } catch (err: any) {
      addToast(err.message || 'Ошибка удаления статьи', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Helper labels
  const getAccountBadge = (acc: Account) => {
    let Icon: LucideIcon = Wallet;
    if (acc.icon && ACCOUNT_ICON_MAP[acc.icon]) {
      Icon = ACCOUNT_ICON_MAP[acc.icon];
    } else if (acc.type === 'bank' || acc.id === 'bank_1') {
      Icon = Landmark;
    } else if (acc.type === 'cash' || acc.id === 'cash_1') {
      Icon = Banknote;
    } else if (acc.id === 'cash_2') {
      Icon = Coins;
    } else if (acc.type === 'card' || acc.id === 'bank_2' || acc.id === 'card_sbp') {
      Icon = CreditCard;
    } else if ((acc.type as string) === 'safe') {
      Icon = Shield;
    }

    let label = 'Счёт';
    let colorClass = 'badge-card';
    if (acc.type === 'bank') {
      label = 'Безналичный счёт';
      colorClass = 'badge-bank';
    } else if (acc.type === 'cash') {
      label = 'Касса наличных';
      colorClass = 'badge-cash';
    } else if (acc.type === 'card') {
      label = 'Карта / СБП';
      colorClass = 'badge-card';
    } else if (acc.type === 'safe') {
      label = 'Сейф / Резерв';
      colorClass = 'badge-bank';
    } else if (acc.type) {
      label = acc.type;
    }

    return { label, icon: Icon, colorClass };
  };

  const getCategoryDirectionLabel = (cat: Category) => {
    if (cat.direction === 'operational' || cat.isEventSpecific) {
      return 'Для мероприятий';
    }
    if (cat.direction === 'business') {
      return 'Накладные расходы';
    }
    if (cat.direction === 'dividends') {
      return 'Дивиденды';
    }
    return 'Универсальная';
  };

  return (
    <div className="settings-view">
      {/* Top Header Panel */}
      <div className="settings-header-panel">
        <div className="settings-title-group">
          <div className="settings-badge-icon" aria-hidden="true">
            <Building2 size={20} />
          </div>
          <div>
            <h2 className="settings-title">Справочники и настройки</h2>
            <p className="settings-subtitle">
              Управление счетами компании, соучредителями и статьями расходов и доходов
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="settings-tabs-control" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'accounts'}
            onClick={() => setActiveTab('accounts')}
            className={`settings-tab-btn ${activeTab === 'accounts' ? 'tab-active' : ''}`}
          >
            <Wallet size={15} />
            <span>Счета ({accounts.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'partners'}
            onClick={() => setActiveTab('partners')}
            className={`settings-tab-btn ${activeTab === 'partners' ? 'tab-active' : ''}`}
          >
            <Users size={15} />
            <span>Партнёры ({partners.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'categories'}
            onClick={() => setActiveTab('categories')}
            className={`settings-tab-btn ${activeTab === 'categories' ? 'tab-active' : ''}`}
          >
            <Tag size={15} />
            <span>Статьи ({categories.length})</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ACCOUNTS                                                           */}
      {/* ========================================================================= */}
      {activeTab === 'accounts' && (
        <div className="settings-content-section animate-fade-in">
          <div className="settings-subbar">
            <div>
              <h3 className="settings-subheading">Управление счетами</h3>
              <p className="settings-subtext">Редактируйте назначение касс, тип учёта или добавляйте новые счета</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleResetBalances}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 12px',
                  fontSize: '0.82rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  color: '#dc2626',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
                title="Сбросить остатки всех счетов до 0 ₽ для начала учёта с нуля"
              >
                <RotateCcw size={14} />
                <span>Обнулить остатки (до 0 ₽)</span>
              </button>
              <button
                type="button"
                onClick={openCreateAccount}
                className="btn-settings-add"
              >
                <Plus size={15} />
                <span>Добавить счёт</span>
              </button>
            </div>
          </div>

          {/* Accounts Grid */}
          <div className="settings-card-grid">
            {accounts.map((acc) => {
              const badgeInfo = getAccountBadge(acc);
              const BadgeIcon = badgeInfo.icon;

              return (
                <div
                  key={acc.id}
                  className="settings-item-card"
                  onClick={() => openEditAccount(acc)}
                  style={{ cursor: 'pointer' }}
                >
                  <div>
                    <div className="settings-card-header">
                      <span
                        className={`settings-account-type-badge ${!acc.color ? badgeInfo.colorClass : ''}`}
                        style={acc.color ? {
                          backgroundColor: `${acc.color}18`,
                          color: acc.color,
                          border: `1px solid ${acc.color}40`,
                        } : undefined}
                      >
                        <BadgeIcon size={12} aria-hidden="true" />
                        <span>{badgeInfo.label}</span>
                      </span>

                      <div className="category-card-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => openEditAccount(acc)}
                          className="btn-card-action"
                          title="Редактировать счёт"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAccount(acc.id, acc.name)}
                          className="btn-card-action btn-card-delete"
                          title="Удалить счёт"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <h4 className="settings-card-title">{acc.name}</h4>
                    {acc.description && <p className="settings-card-meta">{acc.description}</p>}
                  </div>

                  <div className="settings-balance-panel">
                    <span className="settings-balance-label">Текущий остаток</span>
                    <span className="settings-card-balance">{formatRubles(acc.currentBalance)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PARTNERS                                                           */}
      {/* ========================================================================= */}
      {activeTab === 'partners' && (
        <div className="settings-content-section animate-fade-in">
          <div className="settings-subbar">
            <div>
              <h3 className="settings-subheading">Партнёры и соучредители</h3>
              <p className="settings-subtext">Участники бизнеса для выплаты дивидендов и персональных изъятий</p>
            </div>
            <button
              type="button"
              onClick={openCreatePartner}
              className="btn-settings-add"
            >
              <Plus size={15} />
              <span>Добавить партнёра</span>
            </button>
          </div>

          {/* Partners Grid */}
          <div className="settings-card-grid">
            {partners.map((p) => {
              return (
                <div
                  key={p.id}
                  className="settings-item-card"
                  onClick={() => openEditPartner(p)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="settings-partner-row">
                    <div className="settings-partner-info">
                      <div className="settings-partner-avatar" aria-hidden="true">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="settings-card-title">{p.name}</h4>
                        {p.role ? (
                          <span className="settings-partner-role">{p.role}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="category-card-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => openEditPartner(p)}
                        className="btn-card-action"
                        title="Редактировать партнёра"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePartner(p.id, p.name)}
                        className="btn-card-action btn-card-delete"
                        title="Удалить партнёра"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CATEGORIES (Clean, Minimalist Cards - No Wrapping Glitches)        */}
      {/* ========================================================================= */}
      {activeTab === 'categories' && (
        <div className="settings-content-section animate-fade-in">
          <div className="settings-subbar">
            <div>
              <h3 className="settings-subheading">Классификатор статей</h3>
              <p className="settings-subtext">Статьи расходов и доходов для распределения операций и аналитики</p>
            </div>
            <button
              type="button"
              onClick={openCreateCategory}
              className="btn-settings-add"
            >
              <Plus size={15} />
              <span>Добавить статью</span>
            </button>
          </div>

          {/* Categories Grid (Clean compact cards) */}
          <div className="settings-categories-grid">
            {categories.map((cat) => {
              const isExpense = cat.type === 'expense';
              const directionLabel = getCategoryDirectionLabel(cat);

              return (
                <div
                  key={cat.id}
                  className="settings-category-card"
                  onClick={() => openEditCategory(cat)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="category-card-top-row">
                    <div className="category-card-name-wrap">
                      <span
                        className="category-color-dot-sm"
                        style={{ backgroundColor: cat.color || '#2563eb' }}
                      />
                      <span className="category-title-text" title={cat.name}>
                        {cat.name}
                      </span>
                    </div>

                    <div className="category-card-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => openEditCategory(cat)}
                        className="btn-card-action"
                        title="Редактировать статью"
                        aria-label="Редактировать статью"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                        className="btn-card-action btn-card-delete"
                        title="Удалить статью"
                        aria-label="Удалить статью"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="category-card-badges-row">
                    <span className={isExpense ? 'badge-pill-expense' : 'badge-pill-income'}>
                      {isExpense ? 'Расход' : 'Доход'}
                    </span>
                    <span className="badge-pill-scope">
                      {directionLabel}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ACCOUNT (CREATE / EDIT)                                          */}
      {/* ========================================================================= */}
      {modalAccount && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setModalAccount(null)}>
          <div className="settings-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-header">
              <div>
                <h3 className="settings-modal-title">
                  {modalAccount.mode === 'create' ? 'Новый счёт (кошелёк)' : 'Редактирование счёта'}
                </h3>
                <p className="settings-modal-subtitle">
                  Укажите название, тип и параметры счёта
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalAccount(null)}
                className="btn-modal-close"
                title="Закрыть"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAccountSubmit} className="settings-modal-form">
              <div className="settings-input-group">
                <label className="settings-input-label">Название счёта</label>
                <input
                  type="text"
                  required
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  className="settings-text-input"
                  placeholder="например, Т-Банк Расчётный или Нал Склад"
                />
              </div>

              <div className="settings-input-group">
                <label className="settings-input-label">Тип счёта</label>
                <select
                  value={accTypeSelect}
                  onChange={(e) => setAccTypeSelect(e.target.value as any)}
                  className="settings-text-input"
                >
                  <option value="cash">Касса наличных</option>
                  <option value="bank">Безналичный расчётный счёт</option>
                  <option value="card">Карта / СБП (переводы)</option>
                  <option value="safe">Сейф / Резерв</option>
                  <option value="custom">+ Свой тип счёта...</option>
                </select>
              </div>

              {accTypeSelect === 'custom' && (
                <div className="settings-input-group animate-fade-in">
                  <label className="settings-input-label">Название своего типа счёта</label>
                  <input
                    type="text"
                    required
                    value={customAccTypeName}
                    onChange={(e) => setCustomAccTypeName(e.target.value)}
                    className="settings-text-input"
                    placeholder="например: Эквайринг, Депозит, Крипта"
                  />
                </div>
              )}

              <div className="settings-input-group">
                <label className="settings-input-label">
                  {modalAccount.mode === 'create' ? 'Начальный баланс (₽)' : 'Текущий остаток (₽)'}
                </label>
                <input
                  type="number"
                  step="any"
                  value={accBalance !== undefined ? accBalance : ''}
                  placeholder="0"
                  onChange={(e) => setAccBalance(parseFloat(e.target.value) || 0)}
                  className="settings-text-input"
                />
                {modalAccount.mode === 'edit' && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '4px' }}>
                    Вы можете скорректировать фактический остаток (например, указать 0 ₽ или реальный баланс)
                  </span>
                )}
              </div>

              <div className="settings-input-group">
                <label className="settings-input-label">Описание / Назначение</label>
                <input
                  type="text"
                  value={accDesc}
                  placeholder="Для безналичных оплат или личной кассы"
                  onChange={(e) => setAccDesc(e.target.value)}
                  className="settings-text-input"
                />
              </div>

              {/* Значок и цвет счёта */}
              <div className="settings-input-group">
                <label className="settings-input-label">Значок и цвет счёта</label>

                {/* Live Preview */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--surface-sunken)',
                  marginBottom: '12px',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: `${accColor}18`,
                    color: accColor,
                    border: `1.5px solid ${accColor}40`,
                    flexShrink: 0,
                  }}>
                    {React.createElement(ACCOUNT_ICON_MAP[accIcon] || Banknote, { size: 20 })}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {accName.trim() || 'Новый счёт'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                      Так счёт будет выглядеть на карточках и в списках
                    </div>
                  </div>
                </div>

                {/* Color Palette Chips */}
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '6px' }}>
                    Цвет бейджа:
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setAccColor(c)}
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          backgroundColor: c,
                          border: accColor === c ? '2px solid var(--foreground)' : '2px solid transparent',
                          outline: accColor === c ? `2px solid ${c}` : 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0,
                          transition: 'transform 0.15s ease',
                          transform: accColor === c ? 'scale(1.15)' : 'scale(1)',
                        }}
                        title={c}
                      >
                        {accColor === c && <Check size={13} color="#fff" strokeWidth={3} />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Icon Grid */}
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '6px' }}>
                    Иконка счёта:
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                    {ACCOUNT_ICONS.map((item) => {
                      const IconComp = item.icon;
                      const isSelected = accIcon === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setAccIcon(item.id)}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            padding: '8px 4px',
                            borderRadius: '6px',
                            border: isSelected ? `1.5px solid ${accColor}` : '1px solid var(--border)',
                            backgroundColor: isSelected ? `${accColor}15` : 'var(--surface-elevated)',
                            color: isSelected ? accColor : 'var(--foreground)',
                            cursor: 'pointer',
                            fontSize: '0.7rem',
                            transition: 'all 0.15s ease',
                          }}
                          title={item.label}
                        >
                          <IconComp size={18} />
                          <span style={{ fontSize: '0.65rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                            {item.label.split(' / ')[0]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="settings-modal-footer">
                {modalAccount.mode === 'edit' ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteAccount(modalAccount.account.id, modalAccount.account.name)}
                    className="btn-modal-danger"
                  >
                    <Trash2 size={14} />
                    <span>Удалить счёт</span>
                  </button>
                ) : <div />}

                <div className="settings-modal-footer-right">
                  <button
                    type="button"
                    onClick={() => setModalAccount(null)}
                    className="btn-form-cancel"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="btn-form-submit"
                  >
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    <span>{modalAccount.mode === 'create' ? 'Создать счёт' : 'Сохранить'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: PARTNER (CREATE / EDIT)                                          */}
      {/* ========================================================================= */}
      {modalPartner && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setModalPartner(null)}>
          <div className="settings-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-header">
              <div>
                <h3 className="settings-modal-title">
                  {modalPartner.mode === 'create' ? 'Новый партнёр' : 'Редактирование партнёра'}
                </h3>
                <p className="settings-modal-subtitle">
                  Укажите имя и опциональную роль в бизнесе
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalPartner(null)}
                className="btn-modal-close"
                title="Закрыть"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handlePartnerSubmit} className="settings-modal-form">
              <div className="settings-input-group">
                <label className="settings-input-label">Имя партнёра</label>
                <input
                  type="text"
                  required
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  className="settings-text-input"
                  placeholder="например: Влад, Никита, Алексей"
                />
              </div>

              <div className="settings-input-group">
                <label className="settings-input-label">Роль / Должность (необязательно)</label>
                <input
                  type="text"
                  value={partnerRole}
                  onChange={(e) => setPartnerRole(e.target.value)}
                  className="settings-text-input"
                  placeholder="например: Соучредитель, Шеф-бармен, Инвестор (или оставьте пустым)"
                />
              </div>

              <div className="settings-modal-footer">
                {modalPartner.mode === 'edit' ? (
                  <button
                    type="button"
                    onClick={() => handleDeletePartner(modalPartner.partner.id, modalPartner.partner.name)}
                    className="btn-modal-danger"
                  >
                    <Trash2 size={14} />
                    <span>Удалить</span>
                  </button>
                ) : <div />}

                <div className="settings-modal-footer-right">
                  <button
                    type="button"
                    onClick={() => setModalPartner(null)}
                    className="btn-form-cancel"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="btn-form-submit"
                  >
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    <span>{modalPartner.mode === 'create' ? 'Добавить партнёра' : 'Сохранить'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CATEGORY (CREATE / EDIT)                                         */}
      {/* ========================================================================= */}
      {modalCategory && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setModalCategory(null)}>
          <div className="settings-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-header">
              <div>
                <h3 className="settings-modal-title">
                  {modalCategory.mode === 'create' ? 'Новая статья учёта' : 'Редактирование статьи'}
                </h3>
                <p className="settings-modal-subtitle">
                  Настройте название, тип операции, назначение и цвет метки
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalCategory(null)}
                className="btn-modal-close"
                title="Закрыть"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCategorySubmit} className="settings-modal-form">
              <div className="settings-input-group">
                <label className="settings-input-label">Название статьи</label>
                <input
                  type="text"
                  required
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="settings-text-input"
                  placeholder="например, Сервировка, Лёд, Аренда"
                />
              </div>

              <div className="settings-modal-grid-2">
                <div className="settings-input-group">
                  <label className="settings-input-label">Тип статьи</label>
                  <select
                    value={catType}
                    onChange={(e) => setCatType(e.target.value as any)}
                    className="settings-text-input"
                  >
                    <option value="expense">Расход (списание)</option>
                    <option value="income">Доход (поступление)</option>
                  </select>
                </div>

                <div className="settings-input-group">
                  <label className="settings-input-label">Назначение</label>
                  <select
                    value={catDirection}
                    onChange={(e) => setCatDirection(e.target.value as any)}
                    className="settings-text-input"
                  >
                    <option value="operational">Для мероприятий (себестоимость)</option>
                    <option value="business">Накладные расходы бизнеса</option>
                    <option value="dividends">Выплаты соучредителям</option>
                    <option value="all">Универсальная статья</option>
                  </select>
                </div>
              </div>

              <div className="settings-input-group">
                <label className="settings-input-label">Цвет статьи</label>
                <div className="settings-color-picker-row">
                  <div className="color-swatches-row">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCatColor(c)}
                        className={`color-swatch-dot ${catColor === c ? 'swatch-active' : ''}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <input
                    type="color"
                    value={catColor}
                    onChange={(e) => setCatColor(e.target.value)}
                    className="color-native-input"
                    title="Выбрать свой цвет"
                  />
                </div>
              </div>

              <div className="settings-modal-footer">
                {modalCategory.mode === 'edit' ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(modalCategory.category.id, modalCategory.category.name)}
                    className="btn-modal-danger"
                  >
                    <Trash2 size={14} />
                    <span>Удалить статью</span>
                  </button>
                ) : <div />}

                <div className="settings-modal-footer-right">
                  <button
                    type="button"
                    onClick={() => setModalCategory(null)}
                    className="btn-form-cancel"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="btn-form-submit"
                  >
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    <span>{modalCategory.mode === 'create' ? 'Создать статью' : 'Сохранить'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
