/**
 * Truespace — Барный кейтеринг и финансы
 * Parsed Command Preview Card (`src/client/components/telegram/ParsedPreviewCard.tsx`)
 *
 * Real-time breakdown of extracted entities (Amount, Type, Category, Account, Event, Confidence)
 * with one-click ledger confirmation button.
 */

import React from 'react';
import {
  Check,
  Tag,
  Wallet,
  Calendar,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { ParsedCommand } from '../../../shared/types.js';
import { formatRubles, formatPercent } from '../../utils/formatters.js';
import { Badge } from '../common/Badge.js';

interface ParsedPreviewCardProps {
  parsed: ParsedCommand;
  isExecuting: boolean;
  onConfirm: () => void;
}

export const ParsedPreviewCard: React.FC<ParsedPreviewCardProps> = ({
  parsed,
  isExecuting,
  onConfirm,
}) => {
  const isIncome = parsed.type === 'income';
  const confidencePercent = Math.round((parsed.confidence || 0) * 100);

  return (
    <div className="parsed-preview-card animate-fade-in" aria-label="Предварительный разбор операции">
      {/* Top summary row: Amount, Type, and Confidence */}
      <div className="preview-top-row">
        <div className="preview-amount-group">
          <span className={`preview-amount ${isIncome ? 'amount-income' : 'amount-expense'}`}>
            {isIncome ? `+${formatRubles(parsed.amount)}` : `−${formatRubles(parsed.amount)}`}
          </span>

          <Badge variant={isIncome ? 'income' : 'expense'} size="sm">
            {isIncome ? 'Приход' : 'Расход'}
          </Badge>
        </div>

        {/* Confidence metric */}
        <div className="confidence-pill" title="Точность сопоставления слов парсером">
          <ShieldCheck size={13} className="text-success" aria-hidden="true" />
          <span>Уверенность: {formatPercent(confidencePercent, 0)}</span>
        </div>
      </div>

      {/* Entity Chips Grid */}
      <div className="preview-entities-grid">
        {/* Category */}
        <div className="entity-chip">
          <div className="entity-icon" aria-hidden="true">
            <Tag size={13} />
          </div>
          <div className="entity-details">
            <span className="entity-label">Статья</span>
            <span className="entity-value" title={parsed.categoryName || 'Хозтовары'}>
              {parsed.categoryName || 'Хозтовары бара'}
            </span>
          </div>
        </div>

        {/* Account */}
        <div className="entity-chip">
          <div className="entity-icon" aria-hidden="true">
            <Wallet size={13} />
          </div>
          <div className="entity-details">
            <span className="entity-label">
              {isIncome ? 'Счёт зачисления' : 'Счёт списания'}
            </span>
            <span className="entity-value" title={parsed.accountName || 'Нал 1 (Касса)'}>
              {parsed.accountName || 'Нал 1 (Касса на площадке)'}
            </span>
          </div>
        </div>

        {/* Event */}
        <div className="entity-chip">
          <div className="entity-icon" aria-hidden="true">
            <Calendar size={13} />
          </div>
          <div className="entity-details">
            <span className="entity-label">Мероприятие</span>
            <span className="entity-value" title={parsed.eventTitle || 'Общие расходы бара'}>
              {parsed.eventTitle || 'Общие расходы бара'}
            </span>
          </div>
        </div>
      </div>

      {/* Confirm Execution Button */}
      <div className="preview-action-row">
        <button
          type="button"
          onClick={onConfirm}
          disabled={isExecuting}
          className="btn-confirm-parsed"
          title="Записать операцию в главную книгу"
        >
          {isExecuting ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              <span>Запись в кассу...</span>
            </>
          ) : (
            <>
              <Check size={16} aria-hidden="true" />
              <span>Подтвердить и записать в кассу (Enter)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
