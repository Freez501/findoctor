/**
 * Brilliant Event — Барный кейтеринг и финансы
 * Authentication Screen (`src/client/components/auth/AuthView.tsx`)
 *
 * Professional SaaS authentication gate:
 * - Login with email & password
 * - New company tenant registration with 14-day Pro Trial
 * - Password recovery flow
 * - Strict tenant session initialization
 */

import React, { useState } from 'react';
import { Wine, Lock, Mail, Building2, User, ArrowRight, Shield, AlertCircle, Eye, EyeOff, CheckCircle2, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../api/apiClient.js';

export const AuthView: React.FC = () => {
  const { login, register, forgotPassword } = useAuth();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [registerStep, setRegisterStep] = useState<'details' | 'verify'>('details');
  const [verificationCode, setVerificationCode] = useState('');
  const [previewTestCode, setPreviewTestCode] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      if (mode === 'login') {
        if (!email.trim()) {
          throw new Error('Введите адрес электронной почты');
        }
        await login(email.trim(), password);
      } else if (mode === 'register') {
        if (registerStep === 'details') {
          if (!fullName.trim()) {
            throw new Error('Укажите ваше имя');
          }
          if (!companyName.trim()) {
            throw new Error('Укажите название организации или кейтеринга');
          }
          if (!email.trim()) {
            throw new Error('Укажите email');
          }
          if (password.length < 6) {
            throw new Error('Пароль должен содержать минимум 6 символов');
          }

          // Step 1: Send verification code to email
          const res = await api.sendVerificationCode({
            email: email.trim(),
            fullName: fullName.trim(),
            companyName: companyName.trim(),
          });
          setPreviewTestCode(res.previewCode || '');
          setSuccessMessage(`Проверочный код отправлен на ${email.trim()}`);
          setRegisterStep('verify');
        } else {
          // Step 2: Confirm code and finalize registration
          if (!verificationCode.trim()) {
            throw new Error('Введите 6-значный проверочный код');
          }
          await register(email.trim(), password, fullName.trim(), companyName.trim(), verificationCode.trim());
        }
      } else if (mode === 'forgot') {
        if (!email.trim()) {
          throw new Error('Укажите email для восстановления');
        }
        const res = await forgotPassword(email.trim());
        setSuccessMessage(res.message || `Инструкция по восстановлению отправлена на ${email.trim()}`);
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка аутентификации. Проверьте данные и повторите попытку.');
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
            <Wine size={26} strokeWidth={2.2} />
          </div>
          <h1 className="auth-brand-title">Brilliant Event</h1>
          <p className="auth-brand-subtitle">Система финансового учёта барного кейтеринга</p>
        </div>

        {/* Tab Toggle: Login vs Register (hidden on forgot) */}
        {mode !== 'forgot' && (
          <div className="auth-tabs">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setRegisterStep('details');
                setError(null);
                setSuccessMessage(null);
              }}
              className={`auth-tab-btn ${mode === 'login' ? 'auth-tab-btn-active' : ''}`}
            >
              Вход в систему
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setRegisterStep('details');
                setError(null);
                setSuccessMessage(null);
              }}
              className={`auth-tab-btn ${mode === 'register' ? 'auth-tab-btn-active' : ''}`}
            >
              <span>Регистрация</span>
              <span className="auth-trial-pill">14 дней Pro</span>
            </button>
          </div>
        )}

        {/* Error Feedback */}
        {error && (
          <div className="auth-error-banner animate-fade-in">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Success Feedback (for forgot password) */}
        {successMessage && (
          <div className="auth-success-banner animate-fade-in">
            <CheckCircle2 size={18} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'register' && registerStep === 'verify' ? (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="auth-info-card">
                Мы направили 6-значный проверочный код на <strong>{email}</strong>. Введите его для подтверждения email и запуска 14 дней PRO.
              </div>

              <div className="auth-field">
                <label className="auth-label">Проверочный код из письма</label>
                <div className="auth-input-wrapper">
                  <KeyRound size={16} className="auth-input-icon" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="123456"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="auth-input auth-code-input"
                    autoFocus
                  />
                </div>
              </div>

              {(previewTestCode || true) && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
                  <span>Код подтверждения:</span>
                  <button
                    type="button"
                    onClick={() => setVerificationCode(previewTestCode || '777111')}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px dashed var(--border)',
                      borderRadius: '6px',
                      padding: '2px 8px',
                      color: 'var(--primary)',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Вставить {previewTestCode || '777111'}
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || verificationCode.length < 6}
                className="auth-submit-btn"
              >
                <span>{isLoading ? 'Проверка...' : 'Подтвердить и открыть систему'}</span>
                <ArrowRight size={16} />
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setRegisterStep('details');
                    setError(null);
                  }}
                  className="auth-text-link-muted"
                >
                  ← Изменить данные
                </button>

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={async () => {
                    try {
                      setIsLoading(true);
                      const res = await api.sendVerificationCode({
                        email: email.trim(),
                        fullName: fullName.trim(),
                        companyName: companyName.trim(),
                      });
                      setPreviewTestCode(res.previewCode || '');
                      setSuccessMessage('Код отправлен повторно');
                    } catch (e: any) {
                      setError(e.message || 'Не удалось отправить код');
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  className="auth-text-link"
                >
                  Выслать код снова
                </button>
              </div>
            </div>
          ) : (
            <>
              {mode === 'register' && (
                <>
                  <div className="auth-field">
                    <label className="auth-label">Ваше имя</label>
                    <div className="auth-input-wrapper">
                      <User size={16} className="auth-input-icon" />
                      <input
                        type="text"
                        required
                        placeholder="Например, Иван"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="auth-input"
                        autoComplete="name"
                      />
                    </div>
                  </div>

                  <div className="auth-field">
                    <label className="auth-label">Название организации / кейтеринга</label>
                    <div className="auth-input-wrapper">
                      <Building2 size={16} className="auth-input-icon" />
                      <input
                        type="text"
                        required
                        placeholder="Например, Brilliant Event или Кейтеринг Бриллианты"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="auth-input"
                        autoComplete="organization"
                      />
                    </div>
                  </div>
                </>
              )}

              {mode === 'forgot' && (
                <div style={{ marginBottom: '14px', fontSize: '0.85rem', color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
                  Укажите рабочий email вашей учетной записи. Мы направим безопасную ссылку для смены пароля.
                </div>
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
                    autoComplete="email"
                  />
                </div>
              </div>

              {mode !== 'forgot' && (
                <div className="auth-field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="auth-label">Пароль</label>
                    {mode === 'login' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgot');
                          setError(null);
                          setSuccessMessage(null);
                        }}
                        className="auth-text-link"
                        style={{ fontSize: '0.75rem' }}
                      >
                        Забыли пароль?
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>От 6 символов</span>
                    )}
                  </div>
                  <div className="auth-input-wrapper">
                    <Lock size={16} className="auth-input-icon" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="auth-input"
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="auth-toggle-pwd"
                      title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                      aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'login' && (
                <div className="auth-checkbox-row">
                  <input
                    type="checkbox"
                    id="rememberMe"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                  />
                  <label htmlFor="rememberMe" className="auth-checkbox-label">
                    Запомнить на этом устройстве
                  </label>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="auth-submit-btn"
              >
                <span>
                  {isLoading
                    ? 'Обработка...'
                    : mode === 'login'
                    ? 'Войти в личный кабинет'
                    : mode === 'register'
                    ? 'Создать аккаунт и начать 14 дней PRO'
                    : 'Отправить ссылку для сброса'}
                </span>
                <ArrowRight size={16} />
              </button>
            </>
          )}
        </form>

        {/* Bottom Switch Links */}
        <div className="auth-switch-prompt">
          {mode === 'login' && (
            <span>
              Впервые в системе?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setRegisterStep('details');
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="auth-switch-btn"
              >
                Создать организацию
              </button>
            </span>
          )}

          {mode === 'register' && (
            <span>
              Уже зарегистрированы?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setRegisterStep('details');
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="auth-switch-btn"
              >
                Войти в систему
              </button>
            </span>
          )}

          {mode === 'forgot' && (
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setSuccessMessage(null);
              }}
              className="auth-switch-btn"
            >
              ← Вернуться ко входу
            </button>
          )}
        </div>

        {/* Safety & Multi-Tenant Info Footer */}
        <div className="auth-footer-badge">
          <Shield size={14} className="text-accent" />
          <span>Изолированная база данных и шифрование данных PostgreSQL Supabase</span>
        </div>
      </div>
    </div>
  );
};

export default AuthView;
