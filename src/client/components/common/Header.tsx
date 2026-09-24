/**
 * Brilliant Event — Барный кейтеринг и финансы
 * Application Header (`src/client/components/common/Header.tsx`)
 *
 * Modern unified navigation header:
 * - Brand identity "Brilliant Event"
 * - Integrated top navigation tabs (Счета, Мероприятия, Маржинальность, Журнал, Настройки, Супер-админ)
 * - Premium primary action button "Внести операцию"
 * - High-end profile / user switcher / authorization dropdown
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  RotateCcw,
  Plus,
  Wallet,
  Calendar,
  BarChart3,
  History,
  Settings,
  Shield,
  ChevronDown,
  Building2,
  Crown,
  LucideIcon,
  LogOut,
} from 'lucide-react';
import { useResetDemo } from '../../hooks/useResetDemo.js';
import { useAuth } from '../../context/AuthContext.js';

export type TabType = 'accounts' | 'events' | 'analytics' | 'history' | 'settings' | 'admin';

interface NavItem {
  id: TabType;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'accounts', label: 'Счета', icon: Wallet },
  { id: 'events', label: 'Мероприятия', icon: Calendar },
  { id: 'analytics', label: 'Маржинальность', icon: BarChart3 },
  { id: 'history', label: 'Журнал', icon: History },
  { id: 'settings', label: 'Настройки', icon: Settings },
  { id: 'admin', label: 'Супер-админ', icon: Shield, badge: '👑' },
];

interface HeaderProps {
  currentTab?: TabType;
  onSelectTab?: (tab: TabType) => void;
  onOpenQuickEntry?: () => void;
  onNavigateToAdmin?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab = 'accounts',
  onSelectTab,
  onOpenQuickEntry,
  onNavigateToAdmin,
}) => {
  const { resetDemo, isResetting } = useResetDemo();
  const {
    currentUser,
    currentCompany,
    isSuperAdmin,
    userRole,
    logout,
  } = useAuth();

  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileMenu]);

  const getRoleDisplayName = (role: string, isSuper?: boolean) => {
    if (isSuper) return 'Суперадмин платформы';
    if (role === 'owner') return 'Владелец / Главный финдиректор';
    if (role === 'admin') return 'Сооснователь / Партнёр';
    if (role === 'accountant') return 'Бухгалтер / Финменеджер';
    if (role === 'staff') return 'Бармен / Сотрудник';
    return 'Сотрудник';
  };

  return (
    <header className="app-header">
      <div className="header-container">
        {/* Brand: Brilliant Event */}
        <div
          className="brand-group cursor-pointer"
          onClick={() => onSelectTab?.('accounts')}
          role="button"
          tabIndex={0}
          title={`${currentCompany?.name || 'Brilliant Event'} — Главный экран`}
        >
          <div className="brand-icon-brilliant" aria-hidden="true">
            <Sparkles size={17} className="brand-gem-sparkle" />
          </div>
          <div className="brand-text-block">
            <div className="brand-title-brilliant">{currentCompany?.name || 'Brilliant Event'}</div>
            <div className="brand-tagline">Catering & Bar Finance</div>
          </div>
        </div>

        {/* Center: Integrated Navigation Tabs */}
        {onSelectTab && (
          <nav className="header-nav-tabs" aria-label="Разделы системы">
            {NAV_ITEMS.filter((item) => item.id !== 'admin' || isSuperAdmin).map(({ id, label, icon: Icon, badge }) => {
              const active = currentTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectTab(id)}
                  className={`header-nav-tab ${active ? 'header-nav-tab-active' : ''}`}
                  aria-selected={active}
                  role="tab"
                >
                  <Icon size={14} className="header-nav-tab-icon" />
                  <span>{label}</span>
                  {badge && <span className="header-nav-badge">{badge}</span>}
                </button>
              );
            })}
          </nav>
        )}

        {/* Right actions: Quick Entry + User Profile */}
        <div className="header-actions">
          {/* Prominent Quick Entry Button */}
          {onOpenQuickEntry && (
            <button
              type="button"
              onClick={onOpenQuickEntry}
              className="btn-quick-entry-header"
              title="Открыть форму быстрого ввода операции (5 секунд)"
            >
              <div className="btn-plus-icon-box" aria-hidden="true">
                <Plus size={14} strokeWidth={2.6} />
              </div>
              <span>Внести операцию</span>
            </button>
          )}

          {/* Profile & Authorization Button & Dropdown */}
          <div style={{ position: 'relative' }} ref={profileMenuRef}>
            <button
              type="button"
              className={`profile-badge ${showProfileMenu ? 'profile-badge-active' : ''}`}
              onClick={() => setShowProfileMenu((prev) => !prev)}
              title="Профиль компании, переключение пользователя и авторизация"
              aria-expanded={showProfileMenu}
              aria-haspopup="true"
            >
              <div
                className="profile-avatar-circle"
                style={{
                  background: isSuperAdmin
                    ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                    : 'linear-gradient(135deg, #27272a, #18181b)',
                }}
              >
                {currentUser?.fullName ? currentUser.fullName[0].toUpperCase() : 'B'}
              </div>
              <div className="profile-text-group">
                <span className="profile-user-name">
                  {currentUser?.fullName || 'Никита'}
                </span>
                <span className="profile-role-sub">
                  {isSuperAdmin ? '👑 Админ' : userRole === 'owner' ? 'Владелец' : 'Команда'}
                </span>
              </div>
              <ChevronDown
                size={14}
                className={`profile-chevron ${showProfileMenu ? 'rotate-180' : ''}`}
              />
            </button>

            {/* High-End Profile Dropdown Card */}
            {showProfileMenu && (
              <div className="profile-dropdown-card animate-fade-in" role="dialog" aria-label="Профиль и команда">
                {/* Organization Header */}
                <div className="profile-card-header">
                  <div className="profile-card-company-row">
                    <div className="profile-company-icon">
                      <Building2 size={14} />
                    </div>
                    <div>
                      <div className="profile-company-name">
                        {currentCompany?.name || 'Brilliant Event'}
                      </div>
                      <div className="profile-company-plan">
                        Организация • <span className="profile-plan-badge">PRO</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Active User Highlight Box */}
                <div className="profile-active-user-box">
                  <div
                    className="profile-avatar-large"
                    style={{
                      background: isSuperAdmin
                        ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                        : 'linear-gradient(135deg, #3f3f46, #18181b)',
                    }}
                  >
                    {currentUser?.fullName ? currentUser.fullName[0].toUpperCase() : 'B'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="profile-user-fullname">
                      {currentUser?.fullName || 'Пользователь'}
                    </div>
                    <div className="profile-user-role-label">
                      {getRoleDisplayName(userRole, isSuperAdmin)}
                    </div>
                  </div>
                  {isSuperAdmin && (
                    <span title="Суперадминистратор" className="profile-crown-tag">
                      <Crown size={13} />
                    </span>
                  )}
                </div>

                {/* Clean Navigation & Profile Actions */}
                <div style={{ marginTop: '10px', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {(userRole === 'owner' || userRole === 'admin' || isSuperAdmin) && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        onSelectTab?.('settings');
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        background: 'transparent',
                        color: 'var(--foreground)',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <Building2 size={14} color="var(--primary)" />
                      <span>Управление организацией</span>
                    </button>
                  )}

                  <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', padding: '4px 6px' }}>
                    {currentUser?.email}
                  </div>
                </div>
                <div className="profile-divider" />

                {/* SaaS Admin Portal Button (SUPERADMIN ONLY) */}
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      if (onNavigateToAdmin) {
                        onNavigateToAdmin();
                      } else if (onSelectTab) {
                        onSelectTab('admin');
                      }
                    }}
                    className="profile-admin-button"
                  >
                    <Shield size={14} />
                    <span>Панель управления SaaS</span>
                    <span className="profile-admin-tag">👑</span>
                  </button>
                )}

                {/* Trial info for regular tenants */}
                {!isSuperAdmin && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      background: 'rgba(217, 119, 6, 0.08)',
                      borderRadius: '8px',
                      border: '1px solid rgba(217, 119, 6, 0.18)',
                      fontSize: '11px',
                      color: '#b45309',
                      fontWeight: 600,
                      marginBottom: '4px',
                    }}
                  >
                    <Sparkles size={13} />
                    <span>Тариф: 14 дней Pro Trial</span>
                  </div>
                )}

                {/* Reset Demo Button (SUPERADMIN ONLY) */}
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (window.confirm('Сбросить демо-данные к начальному состоянию?')) {
                        await resetDemo();
                        setShowProfileMenu(false);
                      }
                    }}
                    disabled={isResetting}
                    className="profile-reset-button"
                  >
                    <RotateCcw size={13} className={isResetting ? 'animate-spin' : ''} />
                    <span>{isResetting ? 'Сброс данных...' : 'Сбросить демо-данные'}</span>
                  </button>
                )}

                {/* Logout Button */}
                <button
                  type="button"
                  onClick={async () => {
                    setShowProfileMenu(false);
                    await logout();
                  }}
                  className="profile-logout-button"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '8px 12px',
                    marginTop: '6px',
                    background: 'rgba(239, 68, 68, 0.08)',
                    color: '#f87171',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <LogOut size={13} />
                  <span>Выйти из аккаунта</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
