/**
 * Truespace — Барный кейтеринг и финансы
 * Event Selector & General Bar Overhead Toggle (`src/client/components/entry/EventSelector.tsx`)
 *
 * Allows binding an operation to an active/planned catering event or toggling
 * "Общие расходы бара" (overhead without event attribution).
 */

import React from 'react';
import { Calendar, Check } from 'lucide-react';
import { useEvents } from '../../hooks/useEvents.js';
import { formatDateRu } from '../../utils/formatters.js';

interface EventSelectorProps {
  selectedEventId: string | null;
  onSelectEventId: (eventId: string | null) => void;
  isGeneralExpense: boolean;
  onToggleGeneralExpense: (isGeneral: boolean) => void;
}

export const EventSelector: React.FC<EventSelectorProps> = ({
  selectedEventId,
  onSelectEventId,
  isGeneralExpense,
  onToggleGeneralExpense,
}) => {
  const { activeEvents } = useEvents();

  const handleToggle = (checked: boolean) => {
    onToggleGeneralExpense(checked);
    if (checked) {
      onSelectEventId(null);
    } else if (activeEvents.length > 0 && !selectedEventId) {
      onSelectEventId(activeEvents[0].id);
    }
  };

  return (
    <div className="event-selector-container">
      {/* General Bar Overhead Toggle Switch */}
      <div className="general-expense-toggle-row">
        <label className="general-toggle-label">
          <input
            type="checkbox"
            checked={isGeneralExpense}
            onChange={(e) => handleToggle(e.target.checked)}
            className="general-toggle-checkbox"
          />
          <div className="toggle-custom-slider" aria-hidden="true" />
          <div className="toggle-text-block">
            <span className="toggle-main-title">Общие расходы бара</span>
            <span className="toggle-subtitle">
              Вне конкретного ивента (аренда склада, инвентарь, хозтовары)
            </span>
          </div>
        </label>
      </div>

      {/* Events List (visible when NOT general bar expense) */}
      {!isGeneralExpense && (
        <div className="events-selection-block animate-fade-in">
          <span className="events-list-label">Выберите мероприятие:</span>

          <div className="events-chips-list" role="radiogroup" aria-label="Мероприятия кейтеринга">
            {activeEvents.map((event) => {
              const isSelected = selectedEventId === event.id;

              return (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => onSelectEventId(event.id)}
                  className={`event-chip ${isSelected ? 'event-chip-selected' : ''}`}
                  role="radio"
                  aria-checked={isSelected}
                  title={`${event.title} (${formatDateRu(event.eventDate)})`}
                >
                  <Calendar size={13} className="event-chip-icon" aria-hidden="true" />
                  <span className="event-chip-title">{event.title}</span>
                  <span className="event-chip-date">{formatDateRu(event.eventDate)}</span>
                  {isSelected && <Check size={12} className="event-chip-check" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
