/**
 * FINDOCTOR — Финансы и маржа выездных мероприятий
 * Interactive 3-Step Onboarding & Demo Mode Banner (`src/client/components/onboarding/OnboardingChecklist.tsx`)
 */

import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Circle,
  Calendar,
  PlusCircle,
  BarChart3,
  RotateCcw,
  Sparkles,
  X,
  ChevronRight,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { useResetDemo } from '../../hooks/useResetDemo.js';
import { TabType } from '../common/Header.js';

interface OnboardingChecklistProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onOpenQuickEntry: () => void;
}

const STORAGE_STEPS_KEY = 'findoctor_onboarding_steps';
const STORAGE_DISMISSED_KEY = 'findoctor_onboarding_dismissed';

export const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({
  currentTab,
  onSelectTab,
  onOpenQuickEntry,
}) => {
  const { isDemoMode, logout } = useAuth();
  const { resetDemo, isResetting } = useResetDemo();

  const [completedSteps, setCompletedSteps] = useState<number[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_STEPS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_DISMISSED_KEY) === 'true';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_STEPS_KEY, JSON.stringify(completedSteps));
  }, [completedSteps]);

  // Auto-mark step 1 if user visits events tab, step 3 if user visits analytics tab
  useEffect(() => {
    if (currentTab === 'events' && !completedSteps.includes(1)) {
      setCompletedSteps((prev) => [...prev, 1]);
    }
    if (currentTab === 'analytics' && !completedSteps.includes(3)) {
      setCompletedSteps((prev) => [...prev, 3]);
    }
  }, [currentTab, completedSteps]);

  const markStep = (step: number) => {
    setCompletedSteps((prev) => (prev.includes(step) ? prev : [...prev, step]));
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem(STORAGE_DISMISSED_KEY, 'true');
  };

  const handleReopenOnboarding = () => {
    setIsDismissed(false);
    localStorage.removeItem(STORAGE_DISMISSED_KEY);
  };

  const progressCount = completedSteps.length;

  return (
    <div className="onboarding-zone">
      {/* Demo Mode Top Bar */}
      {isDemoMode && (
        <div className="demo-mode-banner" role="status" data-testid="demo-mode-banner">
          <div className="demo-mode-info">
            <span className="demo-mode-pill">ДЕМО-РЕЖИМ</span>
            <span className="demo-mode-text">
              Вы смотрите живой пример с 5 счетами и 2 мероприятиями. Смело добавляйте операции!
            </span>
          </div>

          <div className="demo-mode-actions">
            {isDismissed && (
              <button
                type="button"
                onClick={handleReopenOnboarding}
                className="demo-btn-secondary"
              >
                <Sparkles size={13} />
                <span>Гид по старту ({progressCount}/3)</span>
              </button>
            )}

            <button
              type="button"
              onClick={resetDemo}
              disabled={isResetting}
              className="demo-btn-secondary"
              title="Вернуть исходные демо-данные (1 166 300 ₽)"
            >
              <RotateCcw size={13} className={isResetting ? 'animate-spin' : ''} />
              <span>{isResetting ? 'Сброс...' : 'Сбросить демо'}</span>
            </button>

            <button
              type="button"
              onClick={() => logout()}
              className="demo-btn-primary"
            >
              <UserPlus size={13} />
              <span>Создать свой кабинет</span>
            </button>
          </div>
        </div>
      )}

      {/* 3-Step Interactive Onboarding Card */}
      {!isDismissed && (
        <section
          className="onboarding-card"
          aria-label="Пошаговое знакомство с FINDOCTOR"
          data-testid="onboarding-checklist"
        >
          <div className="onboarding-header">
            <div className="onboarding-title-group">
              <div className="onboarding-badge-icon">
                <Sparkles size={16} />
              </div>
              <div>
                <h2 className="onboarding-title">
                  Быстрый старт в FINDOCTOR: проверьте учёт за 3 шага
                </h2>
                <p className="onboarding-subtitle">
                  Пройдите главный маршрут от мероприятия и расхода со смены до расчёта чистой маржи
                </p>
              </div>
            </div>

            <div className="onboarding-header-right">
              <span className="onboarding-progress-pill">
                Выполнено: {progressCount} из 3
              </span>
              <button
                type="button"
                onClick={handleDismiss}
                className="onboarding-close-btn"
                title="Скрыть подсказку"
                aria-label="Скрыть онбординг"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="onboarding-steps-grid">
            {/* Step 1 */}
            <div
              className={`onboarding-step-item ${
                completedSteps.includes(1) ? 'onboarding-step-done' : ''
              }`}
            >
              <div className="onboarding-step-top">
                <span className="onboarding-step-num">Шаг 1</span>
                {completedSteps.includes(1) ? (
                  <CheckCircle2 size={18} className="onboarding-icon-done" />
                ) : (
                  <Circle size={18} className="onboarding-icon-pending" />
                )}
              </div>
              <h3 className="onboarding-step-heading">Выберите или создайте мероприятие</h3>
              <p className="onboarding-step-desc">
                Откройте список выездов (например, «Свадьба в лофте» или «IT-Корпоратив») либо
                добавьте свой банкет.
              </p>
              <button
                type="button"
                onClick={() => {
                  markStep(1);
                  onSelectTab('events');
                }}
                className="onboarding-step-action"
                data-testid="onboarding-step-1-btn"
              >
                <Calendar size={14} />
                <span>Открыть мероприятия</span>
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Step 2 */}
            <div
              className={`onboarding-step-item ${
                completedSteps.includes(2) ? 'onboarding-step-done' : ''
              }`}
            >
              <div className="onboarding-step-top">
                <span className="onboarding-step-num">Шаг 2</span>
                {completedSteps.includes(2) ? (
                  <CheckCircle2 size={18} className="onboarding-icon-done" />
                ) : (
                  <Circle size={18} className="onboarding-icon-pending" />
                )}
              </div>
              <h3 className="onboarding-step-heading">Внесите расход со смены за 3 секунды</h3>
              <p className="onboarding-step-desc">
                Нажмите «Внести операцию», введите сумму (например, 4 500 ₽ за лёд) и привяжите её к
                мероприятию.
              </p>
              <button
                type="button"
                onClick={() => {
                  markStep(2);
                  onOpenQuickEntry();
                }}
                className="onboarding-step-action"
                data-testid="onboarding-step-2-btn"
              >
                <PlusCircle size={14} />
                <span>Внести тестовый расход</span>
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Step 3 */}
            <div
              className={`onboarding-step-item ${
                completedSteps.includes(3) ? 'onboarding-step-done' : ''
              }`}
            >
              <div className="onboarding-step-top">
                <span className="onboarding-step-num">Шаг 3</span>
                {completedSteps.includes(3) ? (
                  <CheckCircle2 size={18} className="onboarding-icon-done" />
                ) : (
                  <Circle size={18} className="onboarding-icon-pending" />
                )}
              </div>
              <h3 className="onboarding-step-heading">Посмотрите чистую прибыль и аналитику</h3>
              <p className="onboarding-step-desc">
                Перейдите в раздел «Аналитика», чтобы увидеть рентабельность каждого выезда в
                процентах и рублях.
              </p>
              <button
                type="button"
                onClick={() => {
                  markStep(3);
                  onSelectTab('analytics');
                }}
                className="onboarding-step-action"
                data-testid="onboarding-step-3-btn"
              >
                <BarChart3 size={14} />
                <span>Смотреть аналитику</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
