/**
 * Truespace — Барный кейтеринг и финансы
 * SuperAdmin & Team Access Management Modal (`src/client/components/admin/SuperAdminModal.tsx`)
 *
 * Provides control over:
 * - Active user profile & co-founder switching (Никита / Влад)
 * - Multi-tenant company creation and switching
 * - Team invitations with granular roles (super_admin, owner, admin, staff)
 * - Supabase Cloud connection status
 */

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { isSupabaseConfigured } from '../../lib/supabaseClient.js';
import { UserRole } from '../../../shared/types.js';

interface SuperAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SuperAdminModal: React.FC<SuperAdminModalProps> = ({ isOpen, onClose }) => {
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
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'team' | 'companies' | 'supabase'>('team');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('staff');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const [newCompanyName, setNewCompanyName] = useState('');
  const [isCreatingCo, setIsCreatingCo] = useState(false);

  if (!isOpen) return null;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setIsInviting(true);
    setInviteSuccess(null);
    try {
      await inviteMember(inviteEmail.trim(), inviteRole, inviteName.trim() || undefined);
      setInviteSuccess(`Приглашение для ${inviteEmail} успешно создано!`);
      setInviteEmail('');
      setInviteName('');
    } catch (err: any) {
      alert(err.message || 'Ошибка отправки приглашения');
    } finally {
      setIsInviting(false);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    setIsCreatingCo(true);
    try {
      await createCompany(newCompanyName.trim());
      setNewCompanyName('');
    } catch (err: any) {
      alert(err.message || 'Ошибка создания организации');
    } finally {
      setIsCreatingCo(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 font-bold text-lg shadow-lg shadow-amber-500/20">
              👑
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-wide">Панель управления платформой</h3>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/30">
                  SaaS Multi-Tenant
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Текущий пользователь: <span className="text-emerald-400 font-semibold">{currentUser?.fullName || currentUser?.email}</span>
                {isSuperAdmin && ' (Суперадминистратор)'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Quick User Switcher bar */}
        <div className="px-6 py-3 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium">Переключить активного пользователя:</span>
          <div className="flex items-center gap-1.5">
            {usersList.map((u) => {
              const active = u.id === currentUser?.id;
              return (
                <button
                  key={u.id}
                  onClick={() => switchUser(u.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    active
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {u.fullName || u.email.split('@')[0]}
                  {u.isSuperAdmin ? ' 👑' : ''}
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900/50 px-6">
          <button
            onClick={() => setActiveTab('team')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'team'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            👥 Команда и роли ({companyMembers.length || 2})
          </button>
          <button
            onClick={() => setActiveTab('companies')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'companies'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            🏢 Организации ({companiesList.length})
          </button>
          <button
            onClick={() => setActiveTab('supabase')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'supabase'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            ⚡ Supabase Cloud
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-300">
          {/* TAB 1: TEAM */}
          {activeTab === 'team' && (
            <div className="space-y-5">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                  Участники организации «{currentCompany?.name}»
                </h4>
                <div className="space-y-2">
                  {companyMembers.map((m) => {
                    const isMe = m.membership.userId === currentUser?.id;
                    const roleLabel: Record<string, string> = {
                      super_admin: 'Суперадминистратор',
                      owner: 'Владелец / Сооснователь',
                      admin: 'Администратор',
                      staff: 'Сотрудник / Бармен',
                    };
                    return (
                      <div
                        key={m.membership.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700/60"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-700 text-slate-200 font-bold flex items-center justify-center text-xs">
                            {(m.user?.fullName || m.user?.email || 'U')[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-white">
                                {m.user?.fullName || m.membership.userId}
                              </span>
                              {isMe && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  Вы
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400">{m.user?.email || 'Локальный аккаунт'}</p>
                          </div>
                        </div>
                        <span className="text-xs px-2.5 py-1 rounded-md bg-slate-700/80 text-slate-200 border border-slate-600/50">
                          {roleLabel[m.membership.role] || m.membership.role}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Invite Form */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <h5 className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
                  + Пригласить сотрудника в организацию
                </h5>
                {inviteSuccess && (
                  <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-600/50 text-emerald-300 text-xs">
                    {inviteSuccess}
                  </div>
                )}
                <form onSubmit={handleInvite} className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  <input
                    type="email"
                    required
                    placeholder="Email (например, bar@truespace.ru)"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="px-3 py-2 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <input
                    type="text"
                    placeholder="Имя сотрудника"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="px-3 py-2 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <div className="flex gap-2">
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as UserRole)}
                      className="px-3 py-2 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-emerald-500 flex-1"
                    >
                      <option value="staff">Сотрудник / Бармен</option>
                      <option value="admin">Администратор</option>
                      <option value="owner">Сооснователь</option>
                    </select>
                    <button
                      type="submit"
                      disabled={isInviting}
                      className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition-colors whitespace-nowrap shadow-sm"
                    >
                      {isInviting ? 'Отправка...' : 'Пригласить'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 2: COMPANIES */}
          {activeTab === 'companies' && (
            <div className="space-y-5">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                  Зарегистрированные организации на платформе
                </h4>
                <div className="space-y-2">
                  {companiesList.map((co) => {
                    const isSelected = co.id === currentCompany?.id;
                    return (
                      <div
                        key={co.id}
                        className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-slate-800/90 border-emerald-500/60 shadow-md shadow-emerald-500/5'
                            : 'bg-slate-800/40 border-slate-700/50 hover:border-slate-600'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{co.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                              {co.plan.toUpperCase()}
                            </span>
                            {isSelected && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                                Активная
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">slug: {co.slug}</p>
                        </div>
                        {!isSelected && (
                          <button
                            onClick={() => switchCompany(co.id)}
                            className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-emerald-500 hover:text-slate-950 text-xs font-medium text-slate-200 transition-colors"
                          >
                            Переключиться
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Create Company Form */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <h5 className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
                  + Создать новый бизнес кейтеринга
                </h5>
                <form onSubmit={handleCreateCompany} className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Название нового бизнеса (например, Truespace Юг)"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    className="px-3 py-2 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 flex-1"
                  />
                  <button
                    type="submit"
                    disabled={isCreatingCo}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition-colors whitespace-nowrap shadow-sm"
                  >
                    {isCreatingCo ? 'Создание...' : 'Создать'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 3: SUPABASE */}
          {activeTab === 'supabase' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">Статус подключения к Supabase Cloud</span>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
                      isSupabaseConfigured
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    {isSupabaseConfigured ? '🟢 Подключен к Cloud' : '🟡 Автономный режим (JSON диск)'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {isSupabaseConfigured
                    ? 'Ваше приложение синхронизирует финансовые данные с облачной базой Supabase PostgreSQL в реальном времени с поддержкой Row Level Security.'
                    : 'Система работает полностью автономно и без сбоев: все данные сохраняются в `data/truespace.json`. Готовый SQL-скрипт миграции со всеми таблицами, RLS-политиками и сидами подготовлен в `src/server/data/supabase.sql`.'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-2">
                <span className="font-semibold text-slate-300">Как подключить реальный Supabase:</span>
                <ol className="list-decimal list-inside space-y-1 text-slate-400">
                  <li>Создайте бесплатный проект на supabase.com.</li>
                  <li>Выполните в SQL Editor скрипт из файла <code className="text-emerald-400">src/server/data/supabase.sql</code>.</li>
                  <li>Добавьте в файл <code className="text-emerald-400">.env</code> ваши ключи:</li>
                </ol>
                <div className="p-3 bg-slate-900 rounded-lg text-slate-300 font-mono text-[11px]">
                  VITE_SUPABASE_URL=https://ваша-бд.supabase.co<br />
                  VITE_SUPABASE_ANON_KEY=ваш-публичный-anon-ключ
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-950/80 border-t border-slate-800 text-xs">
          <span className="text-slate-500">Truespace SaaS Platform v2.0</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
