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
  ShieldAlert,
  Lock,
  Laptop,
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
    changeUserPassword,
    requestEmailChangeCode,
    verifyOldEmailCode,
    confirmNewEmail,
    requestPasswordCode,
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

  // Edit Profile & Security 2-Column Modal
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [modalTab, setModalTab] = useState<'profile' | 'security' | 'sessions'>('security');

  // Profile Tab States
  const [editUserName, setEditUserName] = useState('');
  const [editUserPosition, setEditUserPosition] = useState('');
  const [editUserPhone, setEditUserPhone] = useState('');
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [editUserFeedback, setEditUserFeedback] = useState<string | null>(null);

  // Security Tab States — Email Flow
  const [isEmailFlowOpen, setIsEmailFlowOpen] = useState(false);
  const [emailStep, setEmailStep] = useState<'step1_old' | 'step2_new'>('step1_old');
  const [currentPassForEmail, setCurrentPassForEmail] = useState('');
  const [oldEmailCode, setOldEmailCode] = useState(['', '', '', '', '', '']);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [newEmailCode, setNewEmailCode] = useState(['', '', '', '', '', '']);
  const [isSendingOldCode, setIsSendingOldCode] = useState(false);
  const [isSendingNewCode, setIsSendingNewCode] = useState(false);
  const [isFinalizingEmail, setIsFinalizingEmail] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<string | null>(null);

  // Security Tab States — Password Flow
  const [isPassFlowOpen, setIsPassFlowOpen] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [repeatPass, setRepeatPass] = useState('');
  const [passCode, setPassCode] = useState(['', '', '', '', '', '']);
  const [isSendingPassCode, setIsSendingPassCode] = useState(false);
  const [isFinalizingPass, setIsFinalizingPass] = useState(false);
  const [passFeedback, setPassFeedback] = useState<string | null>(null);

  const resetSecurityFlows = () => {
    setIsEmailFlowOpen(false);
    setEmailStep('step1_old');
    setCurrentPassForEmail('');
    setOldEmailCode(['', '', '', '', '', '']);
    setNewEmailInput('');
    setNewEmailCode(['', '', '', '', '', '']);
    setEmailFeedback(null);

    setIsPassFlowOpen(false);
    setCurrentPass('');
    setNewPass('');
    setRepeatPass('');
    setPassCode(['', '', '', '', '', '']);
    setPassFeedback(null);
  };

  const openEditUser = (user: UserProfile, initialTab: 'profile' | 'security' | 'sessions' = 'security') => {
    setEditingUser(user);
    setModalTab(initialTab);
    setEditUserName(user.fullName || '');
    setEditUserPosition((user as any).position || (user.isSuperAdmin ? 'Владелец бизнеса (Superadmin)' : 'Партнёр компании'));
    setEditUserPhone((user as any).phone || '+7 (999) 000-00-00');
    setEditUserFeedback(null);
    resetSecurityFlows();
  };

  const closeEditUserModal = () => {
    setEditingUser(null);
    setEditUserFeedback(null);
    resetSecurityFlows();
  };

  const handleCodeBoxInput = (
    index: number,
    value: string,
    currentArray: string[],
    setArray: React.Dispatch<React.SetStateAction<string[]>>,
    containerId: string
  ) => {
    const digit = value.slice(-1);
    const updated = [...currentArray];
    updated[index] = digit;
    setArray(updated);
    if (digit && index < 5) {
      const container = document.getElementById(containerId);
      if (container) {
        const inputs = container.querySelectorAll<HTMLInputElement>('.code-box-input');
        inputs[index + 1]?.focus();
      }
    }
  };

  // Handlers for Profile saving
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSavingUser(true);
    setEditUserFeedback(null);
    try {
      await updateProfile(editingUser.id, {
        fullName: editUserName.trim(),
      });
      await refreshAuthData();
      setEditUserFeedback('✅ Личные данные успешно сохранены');
      setTimeout(() => setEditUserFeedback(null), 3000);
    } catch (err: any) {
      setEditUserFeedback(`Ошибка: ${err.message || 'Не удалось сохранить профиль'}`);
    } finally {
      setIsSavingUser(false);
    }
  };

  // Handlers for Email change
  const handleSendOldEmailCode = async () => {
    if (!editingUser || !currentPassForEmail) return;
    setIsSendingOldCode(true);
    setEmailFeedback(null);
    try {
      await requestEmailChangeCode(editingUser.id, currentPassForEmail);
      setEmailFeedback(`✅ Код отправлен на текущий адрес ${editingUser.email}`);
    } catch (err: any) {
      setEmailFeedback(`Ошибка: ${err.message || 'Не удалось отправить код'}`);
    } finally {
      setIsSendingOldCode(false);
    }
  };

  const handleVerifyOldCodeAndProceed = async () => {
    if (!editingUser) return;
    const code = oldEmailCode.join('').trim();
    if (code.length !== 6) {
      setEmailFeedback('Ошибка: введите полный 6-значный проверочный код');
      return;
    }
    setEmailStep('step2_new');
    setEmailFeedback(null);
  };

  const handleSendNewEmailCode = async () => {
    if (!editingUser || !newEmailInput.includes('@')) return;
    setIsSendingNewCode(true);
    setEmailFeedback(null);
    try {
      await verifyOldEmailCode(editingUser.id, oldEmailCode.join('').trim(), newEmailInput.trim().toLowerCase());
      setEmailFeedback(`✅ Код подтверждения отправлен на ${newEmailInput}`);
    } catch (err: any) {
      setEmailFeedback(`Ошибка: ${err.message || 'Не удалось отправить код'}`);
    } finally {
      setIsSendingNewCode(false);
    }
  };

  const handleConfirmNewEmail = async () => {
    if (!editingUser) return;
    const code = newEmailCode.join('').trim();
    if (code.length !== 6) {
      setEmailFeedback('Ошибка: введите полный 6-значный проверочный код с нового адреса');
      return;
    }
    setIsFinalizingEmail(true);
    setEmailFeedback(null);
    try {
      await confirmNewEmail(editingUser.id, newEmailInput.trim().toLowerCase(), code);
      await refreshAuthData();
      setEditUserFeedback(`✅ Email успешно изменён на ${newEmailInput.trim().toLowerCase()}`);
      resetSecurityFlows();
    } catch (err: any) {
      setEmailFeedback(`Ошибка: ${err.message || 'Не удалось завершить смену Email'}`);
    } finally {
      setIsFinalizingEmail(false);
    }
  };

  // Handlers for Password change
  const handleSendPassCode = async () => {
    if (!editingUser || !currentPass) return;
    setIsSendingPassCode(true);
    setPassFeedback(null);
    try {
      await requestPasswordCode(editingUser.id, currentPass);
      setPassFeedback(`✅ Код подтверждения отправлен на ваш адрес ${editingUser.email}`);
    } catch (err: any) {
      setPassFeedback(`Ошибка: ${err.message || 'Не удалось отправить код'}`);
    } finally {
      setIsSendingPassCode(false);
    }
  };

  const handleConfirmPasswordChange = async () => {
    if (!editingUser) return;
    if (newPass.length < 6) {
      setPassFeedback('Ошибка: пароль должен содержать минимум 6 символов');
      return;
    }
    if (newPass !== repeatPass) {
      setPassFeedback('Ошибка: пароли не совпадают');
      return;
    }
    const code = passCode.join('').trim();
    setIsFinalizingPass(true);
    setPassFeedback(null);
    try {
      await changeUserPassword(editingUser.id, newPass, currentPass, code || undefined);
      await refreshAuthData();
      setEditUserFeedback('✅ Пароль успешно обновлён');
      resetSecurityFlows();
    } catch (err: any) {
      setPassFeedback(`Ошибка: ${err.message || 'Не удалось обновить пароль'}`);
    } finally {
      setIsFinalizingPass(false);
    }
  };

  // Company editing & billing state
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editCompanyName, setEditCompanyName] = useState('');
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [editCompanyFeedback, setEditCompanyFeedback] = useState<string | null>(null);
  const [billingFeedback, setBillingFeedback] = useState<{ companyId: string; message: string } | null>(null);

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
                <h2 className="saas-title">Панель управления платформой</h2>
                <span className="saas-badge-pill">FINDOCTOR ENTERPRISE</span>
              </div>
              <p className="saas-subtitle">
                Централизованный биллинг, управление доступами компаний и безопасность
              </p>
            </div>
          </div>

          {/* User Profile Info Box */}
          <div className="saas-profile-box">
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: '#363330',
                border: '1px solid #d97706',
                color: '#fbbf24',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {currentUser?.fullName?.slice(0, 2).toUpperCase() || 'ФН'}
            </div>
            <div className="saas-user-info">
              <span className="saas-user-title">Администратор платформы</span>
              <div className="saas-user-name">
                <strong>{currentUser?.fullName || 'Администратор'}</strong>
              </div>
            </div>
            {currentUser && (
              <button
                type="button"
                onClick={() => openEditUser(currentUser, 'security')}
                className="btn-gold-action"
                title="Настройки безопасности и смена пароля"
              >
                <ShieldAlert size={12} />
                <span>Безопасность</span>
              </button>
            )}
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

      {/* TAB 2: TEAM & USERS */}
      {activeTab === 'team' && (
        <div className="saas-section-grid">
          {/* Members Structured Table */}
          <div className="saas-table-card">
            <div className="saas-table-header">
              <div className="saas-table-title">
                <Users size={18} className="text-accent" />
                <span>Команда и пользователи платформы ({usersList.length})</span>
              </div>
            </div>

            <div>
              {usersList.map((usr) => {
                const isCurrent = usr.id === currentUser?.id;
                const isSuper = usr.isSuperAdmin;

                // Find company this user belongs to
                const userCo = companiesList.find((c) => c.ownerId === usr.id) ||
                  companiesList.find((c) => (usr as any).companyId === c.id);
                const companyName = userCo?.name || (usr as any).companyName || (isSuper ? 'Платформа (Админ)' : 'Организация');

                const initials = (usr.fullName || usr.email || 'U').slice(0, 2).toUpperCase();

                return (
                  <div key={usr.id} className="saas-member-row">
                    <div className="saas-member-identity">
                      <div className={`saas-avatar-box ${isSuper ? 'saas-avatar-crown' : 'saas-avatar-blue'}`}>
                        {isSuper ? '👑' : initials}
                      </div>
                      <div className="saas-member-text-col">
                        <div className="saas-member-name-text">
                          <span>{usr.fullName || usr.email.split('@')[0]}</span>
                          {isCurrent && <span className="saas-badge-you">Это вы</span>}
                        </div>
                        <span className="saas-member-email-text">{usr.email}</span>
                      </div>
                    </div>

                    <div>
                      <span className={isSuper ? 'saas-pill-gold' : 'saas-pill-blue'}>
                        {isSuper ? '👑 Владелец бизнеса' : 'Партнёр / Сооснователь'}
                      </span>
                    </div>

                    <div className="saas-company-pill">
                      <span>🏢 {companyName}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => openEditUser(usr)}
                        className="btn-member-action"
                        title="Редактировать имя, email или пароль"
                      >
                        <Edit2 size={12} />
                        <span>Настроить</span>
                      </button>
                    </div>
                  </div>
                );
              })}
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
                <h3 className="saas-card-title">Создать новую организацию</h3>
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

      {/* Modal: 2-Column User Profile & Security Center */}
      {editingUser && (
        <div className="modal-backdrop animate-fade-in" onClick={closeEditUserModal} role="presentation">
          <div
            className="modal-dialog-2col animate-slide-up"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Left Sidebar */}
            <div className="modal-sidebar-menu">
              <div className="sidebar-menu-list">
                <div className="sidebar-menu-label">Настройки аккаунта</div>
                <button
                  type="button"
                  onClick={() => { resetSecurityFlows(); setModalTab('profile'); }}
                  className={`sidebar-menu-item ${modalTab === 'profile' ? 'active' : ''}`}
                >
                  <Users size={14} />
                  <span>Личные данные</span>
                </button>
                <button
                  type="button"
                  onClick={() => { resetSecurityFlows(); setModalTab('security'); }}
                  className={`sidebar-menu-item ${modalTab === 'security' ? 'active' : ''}`}
                >
                  <Lock size={14} />
                  <span>Безопасность и пароль</span>
                </button>
                <button
                  type="button"
                  onClick={() => { resetSecurityFlows(); setModalTab('sessions'); }}
                  className={`sidebar-menu-item ${modalTab === 'sessions' ? 'active' : ''}`}
                >
                  <Laptop size={14} />
                  <span>Активные сессии</span>
                </button>
              </div>

              <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', paddingLeft: '10px' }}>
                Пользователь: <code>{editingUser.id}</code>
              </div>
            </div>

            {/* Right Content Column */}
            <div className="modal-content-column">
              <div>
                <div className="modal-content-top">
                  <div>
                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--foreground)' }}>
                      {modalTab === 'profile' && 'Личные данные профиля'}
                      {modalTab === 'security' && 'Безопасность и пароль'}
                      {modalTab === 'sessions' && 'Активные сессии'}
                    </h3>
                    <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: 'var(--muted-foreground)' }}>
                      {modalTab === 'profile' && 'Управление именем и должностью сотрудника'}
                      {modalTab === 'security' && 'Управление рабочим адресом почты и учетными данными'}
                      {modalTab === 'sessions' && 'Устройства, на которых выполнен вход в систему'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeEditUserModal}
                    className="btn-modal-close"
                    aria-label="Закрыть"
                  >
                    <X size={16} />
                  </button>
                </div>

                {editUserFeedback && (
                  <div
                    className={`saas-alert ${editUserFeedback.startsWith('Ошибка') ? 'saas-alert-error' : 'saas-alert-success'}`}
                    style={{ marginBottom: '14px' }}
                  >
                    {editUserFeedback.startsWith('Ошибка') ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                    <span>{editUserFeedback}</span>
                  </div>
                )}

                {/* TAB 1: PROFILE */}
                {modalTab === 'profile' && (
                  <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div className="saas-field-group">
                      <label className="saas-label">Имя и фамилия</label>
                      <input
                        type="text"
                        required
                        value={editUserName}
                        onChange={(e) => setEditUserName(e.target.value)}
                        className="saas-input"
                        placeholder="Например, Алексей Смирнов"
                      />
                    </div>

                    <div className="saas-field-group">
                      <label className="saas-label">Должность в компании</label>
                      <input
                        type="text"
                        value={editUserPosition}
                        onChange={(e) => setEditUserPosition(e.target.value)}
                        className="saas-input"
                        placeholder="Например, Старший бармен или Сооснователь"
                      />
                    </div>

                    <div className="saas-field-group">
                      <label className="saas-label">Контактный телефон</label>
                      <input
                        type="text"
                        value={editUserPhone}
                        onChange={(e) => setEditUserPhone(e.target.value)}
                        className="saas-input"
                        placeholder="+7 (999) 000-00-00"
                      />
                    </div>

                    <div className="saas-field-group">
                      <label className="saas-label">Основная организация</label>
                      <input
                        type="text"
                        value={currentCompany?.name || 'Организация'}
                        readOnly
                        style={{ background: 'var(--muted, #f4f3f1)', cursor: 'not-allowed' }}
                        className="saas-input"
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                      <button
                        type="button"
                        onClick={closeEditUserModal}
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
                        <span>{isSavingUser ? 'Сохранение...' : 'Сохранить личные данные'}</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* TAB 2: SECURITY & PASSWORDS */}
                {modalTab === 'security' && (
                  <div>
                    {/* Card 1: Email Change with Dual-Verification Protection */}
                    <div className="sec-card-box">
                      <div className="sec-card-head-row">
                        <div>
                          <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--foreground)' }}>Основной адрес Email</div>
                          <div style={{ fontSize: '12.5px', color: 'var(--muted-foreground)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <strong>{editingUser.email}</strong>
                            <span style={{ fontSize: '11px', color: '#059669', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '1px 6px', borderRadius: '4px' }}>
                              ✅ Подтверждён
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (isEmailFlowOpen) {
                              resetSecurityFlows();
                            } else {
                              resetSecurityFlows();
                              setIsEmailFlowOpen(true);
                            }
                          }}
                          className="btn-action-small"
                        >
                          {isEmailFlowOpen ? 'Свернуть' : 'Изменить email'}
                        </button>
                      </div>

                      {/* Expandable Flow: Step 1 (Old Email Verification) */}
                      {isEmailFlowOpen && emailStep === 'step1_old' && (
                        <div className="flow-step-box">
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#92400e', background: '#fef3c7', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: '4px', width: 'fit-content' }}>
                            Шаг 1 из 2: Подтверждение текущего владельца
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--muted-foreground)', lineHeight: 1.4 }}>
                            Для защиты от угона аккаунта введите ваш текущий пароль и запросите защитный код на текущую почту <strong>{editingUser.email}</strong>.
                          </div>

                          <div className="saas-field-group">
                            <label className="saas-label">Текущий пароль</label>
                            <input
                              type="password"
                              value={currentPassForEmail}
                              onChange={(e) => setCurrentPassForEmail(e.target.value)}
                              placeholder="Введите текущий пароль"
                              className="saas-input"
                            />
                          </div>

                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={handleSendOldEmailCode}
                              disabled={isSendingOldCode || !currentPassForEmail}
                              className="btn-action-small"
                            >
                              {isSendingOldCode ? 'Отправка...' : 'Выслать код на старую почту'}
                            </button>
                          </div>

                          {emailFeedback && (
                            <div style={{ fontSize: '12px', color: emailFeedback.startsWith('Ошибка') ? '#dc2626' : '#059669' }}>
                              {emailFeedback}
                            </div>
                          )}

                          <div id="old-code-box-container" style={{ marginTop: '4px' }}>
                            <span style={{ fontSize: '11.5px', color: 'var(--muted-foreground)', display: 'block', marginBottom: '5px' }}>
                              Введите 6-значный код из письма:
                            </span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              {oldEmailCode.map((val, idx) => (
                                <input
                                  key={idx}
                                  type="text"
                                  maxLength={1}
                                  value={val}
                                  onChange={(e) => handleCodeBoxInput(idx, e.target.value, oldEmailCode, setOldEmailCode, 'old-code-box-container')}
                                  className="code-box-input"
                                />
                              ))}
                            </div>

                            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                              <button
                                type="button"
                                onClick={handleVerifyOldCodeAndProceed}
                                disabled={oldEmailCode.join('').length !== 6}
                                className="btn-primary-gradient"
                                style={{ padding: '6px 14px', fontSize: '12px' }}
                              >
                                Подтвердить и ввести новый Email →
                              </button>
                              <button
                                type="button"
                                onClick={resetSecurityFlows}
                                className="btn-action-outline"
                                style={{ padding: '6px 12px', fontSize: '12px' }}
                              >
                                Отмена
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Expandable Flow: Step 2 (New Email Verification) */}
                      {isEmailFlowOpen && emailStep === 'step2_new' && (
                        <div className="flow-step-box">
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '4px', width: 'fit-content' }}>
                            Шаг 2 из 2: Привязка нового адреса
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--muted-foreground)', lineHeight: 1.4 }}>
                            Старый адрес подтверждён! Теперь укажите новый рабочий Email и подтвердите доступ к нему.
                          </div>

                          <div className="saas-field-group">
                            <label className="saas-label">Новый адрес Email</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <input
                                type="email"
                                value={newEmailInput}
                                onChange={(e) => setNewEmailInput(e.target.value)}
                                placeholder="например, partner@findoctor.ru"
                                className="saas-input"
                              />
                              <button
                                type="button"
                                onClick={handleSendNewEmailCode}
                                disabled={isSendingNewCode || !newEmailInput.includes('@')}
                                className="btn-action-small"
                              >
                                {isSendingNewCode ? 'Отправка...' : 'Выслать код'}
                              </button>
                            </div>
                          </div>

                          {emailFeedback && (
                            <div style={{ fontSize: '12px', color: emailFeedback.startsWith('Ошибка') ? '#dc2626' : '#059669' }}>
                              {emailFeedback}
                            </div>
                          )}

                          <div id="new-code-box-container" style={{ marginTop: '4px' }}>
                            <span style={{ fontSize: '11.5px', color: 'var(--muted-foreground)', display: 'block', marginBottom: '5px' }}>
                              Введите код подтверждения с нового адреса:
                            </span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              {newEmailCode.map((val, idx) => (
                                <input
                                  key={idx}
                                  type="text"
                                  maxLength={1}
                                  value={val}
                                  onChange={(e) => handleCodeBoxInput(idx, e.target.value, newEmailCode, setNewEmailCode, 'new-code-box-container')}
                                  className="code-box-input"
                                />
                              ))}
                            </div>

                            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                              <button
                                type="button"
                                onClick={handleConfirmNewEmail}
                                disabled={isFinalizingEmail || newEmailCode.join('').length !== 6}
                                className="btn-primary-gradient"
                                style={{ padding: '6px 14px', fontSize: '12px' }}
                              >
                                {isFinalizingEmail ? 'Сохранение...' : 'Завершить смену Email'}
                              </button>
                              <button
                                type="button"
                                onClick={resetSecurityFlows}
                                className="btn-action-outline"
                                style={{ padding: '6px 12px', fontSize: '12px' }}
                              >
                                Отмена
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card 2: Password Change */}
                    <div className="sec-card-box">
                      <div className="sec-card-head-row">
                        <div>
                          <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--foreground)' }}>Пароль учётной записи</div>
                          <div style={{ fontSize: '12.5px', color: 'var(--muted-foreground)', marginTop: '3px' }}>
                            •••••••••••••••• (активен)
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (isPassFlowOpen) {
                              resetSecurityFlows();
                            } else {
                              resetSecurityFlows();
                              setIsPassFlowOpen(true);
                            }
                          }}
                          className="btn-action-small"
                        >
                          {isPassFlowOpen ? 'Свернуть' : 'Сменить пароль'}
                        </button>
                      </div>

                      {/* Expandable Password Form */}
                      {isPassFlowOpen && (
                        <div className="flow-step-box">
                          <div className="saas-field-group">
                            <label className="saas-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>Текущий пароль</span>
                              <span
                                style={{ fontSize: '11.5px', color: '#2563eb', cursor: 'pointer', textDecoration: 'underline' }}
                                onClick={() => alert('Для сброса пароля выйдите из аккаунта и на странице входа нажмите «Забыли пароль?» — код сброса придёт на ваш email.')}
                              >
                                Забыли пароль?
                              </span>
                            </label>
                            <input
                              type="password"
                              value={currentPass}
                              onChange={(e) => setCurrentPass(e.target.value)}
                              placeholder="Введите текущий пароль"
                              className="saas-input"
                            />
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div className="saas-field-group">
                              <label className="saas-label">Новый пароль</label>
                              <input
                                type="password"
                                value={newPass}
                                onChange={(e) => setNewPass(e.target.value)}
                                placeholder="Минимум 6 символов"
                                className="saas-input"
                              />
                            </div>
                            <div className="saas-field-group">
                              <label className="saas-label">Повторите пароль</label>
                              <input
                                type="password"
                                value={repeatPass}
                                onChange={(e) => setRepeatPass(e.target.value)}
                                placeholder="Повторите новый"
                                className="saas-input"
                              />
                            </div>
                          </div>

                          <div style={{ padding: '10px', background: 'var(--muted, #f4f3f1)', borderRadius: '6px', border: '1px solid var(--border, #e7e5e2)' }}>
                            <div style={{ fontSize: '11.5px', color: 'var(--foreground)', fontWeight: 600, marginBottom: '4px' }}>
                              🛡️ Защита от взлома: подтверждение через почту
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginBottom: '8px' }}>
                              На ваш email <strong>{editingUser.email}</strong> будет отправлен 6-значный проверочный код.
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={handleSendPassCode}
                                disabled={isSendingPassCode || !currentPass}
                                className="btn-action-small"
                              >
                                {isSendingPassCode ? 'Отправка...' : 'Выслать код подтверждения'}
                              </button>
                            </div>

                            {passFeedback && (
                              <div style={{ fontSize: '12px', marginTop: '6px', color: passFeedback.startsWith('Ошибка') ? '#dc2626' : '#059669' }}>
                                {passFeedback}
                              </div>
                            )}

                            <div id="pass-code-box-container" style={{ marginTop: '8px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--muted-foreground)', display: 'block', marginBottom: '4px' }}>
                                Код из письма:
                              </span>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                {passCode.map((val, idx) => (
                                  <input
                                    key={idx}
                                    type="text"
                                    maxLength={1}
                                    value={val}
                                    onChange={(e) => handleCodeBoxInput(idx, e.target.value, passCode, setPassCode, 'pass-code-box-container')}
                                    className="code-box-input"
                                  />
                                ))}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            <button
                              type="button"
                              onClick={handleConfirmPasswordChange}
                              disabled={isFinalizingPass || !newPass || newPass !== repeatPass}
                              className="btn-primary-gradient"
                              style={{ padding: '6px 14px', fontSize: '12px' }}
                            >
                              {isFinalizingPass ? 'Обновление...' : 'Обновить пароль'}
                            </button>
                            <button
                              type="button"
                              onClick={resetSecurityFlows}
                              className="btn-action-outline"
                              style={{ padding: '6px 12px', fontSize: '12px' }}
                            >
                              Отмена
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 3: SESSIONS */}
                {modalTab === 'sessions' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ padding: '12px 14px', border: '1px solid var(--border, #e7e5e2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>Windows 11 • Google Chrome</div>
                        <div style={{ fontSize: '11.5px', color: 'var(--muted-foreground)' }}>IP: 127.0.0.1 • Активно прямо сейчас</div>
                      </div>
                      <span style={{ fontSize: '11px', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '9999px', fontWeight: 600 }}>
                        Текущая сессия
                      </span>
                    </div>

                    <div style={{ padding: '12px 14px', border: '1px solid var(--border, #e7e5e2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>Mobile Safari • iOS Device</div>
                        <div style={{ fontSize: '11.5px', color: 'var(--muted-foreground)' }}>В сети сегодня</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => alert('Сессия на мобильном устройстве завершена')}
                        className="btn-action-small"
                        style={{ color: '#dc2626' }}
                      >
                        Отозвать
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border, #e7e5e2)', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={closeEditUserModal}
                  className="btn-action-outline"
                >
                  Закрыть
                </button>
              </div>
            </div>
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
