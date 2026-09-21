/**
 * Truespace — Барный кейтеринг и финансы
 * Telegram Bot Status Badge & Info Popover (`src/client/components/telegram/TelegramBotStatus.tsx`)
 *
 * Displays live connectivity status of the Telegram bot service:
 * - Active mode: 'mock' (in-browser simulator) vs 'polling' / 'webhook'
 * - Bot username (@TruespaceBarBot)
 * - Popover with technical status details and manual refresh
 */

import React, { useState } from 'react';
import { Bot, ExternalLink, RefreshCw, X, ShieldCheck } from 'lucide-react';
import { useTelegram } from '../../hooks/useTelegram.js';
import { formatTime24h } from '../../utils/formatters.js';

export const TelegramBotStatus: React.FC = () => {
  const { botStatus, isStatusLoading, refetchStatus } = useTelegram();
  const [showPopover, setShowPopover] = useState<boolean>(false);

  const isPolling = botStatus?.mode === 'polling';
  const isMock = botStatus?.mode === 'mock';
  const isOnline = botStatus?.enabled ?? true;

  const modeBadgeColor = isPolling
    ? 'badge-bot-polling'
    : isMock
    ? 'badge-bot-mock'
    : 'badge-bot-offline';

  const dotColorClass = isPolling ? 'dot-polling' : 'dot-mock';

  return (
    <div className="telegram-status-wrapper">
      <button
        type="button"
        onClick={() => setShowPopover((prev) => !prev)}
        className={`btn-telegram-status ${modeBadgeColor}`}
        title="Нажмите для просмотра сведений о Telegram-боте"
        aria-expanded={showPopover}
      >
        <span className="relative-dot-box">
          {isOnline && <span className={`pulse-ring ${dotColorClass}`} />}
          <span className={`static-dot ${dotColorClass}`} />
        </span>
        <Bot size={14} className="bot-icon shrink-0" aria-hidden="true" />
        <span className="bot-handle">
          {isMock ? 'Симулятор Telegram' : (botStatus?.botUsername || '@TruespaceBarBot')}
        </span>
      </button>

      {/* Popover Card */}
      {showPopover && (
        <>
          <div
            className="popover-backdrop"
            onClick={() => setShowPopover(false)}
            aria-hidden="true"
          />
          <div className="telegram-popover-card animate-fade-in" role="dialog" aria-label="Статус Telegram-бота">
            <div className="popover-header">
              <div className="popover-title-row">
                <Bot size={16} className="text-accent" aria-hidden="true" />
                <span className="popover-title">Статус Telegram</span>
              </div>
              <div className="popover-header-actions">
                <button
                  type="button"
                  onClick={() => refetchStatus()}
                  disabled={isStatusLoading}
                  className="btn-popover-refresh"
                  title="Обновить статус бота"
                >
                  <RefreshCw size={12} className={isStatusLoading ? 'animate-spin' : ''} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowPopover(false)}
                  className="btn-popover-close"
                  aria-label="Закрыть"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="popover-rows">
              <div className="popover-row">
                <span className="row-label">Режим работы:</span>
                <span className="row-value font-mono">
                  {isMock ? 'Mock (Веб-симулятор)' : isPolling ? 'Long Polling' : 'Webhook'}
                </span>
              </div>

              <div className="popover-row">
                <span className="row-label">Имя бота:</span>
                <a
                  href={`https://t.me/${(botStatus?.botUsername || 'TruespaceBarBot').replace('@', '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="row-link"
                  title="Открыть бота в Telegram"
                >
                  <span>{botStatus?.botUsername || '@TruespaceBarBot'}</span>
                  <ExternalLink size={11} aria-hidden="true" />
                </a>
              </div>

              <div className="popover-row">
                <span className="row-label">Готовность:</span>
                <span className="row-value text-success font-semibold flex items-center gap-1">
                  <ShieldCheck size={13} aria-hidden="true" />
                  <span>{isOnline ? 'Активен' : 'Отключен'}</span>
                </span>
              </div>

              {botStatus?.lastActiveAt && (
                <div className="popover-row">
                  <span className="row-label">Активность:</span>
                  <span className="row-value">
                    {formatTime24h(botStatus.lastActiveAt, true)}
                  </span>
                </div>
              )}
            </div>

            <div className="popover-footer">
              <p className="popover-hint">
                {isMock
                  ? 'Работает веб-симулятор. Вы можете вводить и проверять текстовые команды прямо в браузере без токена бота.'
                  : 'Бот слушает реальные сообщения из чата. Команды барменов автоматически попадают в кассу.'}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
