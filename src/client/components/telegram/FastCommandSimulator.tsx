/**
 * Truespace — Барный кейтеринг и финансы
 * Fast Command Simulator Component (`src/client/components/telegram/FastCommandSimulator.tsx`)
 *
 * In-browser interactive simulator enabling bartenders and managers to record
 * financial operations via freeform text ("3500 лед Корпоратив Т-Банк") without
 * waiting for a Telegram bot token.
 */

import React, { useRef } from 'react';
import { Send, Sparkles, X, AlertCircle, Check, Loader2 } from 'lucide-react';
import { useTelegram } from '../../hooks/useTelegram.js';
import { TelegramBotStatus } from './TelegramBotStatus.js';
import { CommandChips } from './CommandChips.js';
import { ParsedPreviewCard } from './ParsedPreviewCard.js';

export const FastCommandSimulator: React.FC = () => {
  const {
    inputText,
    setInputText,
    parsedResult,
    isParsing,
    isExecuting,
    parseError,
    executeError,
    lastSuccessMessage,
    execute,
    selectExample,
    clear,
  } = useTelegram();

  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedResult && !isExecuting) {
      execute();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // IME composition safety check per modern-web-guidance
    if (e.nativeEvent.isComposing || e.keyCode === 229) {
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      if (parsedResult && !isExecuting) {
        e.preventDefault();
        execute();
      }
    }
  };

  return (
    <section className="telegram-simulator-section" aria-label="Симулятор быстрой строки Telegram">
      {/* Header with Title and Bot Status */}
      <div className="simulator-header">
        <div className="simulator-title-group">
          <div className="simulator-badge-icon" aria-hidden="true">
            <Sparkles size={18} />
          </div>
          <div>
            <h2 className="simulator-heading">Быстрый ввод из чата Telegram</h2>
            <p className="simulator-subheading">
              Введите операцию естественным языком или выберите готовый сценарий
            </p>
          </div>
        </div>

        <TelegramBotStatus />
      </div>

      {/* Preset scenario chips */}
      <div className="simulator-chips-container">
        <CommandChips onSelect={selectExample} activeCommand={inputText} />
      </div>

      {/* Command Input Form */}
      <form onSubmit={handleSubmit} className="simulator-form" noValidate>
        <div className="simulator-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Например: 3500 лед Корпоратив Т-Банк или -1500 такси нал1..."
            className="simulator-text-input"
            disabled={isExecuting}
            aria-label="Строка быстрой команды Telegram"
            autoComplete="off"
            spellCheck={false}
          />

          <div className="input-actions-right">
            {inputText && (
              <button
                type="button"
                onClick={clear}
                className="btn-input-clear"
                title="Очистить строку"
                aria-label="Очистить строку"
              >
                <X size={16} />
              </button>
            )}

            <button
              type="submit"
              disabled={!parsedResult || isExecuting || isParsing}
              className="btn-input-submit"
              title="Записать операцию в кассу (Enter)"
            >
              {isExecuting ? (
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              ) : (
                <>
                  <span className="submit-text">Ввод</span>
                  <Send size={13} aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Dynamic inline parse guidance */}
        {parseError && inputText.trim().length >= 3 && (
          <div className="parse-error-hint animate-fade-in" role="alert">
            <AlertCircle size={14} className="shrink-0" aria-hidden="true" />
            <span>{parseError}</span>
          </div>
        )}

        {/* Execution error */}
        {executeError && (
          <div className="execute-error-hint animate-fade-in" role="alert">
            <AlertCircle size={14} className="shrink-0" aria-hidden="true" />
            <span>{executeError}</span>
          </div>
        )}

        {/* Success message banner */}
        {lastSuccessMessage && (
          <div className="simulator-success-banner animate-fade-in" role="status">
            <Check size={16} className="text-success shrink-0" aria-hidden="true" />
            <span>{lastSuccessMessage}</span>
          </div>
        )}
      </form>

      {/* Real-time Parsed Preview Card */}
      {parsedResult && (
        <ParsedPreviewCard
          parsed={parsedResult}
          isExecuting={isExecuting}
          onConfirm={() => execute()}
        />
      )}
    </section>
  );
};
