/**
 * Truespace — Барный кейтеринг и финансы
 * Telegram Command Chips Component (`src/client/components/telegram/CommandChips.tsx`)
 *
 * Clickable preset scenario chips demonstrating realistic on-site bar operations.
 */

import React from 'react';

export interface ScenarioPreset {
  id: string;
  label: string;
  command: string;
  hint: string;
}

export const SAMPLE_PRESETS: readonly ScenarioPreset[] = [
  {
    id: 'ice_corporate',
    label: '🧊 3500 лёд Корпоратив',
    command: '3500 лед Корпоратив Т-Банк',
    hint: 'Расход 3 500 ₽ • Лёд • Корпоратив • Переводы/СБП',
  },
  {
    id: 'prepay_wedding',
    label: '💍 50 000 предоплата Свадьба',
    command: '50000 предоплата Свадьба',
    hint: 'Доход 50 000 ₽ • Предоплата • Свадьба • Нал 1',
  },
  {
    id: 'taxi_bar',
    label: '🚕 -1500 такси нал1',
    command: '-1500 такси нал1',
    hint: 'Расход 1 500 ₽ • Логистика • Общие расходы • Нал 1',
  },
  {
    id: 'gin_safe',
    label: '🍸 12 000 джин нал2',
    command: '12000 джин нал2',
    hint: 'Расход 12 000 ₽ • Алкоголь • Сейф Нал 2',
  },
  {
    id: 'staff_wedding',
    label: '👔 8000 ставка бармена',
    command: '8000 ставка бармена Свадьба нал2',
    hint: 'Расход 8 000 ₽ • Персонал • Свадьба • Нал 2',
  },
  {
    id: 'tips_bar',
    label: '💰 2500 чай бар нал1',
    command: '2500 чай бар нал1',
    hint: 'Доход 2 500 ₽ • Чаевые • Касса Нал 1',
  },
];

interface CommandChipsProps {
  onSelect: (commandText: string) => void;
  activeCommand?: string;
}

export const CommandChips: React.FC<CommandChipsProps> = ({ onSelect, activeCommand }) => {
  return (
    <div className="command-chips-scrollable" role="region" aria-label="Готовые сценарии ввода">
      <div className="chips-track">
        {SAMPLE_PRESETS.map((preset) => {
          const isSelected = activeCommand?.trim() === preset.command;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelect(preset.command)}
              className={`preset-chip ${isSelected ? 'preset-chip-active' : ''}`}
              title={`${preset.command} (${preset.hint})`}
            >
              <span className="preset-label">{preset.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
