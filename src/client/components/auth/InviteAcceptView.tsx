/**
 * Brilliant Event — Барный кейтеринг и финансы
 * Invite Acceptance Screen (`src/client/components/auth/InviteAcceptView.tsx`)
 *
 * Smooth, modern employee onboarding flow via link or QR code:
 * - Automatically validates invite token
 * - Displays inviting company branding & invited role permissions
 * - Instant 1-click accept if already authenticated
 * - Zero-friction name + email + password onboarding for new team members
 */

import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  User,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { api } from '../../api/apiClient.js';
import { useAuth } from '../../context/AuthContext.js';
import { UserRole } from '../../../shared/types.js';

interface InviteAcceptViewProps {
  token: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const InviteAcceptView: React.FC<InviteAcceptViewProps> = ({ token, onSuccess, onCancel }) => {
  const { currentUser, acceptInvite } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [inviteInfo, setInviteInfo] = useState<{
    id: string;
    token: string;
    companyId: string;
    companyName: string;
    role: UserRole;
    email?: string;
    fullName?: string;
    inviterName?: string;
  } | null>(null);

  // Form states for new registration
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fetchInvite = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.getInviteByToken(token);
        if (!isMounted) return;
        if (!res.valid || !res.invite) {
          setError(res.error || 'Ссылка приглашения недействительна или устарела');
        } else {
          setInviteInfo(res.invite);
          if (res.invite.fullName) setFullName(res.invite.fullName);
          if (res.invite.email) setEmail(res.invite.email);
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message || 'Ошибка проверки приглашения');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchInvite();
    return () => {
      isMounted = false;
    };
  }, [token]);

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'owner':
      case 'super_admin':
        return { label: 'Совладелец / Главный финдиректор', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' };
      case 'accountant':
      case 'admin':
        return { label: 'Бухгалтер / Финменеджер', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' };
      case 'staff':
      default:
        return { label: 'Сотрудник / Бармен на выезде', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' };
    }
  };

  const getRoleDescription = (role: UserRole) => {
    switch (role) {
      case 'owner':
      case 'super_admin':
        return 'Полный доступ к финансам кейтеринга, кассам, сметам и аналитике дивидендов.';
      case 'accountant':
      case 'admin':
        return 'Внесение и проверка операций, счетов, категорий и детальных отчётов по выездным барам.';
      case 'staff':
      default:
        return 'Моментальный мобильный ввод чеков, расходов на закупки льда/алкоголя и чаевых прямо с телефона на мероприятии.';
    }
  };

  const handleAcceptForLoggedIn = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await acceptInvite(token);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Не удалось принять приглашение');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterAndAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Укажите ваше имя');
      return;
    }
    if (!email.trim()) {
      setError('Укажите email');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await acceptInvite(token, {
        fullName: fullName.trim(),
        email: email.trim(),
        password: password || undefined,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Ошибка регистрации по приглашению');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="auth-container">
        <div className="auth-card animate-fade-in" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <Loader2 size={36} className="animate-spin" style={{ margin: '0 auto 16px', color: 'var(--primary)' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--foreground)', marginBottom: '8px' }}>
            Проверка ссылки-приглашения...
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--muted-foreground)' }}>
            Секунду, подключаемся к системе кейтеринга
          </p>
        </div>
      </div>
    );
  }

  if (error && !inviteInfo) {
    return (
      <div className="auth-container">
        <div className="auth-card animate-fade-in" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <AlertCircle size={28} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--foreground)', marginBottom: '8px' }}>
            Ссылка недействительна
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', marginBottom: '24px', lineHeight: 1.5 }}>
            {error}
          </p>
          <button
            type="button"
            onClick={onCancel}
            className="btn-form-submit"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            Вернуться на главную
          </button>
        </div>
      </div>
    );
  }

  if (!inviteInfo) return null;

  const roleBadge = getRoleBadge(inviteInfo.role);

  return (
    <div className="auth-container animate-fade-in">
      <div className="auth-card" style={{ maxWidth: '480px' }}>
        {/* Header badge */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '20px',
            backgroundColor: 'rgba(217, 119, 6, 0.1)',
            border: '1px solid rgba(217, 119, 6, 0.25)',
            color: '#d97706',
            fontSize: '12px',
            fontWeight: 600,
            marginBottom: '16px',
          }}>
            <Sparkles size={14} />
            <span>Приглашение в команду</span>
          </div>

          <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--foreground)', marginBottom: '6px' }}>
            «{inviteInfo.companyName}»
          </h2>
          {inviteInfo.inviterName && (
            <p style={{ fontSize: '13px', color: 'var(--muted-foreground)' }}>
              Пригласил: <strong style={{ color: 'var(--foreground)' }}>{inviteInfo.inviterName}</strong>
            </p>
          )}
        </div>

        {/* Role card */}
        <div style={{
          backgroundColor: 'var(--secondary)',
          borderRadius: '12px',
          padding: '14px 16px',
          border: '1px solid var(--border)',
          marginBottom: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted-foreground)', fontWeight: 500 }}>
              Ваша роль в системе:
            </span>
            <span style={{
              fontSize: '12px',
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: '6px',
              backgroundColor: roleBadge.bg,
              color: roleBadge.color,
            }}>
              {roleBadge.label}
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', lineHeight: 1.4, margin: 0 }}>
            {getRoleDescription(inviteInfo.role)}
          </p>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#ef4444',
            fontSize: '12px',
            marginBottom: '16px',
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* CASE 1: User is already logged in */}
        {currentUser ? (
          <div>
            <div style={{
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              marginBottom: '20px',
              fontSize: '12px',
              color: 'var(--foreground)',
              lineHeight: 1.5,
            }}>
              Вы вошли как <strong style={{ color: '#3b82f6' }}>{currentUser.fullName || currentUser.email}</strong>.
              Нажмите кнопку ниже, чтобы присоединиться к компании «{inviteInfo.companyName}».
            </div>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleAcceptForLoggedIn}
              className="btn-form-submit"
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
            >
              {isSubmitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCircle2 size={16} />
              )}
              <span>{isSubmitting ? 'Подключение...' : 'Принять приглашение и войти'}</span>
            </button>

            <button
              type="button"
              onClick={onCancel}
              style={{
                width: '100%',
                marginTop: '10px',
                padding: '10px',
                background: 'transparent',
                border: 'none',
                color: 'var(--muted-foreground)',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Отклонить и вернуться
            </button>
          </div>
        ) : (
          /* CASE 2: New user onboarding */
          <form onSubmit={handleRegisterAndAccept}>
            <div className="settings-input-group" style={{ marginBottom: '14px' }}>
              <label className="settings-input-label">Ваше имя и фамилия</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="например: Алексей Бармен"
                  className="settings-text-input"
                  style={{ paddingLeft: '38px' }}
                  autoFocus
                />
              </div>
            </div>

            <div className="settings-input-group" style={{ marginBottom: '14px' }}>
              <label className="settings-input-label">Email для входа</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@example.com"
                  className="settings-text-input"
                  style={{ paddingLeft: '38px' }}
                />
              </div>
            </div>

            <div className="settings-input-group" style={{ marginBottom: '20px' }}>
              <label className="settings-input-label">Придумайте пароль (опционально)</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Минимум 6 символов"
                  className="settings-text-input"
                  style={{ paddingLeft: '38px' }}
                />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '4px' }}>
                Позволит быстро входить в приложение с любого устройства
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !fullName.trim() || !email.trim()}
              className="btn-form-submit"
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
            >
              {isSubmitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ArrowRight size={16} />
              )}
              <span>{isSubmitting ? 'Подключение к команде...' : 'Присоединиться к команде'}</span>
            </button>

            <div style={{ textAlign: 'center', marginTop: '14px' }}>
              <button
                type="button"
                onClick={onCancel}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--muted-foreground)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Отмена
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
