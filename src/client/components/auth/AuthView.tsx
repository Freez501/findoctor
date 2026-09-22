/**
 * Truespace — Барный кейтеринг и финансы
 * Authentication Screen (`src/client/components/auth/AuthView.tsx`)
 *
 * Dedicated login & registration view featuring:
 * - Email & Password authentication
 * - Multi-tenant onboarding with 14-day Pro Trial badge
 * - One-click founder testing logins (Nikita 👑, Vlad 🍸)
 * - One-click isolated test company creation (clean database preview)
 */

import React, { useState } from 'react';
import { Wine, Lock, Mail, Building2, User, ArrowRight, Sparkles, Shield, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';

export const AuthView: React.FC = () => {
  const { login, register } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (mode === 'login') {
        if (!email.trim()) {
          throw new Error('Введите адрес электронной почты');
        }
        await login(email.trim(), password);
      } else {
        if (!email.trim()) {
          throw new Error('Укажите email');
        }
        if (!companyName.trim()) {
          throw new Error('Укажите название вашей организации');
        }
        await register(email.trim(), password, fullName.trim() || undefined, companyName.trim());
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка аутентификации');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Demo Logins for Testing
  const handleQuickLogin = async (userEmail: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await login(userEmail, 'demo123');
    } catch (err: any) {
      setError(err.message || 'Ошибка входа');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Create Test Company (Isolated clean database)
  const handleQuickTestCompany = async () => {
    setError(null);
    setIsLoading(true);
    const randomSuffix = Math.floor(Math.random() * 900 + 100);
    const testEmail = `test_${randomSuffix}@truespace.ru`;
    const testCo = `Тест Бар ${randomSuffix}`;
    try {
      await register(testEmail, 'password123', `Тестовый Бармен #${randomSuffix}`, testCo);
    } catch (err: any) {
      setError(err.message || 'Ошибка создания тестовой компании');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page-wrapper">
      <div className="auth-card-container animate-fade-in">
        {/* Brand Header */}
        <div className="auth-brand-header">
          <div className="auth-brand-icon">
            <Wine size={28} />
          </div>
          <h1 className="auth-brand-title">Truespace</h1>
          <p className="auth-brand-subtitle">Система финансового учёта барного кейтеринга</p>
        </div>

        {/* Tab Toggle: Login vs Register */}
        <div className="auth-tabs">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`auth-tab-btn ${mode === 'login' ? 'auth-tab-btn-active' : ''}`}
          >
            Вход в систему
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`auth-tab-btn ${mode === 'register' ? 'auth-tab-btn-active' : ''}`}
          >
            <span>Регистрация</span>
            <span className="auth-trial-pill">14 дней Pro</span>
          </button>
        </div>

        {/* Error Feedback */}
        {error && (
          <div className="auth-error-banner animate-fade-in">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'register' && (
            <>
              <div className="auth-field">
                <label className="auth-label">Ваше имя / ФИО</label>
                <div className="auth-input-wrapper">
                  <User size={16} className="auth-input-icon" />
                  <input
                    type="text"
                    required
                    placeholder="Например, Никита"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="auth-input"
                  />
                </div>
              </div>

              <div className="auth-field">
                <label className="auth-label">Название организации / бара</label>
                <div className="auth-input-wrapper">
                  <Building2 size={16} className="auth-input-icon" />
                  <input
                    type="text"
                    required
                    placeholder="Например, Truespace Catering или Fin Doctor"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="auth-input"
                  />
                </div>
              </div>
            </>
          )}

          <div className="auth-field">
            <label className="auth-label">Электронная почта</label>
            <div className="auth-input-wrapper">
              <Mail size={16} className="auth-input-icon" />
              <input
                type="email"
                required
                placeholder="name@company.ru"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="auth-input"
              />
            </div>
          </div>

          <div className="auth-field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="auth-label">Пароль</label>
              <span style={{ fontSize: '0.7rem', color: 'var(--color-mid-gray)' }}>
                {mode === 'login' ? 'Любой для демо' : 'От 6 символов'}
              </span>
            </div>
            <div className="auth-input-wrapper">
              <Lock size={16} className="auth-input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="auth-toggle-pwd"
                title={showPassword ? 'Скрыть' : 'Показать'}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="auth-submit-btn"
          >
            <span>{isLoading ? 'Загрузка...' : mode === 'login' ? 'Войти в личный кабинет' : 'Создать аккаунт и начать триал'}</span>
            <ArrowRight size={16} />
          </button>
        </form>

        {/* Quick Testing Login Cards */}
        <div className="auth-divider">
          <span>или быстрый тестовый вход</span>
        </div>

        <div className="auth-quick-logins">
          <button
            type="button"
            onClick={() => handleQuickLogin('nikita@truespace.ru')}
            disabled={isLoading}
            className="auth-quick-btn"
            title="Войти как суперадмин со всеми счетами Truespace"
          >
            <div className="auth-quick-avatar" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
              👑
            </div>
            <div className="auth-quick-info">
              <span className="auth-quick-name">Никита (Суперадмин)</span>
              <span className="auth-quick-meta">Truespace Catering • Полный доступ</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleQuickLogin('vlad@truespace.ru')}
            disabled={isLoading}
            className="auth-quick-btn"
            title="Войти как сооснователь / шеф-бармен"
          >
            <div className="auth-quick-avatar" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
              🍸
            </div>
            <div className="auth-quick-info">
              <span className="auth-quick-name">Влад (Сооснователь)</span>
              <span className="auth-quick-meta">Шеф-бармен • Управление сметами</span>
            </div>
          </button>

          <button
            type="button"
            onClick={handleQuickTestCompany}
            disabled={isLoading}
            className="auth-quick-btn auth-quick-btn-new"
            title="Создать новую организацию с полностью чистой базой счетов и операций"
          >
            <div className="auth-quick-avatar" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              ✨
            </div>
            <div className="auth-quick-info">
              <span className="auth-quick-name">Создать тестовую компанию</span>
              <span className="auth-quick-meta">Чистая база (0 ₽) • Изолированный профиль</span>
            </div>
          </button>
        </div>

        {/* Safety & Multi-Tenant Info Footer */}
        <div className="auth-footer-badge">
          <Shield size={14} className="text-accent" />
          <span>Изолированная база данных и шифрование PostgreSQL Supabase</span>
        </div>
      </div>
    </div>
  );
};
