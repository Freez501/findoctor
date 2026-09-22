/**
 * Truespace — Барный кейтеринг и финансы
 * Dedicated SuperAdmin & SaaS Platform View (`src/client/components/admin/SuperAdminView.tsx`)
 *
 * Full-page workspace for:
 * 1. Supabase Cloud Connection & Sync (credentials testing, migration execution, data export)
 * 2. Multi-Tenant Organization Management (creating companies, switching active company)
 * 3. Team & Co-founder Permissions (Nikita as SuperAdmin, Vlad as Co-founder, staff invites)
 */

import React, { useState, useEffect } from 'react';
import {
  Cloud,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Building2,
  Users,
  UserPlus,
  Key,
  Database,
  ArrowRight,
  ExternalLink,
  Crown,
  Eye,
  EyeOff,
  Copy,
  Check,
  Download,
  Upload,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../api/apiClient.js';
import { UserRole } from '../../../shared/types.js';

type AdminTab = 'supabase' | 'team' | 'companies';

export const SuperAdminView: React.FC = () => {
  const {
    currentUser,
    usersList,
    currentCompany,
    companiesList,
    companyMembers,
    isSuperAdmin,
    switchUser,
    switchCompany,
    createCompany,
    inviteMember,
    refreshAuthData,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<AdminTab>('supabase');

  // Supabase connection state
  const [supabaseUrl, setSupabaseUrl] = useState<string>('');
  const [supabaseKey, setSupabaseKey] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [cloudStatus, setCloudStatus] = useState<{ isConfigured: boolean; mode: string; message: string }>({
    isConfigured: false,
    mode: 'local',
    message: 'Загрузка статуса подключения...',
  });

  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isPulling, setIsPulling] = useState<boolean>(false);
  const [pullResult, setPullResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isCopiedSql, setIsCopiedSql] = useState<boolean>(false);
  const [copyingSql, setCopyingSql] = useState<boolean>(false);

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

  // Load initial Supabase status
  const loadSupabaseStatus = async () => {
    try {
      const res = await api.getSupabaseStatus();
      setCloudStatus(res);
    } catch {
      setCloudStatus({
        isConfigured: false,
        mode: 'local',
        message: 'Автономный локальный режим (data/truespace.json)',
      });
    }
  };

  useEffect(() => {
    loadSupabaseStatus();
  }, []);

  // Handle Supabase Connection Test
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await api.testSupabase({
        url: supabaseUrl.trim() || undefined,
        key: supabaseKey.trim() || undefined,
      });

      if (res.success) {
        setTestResult({
          success: true,
          message: res.message || 'Связь с базой Supabase успешно установлена!',
        });
      } else {
        setTestResult({
          success: false,
          message: res.error || 'Не удалось подключиться к Supabase',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Ошибка выполнения запроса к серверу',
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Handle Save Supabase Config
  const handleSaveConfig = async () => {
    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      alert('Пожалуйста, введите Project URL и Anon Key');
      return;
    }

    setIsSaving(true);
    try {
      const res = await api.saveSupabaseConfig({
        url: supabaseUrl.trim(),
        key: supabaseKey.trim(),
      });
      if (res.success) {
        alert(res.message);
        await loadSupabaseStatus();
      } else {
        alert(res.error || 'Ошибка сохранения конфигурации');
      }
    } catch (err: any) {
      alert(err.message || 'Ошибка сети');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Copy SQL
  const handleCopySql = async () => {
    setCopyingSql(true);
    try {
      const res = await api.getSupabaseSql();
      if (res.success && res.sql) {
        await navigator.clipboard.writeText(res.sql);
        setIsCopiedSql(true);
        setTimeout(() => setIsCopiedSql(false), 4000);
      } else {
        alert('Файл supabase.sql скопирован в корневую папку проекта.');
      }
    } catch (err: any) {
      alert('Не удалось скопировать в буфер: ' + err.message);
    } finally {
      setCopyingSql(false);
    }
  };

  // Handle Sync data to Supabase
  const handleSyncToSupabase = async () => {
    if (!window.confirm('Выгрузить все текущие счета, категории, мероприятия и операции из локального файла в базу Supabase?')) {
      return;
    }

    setIsSyncing(true);
    setSyncResult(null);
    try {
      const res = await api.syncToSupabase({
        url: supabaseUrl.trim() || undefined,
        key: supabaseKey.trim() || undefined,
      });

      if (res.success) {
        setSyncResult({
          success: true,
          message: `${res.message} (Счетов: ${res.counts?.accounts}, Операций: ${res.counts?.transactions}, Мероприятий: ${res.counts?.events})`,
        });
        await loadSupabaseStatus();
      } else {
        setSyncResult({
          success: false,
          message: res.error || 'Ошибка синхронизации данных',
        });
      }
    } catch (err: any) {
      setSyncResult({
        success: false,
        message: err.message || 'Ошибка связи с сервером',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle Pull data from Supabase
  const handlePullFromSupabase = async () => {
    if (!window.confirm('Загрузить все данные из облака Supabase? Это обновит локальные счета, операции и мероприятия на этом устройстве до актуального состояния из облака.')) {
      return;
    }

    setIsPulling(true);
    setPullResult(null);
    try {
      const res = await api.pullFromSupabase({
        url: supabaseUrl.trim() || undefined,
        key: supabaseKey.trim() || undefined,
      });

      if (res.success) {
        setPullResult({
          success: true,
          message: `${res.message} (Счетов: ${res.counts?.accounts || 0}, Операций: ${res.counts?.transactions || 0}, Мероприятий: ${res.counts?.events || 0}). Страница сейчас обновится...`,
        });
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setPullResult({
          success: false,
          message: res.error || 'Ошибка загрузки данных из Supabase',
        });
      }
    } catch (err: any) {
      setPullResult({
        success: false,
        message: err.message || 'Ошибка связи с сервером',
      });
    } finally {
      setIsPulling(false);
    }
  };

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
                <h2 className="saas-title">Панель управления SaaS</h2>
                <span className="saas-badge-pill">Платформа Truespace Multi-Tenant</span>
              </div>
              <p className="saas-subtitle">
                Управление базой данных Supabase, правами сооснователей и кейтеринговыми организациями
              </p>
            </div>
          </div>

          {/* User Profile & Switcher Box */}
          <div className="saas-profile-box">
            <div className="saas-user-info">
              <span className="saas-user-title">Текущий профиль:</span>
              <div className="saas-user-name">
                <strong>{currentUser?.fullName || 'Пользователь'}</strong>
                {isSuperAdmin && <span className="saas-role-crown">👑 Суперадмин</span>}
                {!isSuperAdmin && <span className="saas-role-partner">🍸 Сооснователь</span>}
              </div>
              <span className="saas-company-tag">Организация: {currentCompany?.name}</span>
            </div>

            {/* Quick Switcher Buttons */}
            <div className="saas-switch-buttons">
              <span className="saas-switch-label">Смотреть интерфейс как:</span>
              <div className="saas-switch-group">
                {usersList.map((u) => {
                  const isActive = u.id === currentUser?.id;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => switchUser(u.id)}
                      className={`saas-switch-btn ${isActive ? 'saas-switch-btn-active' : ''}`}
                    >
                      {u.isSuperAdmin ? '👑 ' : '🍸 '}
                      {u.fullName || u.email.split('@')[0]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Sub Navigation Tabs */}
      <div className="saas-nav-tabs">
        <button
          type="button"
          onClick={() => setActiveTab('supabase')}
          className={`saas-tab-item ${activeTab === 'supabase' ? 'saas-tab-item-active' : ''}`}
        >
          <Cloud size={17} />
          <span>Подключение к Supabase Cloud</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('team')}
          className={`saas-tab-item ${activeTab === 'team' ? 'saas-tab-item-active' : ''}`}
        >
          <Users size={17} />
          <span>Команда и сооснователи ({companyMembers.length || 2})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('companies')}
          className={`saas-tab-item ${activeTab === 'companies' ? 'saas-tab-item-active' : ''}`}
        >
          <Building2 size={17} />
          <span>Организации и бизнесы ({companiesList.length})</span>
        </button>
      </div>

      {/* 3. Tab Contents */}

      {/* TAB 1: SUPABASE CLOUD */}
      {activeTab === 'supabase' && (
        <div className="saas-section-grid">
          {/* Status Overview Card */}
          <div className="saas-card">
            <div className="saas-card-header">
              <div className="saas-card-title-group">
                <Database size={18} className="text-accent" />
                <h3 className="saas-card-title">Текущее состояние базы данных</h3>
              </div>
              <button
                type="button"
                onClick={loadSupabaseStatus}
                className="btn-action-ghost"
                title="Обновить статус"
              >
                <RefreshCw size={14} />
                <span>Проверить статус</span>
              </button>
            </div>

            <div className="saas-card-body">
              <div
                className={`saas-status-banner ${
                  cloudStatus.isConfigured ? 'saas-status-cloud' : 'saas-status-local'
                }`}
              >
                <div className="saas-status-indicator">
                  <span className="saas-status-dot" />
                  <span className="saas-status-headline">
                    {cloudStatus.isConfigured
                      ? '🟢 Облачная база Supabase активна (PostgreSQL)'
                      : '🟡 Автономный режим (Локальный диск: data/truespace.json)'}
                  </span>
                </div>
                <p className="saas-status-desc">
                  {cloudStatus.isConfigured
                    ? 'Ваше приложение автоматически синхронизирует операции, счета и банкеты с облачным PostgreSQL в Supabase.'
                    : 'Все данные сохраняются автономно на вашем компьютере. Вы можете работать без интернета или в любой момент подключить бесплатный облачный Supabase для удалённого доступа.'}
                </p>
              </div>

              {/* Actions: Export & Import Sync CTAs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
                {/* 1. Pull / Import from Cloud */}
                <div className="saas-sync-cta" style={{ borderLeft: '4px solid #10b981' }}>
                  <div>
                    <h4 className="saas-sync-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Download size={16} style={{ color: '#10b981' }} />
                      <span>Загрузить базу из Supabase в приложение (Обратная синхронизация)</span>
                    </h4>
                    <p className="saas-sync-text">
                      Нажмите, если открыли приложение на новом устройстве или хотите подтянуть самые свежие данные из облака.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handlePullFromSupabase}
                    disabled={isPulling}
                    className="btn-action-outline"
                    style={{ minWidth: '220px', justifyContent: 'center', borderColor: '#10b981', color: '#059669' }}
                  >
                    <Download size={16} />
                    <span>{isPulling ? 'Загрузка из облака...' : '📥 Загрузить базу из Supabase'}</span>
                  </button>
                </div>

                {pullResult && (
                  <div
                    className={`saas-alert ${
                      pullResult.success ? 'saas-alert-success' : 'saas-alert-error'
                    }`}
                  >
                    {pullResult.success ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    <span>{pullResult.message}</span>
                  </div>
                )}

                {/* 2. Export / Push to Cloud */}
                <div className="saas-sync-cta" style={{ borderLeft: '4px solid #f59e0b' }}>
                  <div>
                    <h4 className="saas-sync-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Upload size={16} style={{ color: '#f59e0b' }} />
                      <span>Выгрузка локальных данных в Supabase</span>
                    </h4>
                    <p className="saas-sync-text">
                      Перенесёт все текущие счета, остатки, мероприятия и операции в вашу облачную базу (перезапишет в облаке).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSyncToSupabase}
                    disabled={isSyncing}
                    className="btn-primary-gradient"
                    style={{ minWidth: '220px', justifyContent: 'center' }}
                  >
                    <Upload size={16} />
                    <span>{isSyncing ? 'Выполняется выгрузка...' : '⬆️ Выгрузить данные в Supabase'}</span>
                  </button>
                </div>

                {syncResult && (
                  <div
                    className={`saas-alert ${
                      syncResult.success ? 'saas-alert-success' : 'saas-alert-error'
                    }`}
                  >
                    {syncResult.success ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    <span>{syncResult.message}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Configuration Form Card */}
          <div className="saas-card">
            <div className="saas-card-header">
              <div className="saas-card-title-group">
                <Key size={18} className="text-accent" />
                <h3 className="saas-card-title">Параметры подключения к Supabase</h3>
              </div>
            </div>

            <div className="saas-card-body">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveConfig();
                }}
                className="saas-form"
              >
                <div className="saas-field-group">
                  <label className="saas-label">
                    <span>Supabase Project URL</span>
                    <span className="saas-label-hint">из настроек Project Settings ➔ API</span>
                  </label>
                  <input
                    type="url"
                    placeholder="https://abcdefghijklmn.supabase.co"
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    className="saas-input"
                  />
                </div>

                <div className="saas-field-group">
                  <label className="saas-label">
                    <span>Supabase Anon Key (Public Key)</span>
                    <span className="saas-label-hint">публичный ключ проекта (anon / public)</span>
                  </label>
                  <div className="saas-input-with-action">
                    <input
                      type={showKey ? 'text' : 'password'}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      value={supabaseKey}
                      onChange={(e) => setSupabaseKey(e.target.value)}
                      className="saas-input font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="saas-input-toggle-btn"
                      title={showKey ? 'Скрыть ключ' : 'Показать ключ'}
                    >
                      {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="saas-form-actions">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="btn-action-outline"
                  >
                    <RefreshCw size={15} className={isTesting ? 'animate-spin' : ''} />
                    <span>{isTesting ? 'Проверка...' : 'Проверить соединение'}</span>
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="btn-primary-gradient"
                  >
                    <CheckCircle2 size={15} />
                    <span>{isSaving ? 'Сохранение...' : 'Сохранить ключи в .env'}</span>
                  </button>
                </div>

                {testResult && (
                  <div
                    className={`saas-alert ${
                      testResult.success ? 'saas-alert-success' : 'saas-alert-error'
                    }`}
                  >
                    {testResult.success ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    <span>{testResult.message}</span>
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* Step-by-Step Instructions Card */}
          <div className="saas-card saas-guide-card">
            <div className="saas-card-header">
              <h3 className="saas-card-title">Как подключить Supabase за 3 шага</h3>
            </div>
            <div className="saas-card-body">
              <div className="saas-steps-list">
                <div className="saas-step-item">
                  <div className="saas-step-number">1</div>
                  <div className="saas-step-content">
                    <h4 className="saas-step-title">Создайте бесплатный проект</h4>
                    <p className="saas-step-desc">
                      Зайдите на официальный сайт{' '}
                      <a
                        href="https://supabase.com"
                        target="_blank"
                        rel="noreferrer"
                        className="saas-link"
                      >
                        supabase.com <ExternalLink size={12} />
                      </a>{' '}
                      и нажмите «New Project». Задайте имя (например, <em>Truespace</em>) и надёжный пароль для базы данных.
                    </p>
                  </div>
                </div>

                <div className="saas-step-item">
                  <div className="saas-step-number">2</div>
                  <div className="saas-step-content">
                    <h4 className="saas-step-title">Выполните готовую миграцию (SQL-скрипт)</h4>
                    <p className="saas-step-desc">
                      В левом меню Supabase перейдите в <strong>SQL Editor</strong> ➔ <strong>New Query</strong>. Файл <code className="saas-code-badge">supabase.sql</code> лежит прямо в корне проекта Truespace. Либо просто нажмите кнопку ниже, чтобы скопировать весь код:
                    </p>
                    <div style={{ marginTop: '10px' }}>
                      <button
                        type="button"
                        onClick={handleCopySql}
                        disabled={copyingSql}
                        className="btn-action-outline"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '6px 12px' }}
                      >
                        {isCopiedSql ? <Check size={15} style={{ color: '#10b981' }} /> : <Copy size={15} />}
                        <span>{isCopiedSql ? '✅ SQL-код скопирован в буфер обмена!' : '📋 Скопировать весь SQL-код для Supabase'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="saas-step-item">
                  <div className="saas-step-number">3</div>
                  <div className="saas-step-content">
                    <h4 className="saas-step-title">Скопируйте URL и Anon Key</h4>
                    <p className="saas-step-desc">
                      Перейдите в <strong>Project Settings ➔ API</strong>, скопируйте поля <em>Project URL</em> и <em>anon / public API Key</em>, вставьте в форму выше и нажмите «Сохранить ключи». Готово!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TEAM & CO-FOUNDERS */}
      {activeTab === 'team' && (
        <div className="saas-section-grid">
          {/* Members List */}
          <div className="saas-card">
            <div className="saas-card-header">
              <div className="saas-card-title-group">
                <Users size={18} className="text-accent" />
                <h3 className="saas-card-title">
                  Участники организации «{currentCompany?.name}»
                </h3>
              </div>
            </div>

            <div className="saas-card-body">
              <div className="saas-members-grid">
                {companyMembers.map((m) => {
                  const isCurrent = m.membership.userId === currentUser?.id;
                  const isSuper = m.membership.role === 'super_admin';
                  const isOwner = m.membership.role === 'owner';

                  const roleTitle: Record<string, string> = {
                    super_admin: 'Суперадминистратор платформы',
                    owner: 'Владелец / Сооснователь',
                    admin: 'Администратор',
                    staff: 'Сотрудник / Бармен',
                  };

                  return (
                    <div key={m.membership.id} className="saas-member-card">
                      <div className="saas-member-avatar-col">
                        <div
                          className={`saas-member-avatar ${
                            isSuper ? 'saas-avatar-crown' : isOwner ? 'saas-avatar-gold' : ''
                          }`}
                        >
                          {isSuper ? '👑' : isOwner ? '🍸' : (m.user?.fullName || 'U')[0].toUpperCase()}
                        </div>
                      </div>

                      <div className="saas-member-details">
                        <div className="saas-member-name-row">
                          <span className="saas-member-name">
                            {m.user?.fullName || m.membership.userId}
                          </span>
                          {isCurrent && <span className="saas-badge-you">Это вы</span>}
                        </div>
                        <span className="saas-member-email">{m.user?.email || 'Локальный профиль'}</span>
                        <span className="saas-member-role-badge">
                          {roleTitle[m.membership.role] || m.membership.role}
                        </span>
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
                {companiesList.map((co) => {
                  const isCurrent = co.id === currentCompany?.id;
                  return (
                    <div
                      key={co.id}
                      className={`saas-company-card ${isCurrent ? 'saas-company-card-active' : ''}`}
                    >
                      <div className="saas-company-top">
                        <div className="saas-company-title-group">
                          <span className="saas-company-name">{co.name}</span>
                          <span className="saas-plan-tag">{co.plan.toUpperCase()}</span>
                        </div>
                        {isCurrent && (
                          <span className="saas-badge-current">
                            <CheckCircle2 size={13} /> Активная
                          </span>
                        )}
                      </div>

                      <div className="saas-company-meta">
                        <span>Идентификатор: <code>{co.slug}</code></span>
                        <span>Создана: {new Date(co.createdAt).toLocaleDateString('ru-RU')}</span>
                      </div>

                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={() => switchCompany(co.id)}
                          className="btn-action-outline saas-switch-company-btn"
                        >
                          <ArrowRight size={14} />
                          <span>Переключиться на эту организацию</span>
                        </button>
                      )}
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
    </div>
  );
};

export default SuperAdminView;
