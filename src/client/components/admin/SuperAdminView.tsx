/**
 * Truespace — Барный кейтеринг и финансы
 * Dedicated SuperAdmin & SaaS Platform View (`src/client/components/admin/SuperAdminView.tsx`)
 *
 * Full-page workspace for:
 * 1. Supabase Cloud Connection & Sync (credentials testing, migration execution, data export)
 * 2. Multi-Tenant Organization Management (creating companies, switching active company)
 * 3. Team & Co-founder Permissions (Nikita as SuperAdmin, Vlad as Co-founder, staff invites)
 */

import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Building2,
  Users,
  UserPlus,
  ArrowRight,
  Crown,
  Check,
  Edit2,
  X,
  Trash2,
  KeyRound,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { UserRole, Company, UserProfile } from '../../../shared/types.js';

type AdminTab = 'companies' | 'team';

export const SuperAdminView: React.FC = () => {
  const {
    currentUser,
    isSuperAdmin,
    usersList,
    currentCompany,
    companiesList,
    switchCompany,
    createCompany,
    deleteCompany,
    inviteMember,
    updateProfile,
    changeUserEmail,
    changeUserPassword,
    updateCompanyDetails,
    refreshAuthData,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<AdminTab>('companies');

  // Delete Company Modal
  const [deletingCompany, setDeletingCompany] = useState<Company | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingCo, setIsDeletingCo] = useState(false);
  const [deleteCoError, setDeleteCoError] = useState<string | null>(null);

  const openDeleteCompanyModal = (co: Company) => {
    setDeletingCompany(co);
    setDeleteConfirmText('');
    setDeleteCoError(null);
  };

  const handleConfirmDeleteCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletingCompany) return;
    if (deleteConfirmText.trim() !== deletingCompany.name.trim()) {
      setDeleteCoError(`Введите точное название «${deletingCompany.name}» для подтверждения`);
      return;
    }

    setIsDeletingCo(true);
    setDeleteCoError(null);
    try {
      await deleteCompany(deletingCompany.id);
      setDeletingCompany(null);
      await refreshAuthData();
    } catch (err: any) {
      setDeleteCoError(err.message || 'Ошибка при удалении организации');
    } finally {
      setIsDeletingCo(false);
    }
  };

  // Filter out platform and test companies
  const clientCompanies = useMemo(() => {
    return companiesList.filter(
      (co) => co.id !== 'company_truespace_default' && co.id !== 'company_platform_admin' && co.slug !== 'truespace-catering'
    );
  }, [companiesList]);

  // Edit Profile / Password Modal
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserPassword, setEditUserPassword] = useState('');
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [editUserFeedback, setEditUserFeedback] = useState<string | null>(null);

  // Edit Company Modal
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editCompanyName, setEditCompanyName] = useState('');
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [editCompanyFeedback, setEditCompanyFeedback] = useState<string | null>(null);

  // Quick Billing Action feedback
  const [billingFeedback, setBillingFeedback] = useState<{ companyId: string; message: string } | null>(null);

  const openEditUser = (user: UserProfile) => {
    setEditingUser(user);
    setEditUserName(user.fullName || '');
    setEditUserEmail(user.email || '');
    setEditUserPassword('');
    setEditUserFeedback(null);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSavingUser(true);
    setEditUserFeedback(null);
    try {
      const emailChanged = editUserEmail.trim().toLowerCase() !== editingUser.email.toLowerCase();
      const nameChanged = editUserName.trim() !== (editingUser.fullName || '');

      if (emailChanged) {
        await changeUserEmail(editingUser.id, editUserEmail.trim().toLowerCase());
      }
      if (nameChanged) {
        await updateProfile(editingUser.id, {
          fullName: editUserName.trim(),
        });
      }
      if (editUserPassword.trim()) {
        if (editUserPassword.trim().length < 6) {
          throw new Error('Пароль должен содержать минимум 6 символов');
        }
        await changeUserPassword(editingUser.id, editUserPassword.trim());
      }
      await refreshAuthData();
      setEditUserFeedback('✅ Данные пользователя успешно сохранены');
      setTimeout(() => {
        setEditingUser(null);
        setEditUserFeedback(null);
        setEditUserPassword('');
      }, 700);
    } catch (err: any) {
      setEditUserFeedback(`Ошибка: ${err.message || 'Не удалось обновить данные'}`);
    } finally {
      setIsSavingUser(false);
    }
  };

  const openEditCompany = (company: Company) => {
    setEditingCompany(company);
    setEditCompanyName(company.name || '');
    setEditCompanyFeedback(null);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany || !editCompanyName.trim()) return;
    setIsSavingCompany(true);
    setEditCompanyFeedback(null);
    try {
      await updateCompanyDetails(editingCompany.id, {
        name: editCompanyName.trim(),
      });
      setEditCompanyFeedback('✅ Название организации сохранено');
      setTimeout(() => {
        setEditingCompany(null);
        setEditCompanyFeedback(null);
      }, 600);
    } catch (err: any) {
      setEditCompanyFeedback(`Ошибка: ${err.message || 'Не удалось переименовать организацию'}`);
    } finally {
      setIsSavingCompany(false);
    }
  };

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('staff');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);

  // New company state
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyPlan, setNewCompanyPlan] = useState<'free' | 'starter' | 'pro'>('pro');
  const [isCreatingCo, setIsCreatingCo] = useState(false);
  const [companyFeedback, setCompanyFeedback] = useState<string | null>(null);

  // Handle invite member
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setIsInviting(true);
    setInviteFeedback(null);
    try {
      await inviteMember(inviteEmail.trim(), inviteRole, inviteName.trim() || undefined);
      setInviteFeedback(`Приглашение для ${inviteEmail} успешно создано!`);
      setInviteEmail('');
      setInviteName('');
    } catch (err: any) {
      setInviteFeedback(`Ошибка: ${err.message || 'Не удалось отправить приглашение'}`);
    } finally {
      setIsInviting(false);
    }
  };

  // Handle create company
  const handleCreateCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    setIsCreatingCo(true);
    setCompanyFeedback(null);
    try {
      const created = await createCompany(newCompanyName.trim());
      setCompanyFeedback(`Организация «${created.name}» успешно создана!`);
      setNewCompanyName('');
      await refreshAuthData();
    } catch (err: any) {
      setCompanyFeedback(`Ошибка: ${err.message || 'Не удалось создать компанию'}`);
    } finally {
      setIsCreatingCo(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="saas-admin-container animate-fade-in" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ maxWidth: '420px', margin: '0 auto', background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border)', borderRadius: '16px', padding: '32px 24px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          <ShieldAlert size={48} color="#ef4444" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px', color: 'var(--foreground)' }}>Доступ ограничен</h2>
          <p style={{ fontSize: '14px', color: 'var(--muted-foreground)', marginBottom: '24px', lineHeight: 1.5 }}>
            Панель управления платформой доступна только суперадминистраторам.
          </p>
          <button
            type="button"
            className="btn-form-submit"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => { window.location.hash = '#accounts'; }}
          >
            Вернуться к счетам
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="saas-admin-container animate-fade-in">
      {/* 1. Header Banner */}
      <div className="saas-header-card">
        <div className="saas-header-content">
          <div className="saas-header-badge-group">
            <div className="saas-crown-icon" aria-hidden="true">
              <Crown size={24} />
            </div>
            <div>
              <div className="saas-title-row">
                <h2 className="saas-title">Админ-панель платформы</h2>
                <span className="saas-badge-pill">Управление платформой и биллингом</span>
              </div>
              <p className="saas-subtitle">
                Управление организациями, продление триалов, контроль оплат и профили пользователей
              </p>
            </div>
          </div>

          {/* User Profile Info Box */}
          <div className="saas-profile-box">
            <div className="saas-user-info">
              <span className="saas-user-title">Администратор платформы:</span>
              <div className="saas-user-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong>{currentUser?.fullName || 'Администратор'}</strong>
                <span className="saas-role-crown">👑 Главный админ</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span className="saas-company-tag" style={{ color: 'var(--muted-foreground)' }}>
                  Email: {currentUser?.email || 'admin@gmail.com'}
                </span>
                {currentUser && (
                  <button
                    type="button"
                    onClick={() => openEditUser(currentUser)}
                    className="btn-action-ghost"
                    style={{ padding: '2px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    title="Настроить имя, email или пароль"
                  >
                    <Edit2 size={11} />
                    <span>Настроить профиль</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick feedback banner for billing actions */}
      {billingFeedback && (
        <div className="saas-alert saas-alert-success animate-fade-in" style={{ marginBottom: '16px' }}>
          <CheckCircle2 size={16} />
          <span>{billingFeedback.message}</span>
        </div>
      )}

      {/* 2. Sub Navigation Tabs: ONLY Companies & Team */}
      <div className="saas-nav-tabs">
        <button
          type="button"
          onClick={() => setActiveTab('companies')}
          className={`saas-tab-item ${activeTab === 'companies' ? 'saas-tab-item-active' : ''}`}
        >
          <Building2 size={17} />
          <span>Организации и компании ({clientCompanies.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('team')}
          className={`saas-tab-item ${activeTab === 'team' ? 'saas-tab-item-active' : ''}`}
        >
          <Users size={17} />
          <span>Команда и пользователи ({usersList.length})</span>
        </button>
      </div>

      {/* TAB 2: TEAM & CO-FOUNDERS */}
      {/* TAB 2: TEAM & USERS */}
      {activeTab === 'team' && (
        <div className="saas-section-grid">
          {/* Members List */}
          <div className="saas-card">
            <div className="saas-card-header">
              <div className="saas-card-title-group">
                <Users size={18} className="text-accent" />
                <h3 className="saas-card-title">
                  Пользователи платформы ({usersList.length})
                </h3>
              </div>
            </div>

            <div className="saas-card-body">
              <div className="saas-members-grid">
                {usersList.map((usr) => {
                  const isCurrent = usr.id === currentUser?.id;
                  const isSuper = usr.isSuperAdmin;

                  // Find company this user belongs to
                  const userCo = companiesList.find((c) => c.ownerId === usr.id) ||
                    companiesList.find((c) => (usr as any).companyId === c.id);
                  const companyName = userCo?.name || (usr as any).companyName || (isSuper ? 'Платформа (Админ)' : 'Организация');

                  return (
                    <div key={usr.id} className="saas-member-card">
                      <div className="saas-member-avatar-col">
                        <div
                          className={`saas-member-avatar ${
                            isSuper ? 'saas-avatar-crown' : ''
                          }`}
                        >
                          {isSuper ? '👑' : (usr.fullName || usr.email || 'U')[0].toUpperCase()}
                        </div>
                      </div>

                      <div className="saas-member-details">
                        <div className="saas-member-name-row">
                          <span className="saas-member-name">
                            {usr.fullName || usr.email.split('@')[0]}
                          </span>
                          {isCurrent && <span className="saas-badge-you">Это вы</span>}
                        </div>
                        <span className="saas-member-email">{usr.email}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                          <span className="saas-member-role-badge">
                            {isSuper ? '👑 Суперадминистратор' : 'Владелец бизнеса'}
                          </span>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              color: 'var(--muted-foreground, #78716c)',
                              background: 'var(--muted, #f4f3f1)',
                              padding: '2px 7px',
                              borderRadius: '6px',
                              border: '1px solid var(--border, #e7e5e2)',
                            }}
                          >
                            🏢 {companyName}
                          </span>
                        </div>
                      </div>

                      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => openEditUser(usr)}
                          className="btn-action-ghost"
                          style={{ padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                          title="Редактировать имя, email или пароль"
                        >
                          <Edit2 size={13} />
                          <span>Настроить</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Invite Form */}
          <div className="saas-card">
            <div className="saas-card-header">
              <div className="saas-card-title-group">
                <UserPlus size={18} className="text-accent" />
                <h3 className="saas-card-title">Пригласить сотрудника или партнёра</h3>
              </div>
            </div>

            <div className="saas-card-body">
              {inviteFeedback && (
                <div
                  className={`saas-alert ${
                    inviteFeedback.startsWith('Ошибка') ? 'saas-alert-error' : 'saas-alert-success'
                  }`}
                >
                  {inviteFeedback.startsWith('Ошибка') ? (
                    <AlertTriangle size={16} />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  <span>{inviteFeedback}</span>
                </div>
              )}

              <form onSubmit={handleInviteSubmit} className="saas-form">
                <div className="saas-field-group">
                  <label className="saas-label">Email сотрудника</label>
                  <input
                    type="email"
                    required
                    placeholder="partner@truespace.ru"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="saas-input"
                  />
                </div>

                <div className="saas-field-group">
                  <label className="saas-label">Имя и фамилия</label>
                  <input
                    type="text"
                    placeholder="Например, Алексей (Старший бармен)"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="saas-input"
                  />
                </div>

                <div className="saas-field-group">
                  <label className="saas-label">Роль и уровень доступа</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as UserRole)}
                    className="saas-select"
                  >
                    <option value="staff">Сотрудник / Бармен (просмотр и внесение смен)</option>
                    <option value="admin">Администратор (редактирование счетов и мероприятий)</option>
                    <option value="owner">Сооснователь / Владелец (полные права в компании)</option>
                  </select>
                </div>

                <div className="saas-form-actions">
                  <button
                    type="submit"
                    disabled={isInviting}
                    className="btn-primary-gradient"
                  >
                    <UserPlus size={15} />
                    <span>{isInviting ? 'Отправка...' : 'Отправить приглашение'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: COMPANIES */}
      {activeTab === 'companies' && (
        <div className="saas-section-grid">
          {/* Companies List */}
          <div className="saas-card">
            <div className="saas-card-header">
              <div className="saas-card-title-group">
                <Building2 size={18} className="text-accent" />
                <h3 className="saas-card-title">Зарегистрированные организации</h3>
              </div>
            </div>

            <div className="saas-card-body">
              <div className="saas-companies-grid">
                {clientCompanies.map((co) => {
                  const isCurrent = co.id === currentCompany?.id;
                  const isSystem = Boolean((co as any).isSystem || co.id === 'company_platform_admin');

                  const isPaid = Boolean(co.paidUntil && new Date(co.paidUntil).getTime() > Date.now());
                  const isTrialActive = Boolean(co.trialEndsAt && new Date(co.trialEndsAt).getTime() > Date.now());
                  const isTrialExpired = Boolean(co.trialEndsAt && new Date(co.trialEndsAt).getTime() <= Date.now());

                  const trialDaysLeft = co.trialEndsAt && isTrialActive
                    ? Math.max(1, Math.ceil((new Date(co.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                    : 0;

                  return (
                    <div
                      key={co.id}
                      className={`saas-company-card ${isCurrent ? 'saas-company-card-active' : ''}`}
                    >
                      <div className="saas-company-top">
                        <div className="saas-company-title-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span className="saas-company-name">{co.name}</span>
                          <span className="saas-plan-tag">{co.plan.toUpperCase()}</span>
                          {isSystem && (
                            <span className="saas-platform-badge">
                              🛡️ Платформа
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditCompany(co)}
                            className="btn-action-ghost"
                            style={{ padding: '3px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            title="Переименовать компанию"
                          >
                            <Edit2 size={11} />
                            <span>Переименовать</span>
                          </button>
                        </div>
                        {isCurrent && (
                          <span className="saas-badge-current">
                            <CheckCircle2 size={13} /> Активная
                          </span>
                        )}
                      </div>

                      {/* Billing & Trial Status Banner */}
                      <div
                        style={{
                          marginTop: '12px',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          background: isPaid
                            ? 'rgba(16, 185, 129, 0.08)'
                            : isTrialActive
                            ? 'rgba(59, 130, 246, 0.08)'
                            : 'rgba(239, 68, 68, 0.08)',
                          border: `1px solid ${
                            isPaid
                              ? 'rgba(16, 185, 129, 0.25)'
                              : isTrialActive
                              ? 'rgba(59, 130, 246, 0.25)'
                              : 'rgba(239, 68, 68, 0.25)'
                          }`,
                          fontSize: '0.82rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 600 }}>
                          <span>Биллинг & Тариф:</span>
                          {isPaid ? (
                            <span style={{ color: '#10b981' }}>
                              🟢 Оплачено до {new Date(co.paidUntil!).toLocaleDateString('ru-RU')}
                            </span>
                          ) : isTrialActive ? (
                            <span style={{ color: '#3b82f6' }}>
                              🔵 Пробный период (ещё {trialDaysLeft} дн. до {new Date(co.trialEndsAt!).toLocaleDateString('ru-RU')})
                            </span>
                          ) : isTrialExpired ? (
                            <span style={{ color: '#ef4444' }}>
                              🔴 Пробный период истёк ({new Date(co.trialEndsAt!).toLocaleDateString('ru-RU')})
                            </span>
                          ) : (
                            <span style={{ color: 'var(--muted-foreground)' }}>⚪ Ожидает оплаты / Без триала</span>
                          )}
                        </div>

                        {co.paidUntil && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                            Оплаченный доступ активен до: <strong>{new Date(co.paidUntil).toLocaleDateString('ru-RU')}</strong>
                          </div>
                        )}
                        {co.trialEndsAt && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                            Дата окончания триала: <strong>{new Date(co.trialEndsAt).toLocaleDateString('ru-RU')}</strong>
                          </div>
                        )}
                      </div>

                      {/* Quick Trial & Billing Actions */}
                      <div style={{ marginTop: '12px' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: '6px' }}>
                          Действия администратора:
                        </div>
                        <div className="saas-actions-flex">
                          <button
                            type="button"
                            onClick={async () => {
                              const newDate = new Date(Date.now() + 14 * 86400000).toISOString();
                              await updateCompanyDetails(co.id, { trialEndsAt: newDate, paidUntil: null, plan: 'pro' });
                              await refreshAuthData();
                              setBillingFeedback({ companyId: co.id, message: `✅ Для «${co.name}» активирован пробный период на 14 дней` });
                              setTimeout(() => setBillingFeedback(null), 4000);
                            }}
                            className="btn-action-ghost saas-admin-action-btn"
                            title="Установить 14 дней пробного периода с сегодняшнего дня"
                          >
                            +14 дней триала
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const newDate = new Date(Date.now() + 30 * 86400000).toISOString();
                              await updateCompanyDetails(co.id, { trialEndsAt: newDate, paidUntil: null, plan: 'pro' });
                              await refreshAuthData();
                              setBillingFeedback({ companyId: co.id, message: `✅ Для «${co.name}» активирован пробный период на 30 дней` });
                              setTimeout(() => setBillingFeedback(null), 4000);
                            }}
                            className="btn-action-ghost saas-admin-action-btn"
                            title="Установить 30 дней пробного периода"
                          >
                            +30 дней
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const newDate = new Date(Date.now() + 365 * 86400000).toISOString();
                              await updateCompanyDetails(co.id, { paidUntil: newDate, trialEndsAt: null, plan: 'pro' });
                              await refreshAuthData();
                              setBillingFeedback({ companyId: co.id, message: `✅ Для «${co.name}» оформлен доступ на 1 год` });
                              setTimeout(() => setBillingFeedback(null), 4000);
                            }}
                            className="btn-action-ghost saas-admin-action-btn-success"
                            title="Отметить как оплаченную подписку на 1 год"
                          >
                            Оплачено (1 год)
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const newDate = new Date(Date.now() + 100 * 365 * 86400000).toISOString();
                              await updateCompanyDetails(co.id, { paidUntil: newDate, trialEndsAt: null, plan: 'pro' });
                              await refreshAuthData();
                              setBillingFeedback({ companyId: co.id, message: `✅ Для «${co.name}» активирован бессрочный VIP-доступ` });
                              setTimeout(() => setBillingFeedback(null), 4000);
                            }}
                            className="btn-action-ghost saas-admin-action-btn-warning"
                            title="Бессрочный VIP-доступ для сооснователей или спецклиентов"
                          >
                            Бессрочно (VIP)
                          </button>
                          {(co.trialEndsAt || isTrialActive) && (
                            <button
                              type="button"
                              onClick={async () => {
                                await updateCompanyDetails(co.id, { trialEndsAt: null });
                                await refreshAuthData();
                                setBillingFeedback({ companyId: co.id, message: `Пробный период для «${co.name}» снят` });
                                setTimeout(() => setBillingFeedback(null), 4000);
                              }}
                              className="btn-action-ghost saas-admin-action-btn-danger"
                              title="Снять пробный период прямо сейчас"
                            >
                              Снять триал
                            </button>
                          )}
                          {co.paidUntil && (
                            <button
                              type="button"
                              onClick={async () => {
                                await updateCompanyDetails(co.id, { paidUntil: null });
                                await refreshAuthData();
                                setBillingFeedback({ companyId: co.id, message: `Оплаченный доступ для «${co.name}» аннулирован` });
                                setTimeout(() => setBillingFeedback(null), 4000);
                              }}
                              className="btn-action-ghost saas-admin-action-btn-danger"
                              title="Аннулировать оплаченный период"
                            >
                              Снять оплату
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="saas-company-meta" style={{ marginTop: '12px' }}>
                        <span>Идентификатор: <code>{co.slug}</code></span>
                        <span>Создана: {new Date(co.createdAt).toLocaleDateString('ru-RU')}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                        {!isCurrent ? (
                          <button
                            type="button"
                            onClick={() => switchCompany(co.id)}
                            className="btn-action-outline saas-switch-company-btn"
                            style={{ margin: 0 }}
                          >
                            <ArrowRight size={14} />
                            <span>Войти в компанию</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
                            Текущая организация
                          </span>
                        )}

                        {!isSystem && (
                          <button
                            type="button"
                            onClick={() => openDeleteCompanyModal(co)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.08)',
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              color: '#ef4444',
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              fontWeight: 500,
                            }}
                            title="Безвозвратно удалить организацию и все её данные"
                          >
                            <Trash2 size={13} />
                            <span>Удалить</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Create Company Form */}
          <div className="saas-card">
            <div className="saas-card-header">
              <div className="saas-card-title-group">
                <Building2 size={18} className="text-accent" />
                <h3 className="saas-card-title">Создать новый кейтеринговый бизнес</h3>
              </div>
            </div>

            <div className="saas-card-body">
              {companyFeedback && (
                <div
                  className={`saas-alert ${
                    companyFeedback.startsWith('Ошибка') ? 'saas-alert-error' : 'saas-alert-success'
                  }`}
                >
                  {companyFeedback.startsWith('Ошибка') ? (
                    <AlertTriangle size={16} />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  <span>{companyFeedback}</span>
                </div>
              )}

              <form onSubmit={handleCreateCompanySubmit} className="saas-form">
                <div className="saas-field-group">
                  <label className="saas-label">Название организации</label>
                  <input
                    type="text"
                    required
                    placeholder="Например: Truespace Юг или Коктейли СПБ"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    className="saas-input"
                  />
                </div>

                <div className="saas-field-group">
                  <label className="saas-label">Тарифный план</label>
                  <select
                    value={newCompanyPlan}
                    onChange={(e) => setNewCompanyPlan(e.target.value as any)}
                    className="saas-select"
                  >
                    <option value="pro">Pro (Безлимитные счета, маржинальность, Telegram-бот)</option>
                    <option value="starter">Starter (До 3 счетов, базовые отчеты)</option>
                    <option value="free">Free (Пробный период)</option>
                  </select>
                </div>

                <div className="saas-form-actions">
                  <button
                    type="submit"
                    disabled={isCreatingCo}
                    className="btn-primary-gradient"
                  >
                    <Building2 size={15} />
                    <span>{isCreatingCo ? 'Создание...' : 'Создать организацию'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit User Profile */}
      {editingUser && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setEditingUser(null)} role="presentation">
          <div
            className="quick-entry-bottom-sheet animate-slide-up"
            style={{ maxWidth: '440px', margin: 'auto' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <div className="modal-header-row">
              <div>
                <h3 className="modal-title">Настройка профиля сотрудника</h3>
                <p className="modal-subtitle">Изменение отображаемого имени и контактного email</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="btn-modal-close"
                aria-label="Закрыть"
              >
                <X size={18} />
              </button>
            </div>

            {editUserFeedback && (
              <div
                className={`saas-alert ${editUserFeedback.startsWith('Ошибка') ? 'saas-alert-error' : 'saas-alert-success'}`}
                style={{ marginTop: '12px' }}
              >
                <span>{editUserFeedback}</span>
              </div>
            )}

            <form onSubmit={handleSaveUser} className="saas-form" style={{ marginTop: '16px' }}>
              <div className="saas-field-group">
                <label className="saas-label">Имя и фамилия / Должность</label>
                <input
                  type="text"
                  required
                  value={editUserName}
                  onChange={(e) => setEditUserName(e.target.value)}
                  className="saas-input"
                  placeholder="Например, Никита или Влад"
                />
              </div>

              <div className="saas-field-group">
                <label className="saas-label">Рабочий Email</label>
                <input
                  type="email"
                  required
                  value={editUserEmail}
                  onChange={(e) => setEditUserEmail(e.target.value)}
                  className="saas-input"
                  placeholder="user@truespace.ru"
                />
              </div>

              <div className="saas-field-group">
                <label className="saas-label">
                  <span>Новый пароль</span>
                  <span className="saas-label-hint">Оставьте пустым, если не меняется</span>
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="password"
                    value={editUserPassword}
                    onChange={(e) => setEditUserPassword(e.target.value)}
                    className="saas-input"
                    placeholder="Минимум 6 символов"
                    autoComplete="new-password"
                  />
                  <div style={{ position: 'absolute', right: '12px', color: 'var(--muted-foreground)', pointerEvents: 'none' }}>
                    <KeyRound size={15} />
                  </div>
                </div>
              </div>

              <div className="saas-form-actions" style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="btn-action-outline"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSavingUser}
                  className="btn-primary-gradient"
                >
                  <Check size={14} />
                  <span>{isSavingUser ? 'Сохранение...' : 'Сохранить изменения'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Company Details */}
      {editingCompany && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setEditingCompany(null)} role="presentation">
          <div
            className="quick-entry-bottom-sheet animate-slide-up"
            style={{ maxWidth: '440px', margin: 'auto' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <div className="modal-header-row">
              <div>
                <h3 className="modal-title">Настройка организации</h3>
                <p className="modal-subtitle">Изменение официального названия бизнеса в системе</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingCompany(null)}
                className="btn-modal-close"
                aria-label="Закрыть"
              >
                <X size={18} />
              </button>
            </div>

            {editCompanyFeedback && (
              <div
                className={`saas-alert ${editCompanyFeedback.startsWith('Ошибка') ? 'saas-alert-error' : 'saas-alert-success'}`}
                style={{ marginTop: '12px' }}
              >
                <span>{editCompanyFeedback}</span>
              </div>
            )}

            <form onSubmit={handleSaveCompany} className="saas-form" style={{ marginTop: '16px' }}>
              <div className="saas-field-group">
                <label className="saas-label">Название организации / бизнеса</label>
                <input
                  type="text"
                  required
                  value={editCompanyName}
                  onChange={(e) => setEditCompanyName(e.target.value)}
                  className="saas-input"
                  placeholder="Например, Brilliant Event"
                />
              </div>

              <div className="saas-form-actions" style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setEditingCompany(null)}
                  className="btn-action-outline"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSavingCompany}
                  className="btn-primary-gradient"
                >
                  <Check size={14} />
                  <span>{isSavingCompany ? 'Сохранение...' : 'Сохранить название'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Company Confirmation */}
      {deletingCompany && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setDeletingCompany(null)} role="presentation">
          <div
            className="quick-entry-bottom-sheet animate-slide-up"
            style={{ maxWidth: '460px', margin: 'auto' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <div className="modal-header-row">
              <div>
                <h3 className="modal-title" style={{ color: '#ef4444' }}>Удаление организации</h3>
                <p className="modal-subtitle">Безвозвратное удаление компании из базы данных</p>
              </div>
              <button
                type="button"
                onClick={() => setDeletingCompany(null)}
                className="btn-modal-close"
                aria-label="Закрыть"
              >
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                marginTop: '14px',
                padding: '12px 14px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                fontSize: '0.85rem',
                lineHeight: 1.5,
                color: '#ef4444',
              }}
            >
              ⚠️ Внимание! Будут безвозвратно удалены все связанные счета, финансовые операции, мероприятия, статьи расходов и состав команды для организации <strong>«{deletingCompany.name}»</strong>.
            </div>

            {deleteCoError && (
              <div
                className="saas-alert saas-alert-error"
                style={{ marginTop: '12px' }}
              >
                <span>{deleteCoError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmDeleteCompany} className="saas-form" style={{ marginTop: '16px' }}>
              <div className="saas-field-group">
                <label className="saas-label" style={{ fontSize: '0.8rem' }}>
                  Для подтверждения введите точное имя компании: <strong>{deletingCompany.name}</strong>
                </label>
                <input
                  type="text"
                  required
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="saas-input"
                  placeholder={deletingCompany.name}
                  autoFocus
                />
              </div>

              <div className="saas-form-actions" style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setDeletingCompany(null)}
                  className="btn-action-outline"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isDeletingCo || deleteConfirmText.trim() !== deletingCompany.name.trim()}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: deleteConfirmText.trim() === deletingCompany.name.trim() ? '#ef4444' : 'rgba(239, 68, 68, 0.3)',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 600,
                    cursor: deleteConfirmText.trim() === deletingCompany.name.trim() ? 'pointer' : 'not-allowed',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.85rem',
                  }}
                >
                  <Trash2 size={14} />
                  <span>{isDeletingCo ? 'Удаление...' : 'Да, удалить навсегда'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminView;
