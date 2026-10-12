/**
 * FINDOCTOR — Финансы и маржа выездных мероприятий
 * Product Landing Page (`src/client/components/landing/ProductLanding.tsx`)
 */

import React from 'react';
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Play,
  Sparkles,
  Wallet,
  Zap,
} from 'lucide-react';

interface ProductLandingProps {
  onTryDemo: () => void;
  onOpenAuth: (mode?: 'login' | 'register') => void;
}

export const ProductLanding: React.FC<ProductLandingProps> = ({ onTryDemo, onOpenAuth }) => {
  return (
    <div className="landing-page-wrapper animate-fade-in">
      {/* Top Navbar */}
      <header className="landing-navbar">
        <div className="landing-nav-container">
          <div className="landing-brand">
            <div className="brand-icon-brilliant" aria-hidden="true">
              <Activity size={18} className="brand-gem-sparkle" />
            </div>
            <div>
              <div className="brand-title-brilliant">FINDOCTOR</div>
              <div className="brand-tagline">Финансы и маржа для ивентов</div>
            </div>
          </div>

          <div className="landing-nav-actions">
            <button
              type="button"
              onClick={onTryDemo}
              className="landing-btn-demo-sm"
            >
              <Play size={14} />
              <span>Демо в 1 клик</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="landing-btn-login"
            >
              Войти в кабинет
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="landing-main">
        <section className="landing-hero-grid">
          <div className="landing-hero-copy">
            <div className="landing-eyebrow-badge">
              <Sparkles size={14} />
              <span>Финансовый учёт для выездных баров, кейтеринга и ивент-команд</span>
            </div>

            <h1 className="landing-hero-title">
              Узнайте реальную чистую прибыль каждого выезда за 3 секунды
            </h1>

            <p className="landing-hero-subtitle">
              Больше никаких потерянных чеков за лёд, путаницы между наличкой на площадке и
              расчётным счётом ИП. Записывайте расходы со смены в два касания и сразу видите
              маржу банкета в рублях и процентах.
            </p>

            <div className="landing-cta-group">
              <button
                type="button"
                onClick={onTryDemo}
                className="landing-btn-primary"
                data-testid="landing-try-demo-btn"
              >
                <Play size={18} />
                <span>Попробовать с демо-данными (без регистрации)</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenAuth('register')}
                className="landing-btn-secondary"
                data-testid="landing-open-auth-btn"
              >
                <span>Создать свою компанию</span>
                <ArrowRight size={16} />
              </button>
            </div>

            <div className="landing-trust-pills">
              <span>
                <CheckCircle2 size={14} /> 5 готовых счетов и 2 банкета в демо
              </span>
              <span>
                <CheckCircle2 size={14} /> Работает на телефоне как приложение (PWA)
              </span>
              <span>
                <CheckCircle2 size={14} /> Ввод голосом и текстом через Telegram
              </span>
            </div>
          </div>

          {/* Live Interactive Preview Card */}
          <div className="landing-preview-card">
            <div className="landing-preview-header">
              <div>
                <div className="landing-preview-label">Живой пример из демо-базы</div>
                <div className="landing-preview-title">IT-Корпоратив «НексаТек» (300 гостей)</div>
              </div>
              <span className="landing-preview-margin-badge">Маржа 58%</span>
            </div>

            <div className="landing-preview-metrics">
              <div className="landing-preview-metric-box">
                <span className="landing-metric-caption">Выручка по договору</span>
                <strong className="landing-metric-value">+294 000 ₽</strong>
              </div>
              <div className="landing-preview-metric-box">
                <span className="landing-metric-caption">Алкоголь, лёд, бармены</span>
                <strong className="landing-metric-value landing-metric-expense">−123 500 ₽</strong>
              </div>
              <div className="landing-preview-metric-box landing-metric-profit-box">
                <span className="landing-metric-caption">Чистая прибыль смены</span>
                <strong className="landing-metric-value landing-metric-profit">+170 500 ₽</strong>
              </div>
            </div>

            <div className="landing-preview-accounts">
              <div className="landing-preview-accounts-head">
                <span>Консолидированный баланс 5 счетов</span>
                <strong>1 166 300 ₽</strong>
              </div>
              <div className="landing-preview-account-pills">
                <span>Нал 1 (Площадка): 6 300 ₽</span>
                <span>Нал 2 (Сейф): 199 000 ₽</span>
                <span>Р/С ИП (Т-Банк): 814 000 ₽</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onTryDemo}
              className="landing-preview-action"
            >
              <span>Открыть этот кейс в интерактивном демо</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </section>

        {/* 3 Core Product Pillars */}
        <section className="landing-features-grid" aria-label="Как работает FINDOCTOR">
          <div className="landing-feature-card">
            <div className="landing-feature-icon">
              <Zap size={20} />
            </div>
            <h3>Ввод расхода на площадке за 3 секунды</h3>
            <p>
              Крупный цифровой пульт под большой палец и быстрый парсер команд вроде{' '}
              <code>4500 лед нал 1</code> прямо во время мероприятия.
            </p>
          </div>

          <div className="landing-feature-card">
            <div className="landing-feature-icon">
              <BarChart3 size={20} />
            </div>
            <h3>Честная рентабельность каждого выезда</h3>
            <p>
              Все предоплаты, закупки алкоголя, боя стекла, логистики и ФОТ команды автоматически
              складываются в чистую маржу конкретного события.
            </p>
          </div>

          <div className="landing-feature-card">
            <div className="landing-feature-icon">
              <Wallet size={20} />
            </div>
            <h3>Прозрачность между кассой, сейфом и банком</h3>
            <p>
              Отслеживайте наличные у старшего бармена, инкассацию в сейф, расчётные счета ИП/ООО,
              выписки из банков и доли партнёров без таблиц Excel.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
};
