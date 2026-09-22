/**
 * Truespace — Барный кейтеринг и финансы
 * Event Selector Component (`src/client/components/entry/EventSelector.tsx`)
 *
 * Allows binding an operation to an active catering event or choosing
 * unlinked operation via a clean shadcn select dropdown.
 */

import React from 'react';
import { Calendar, MapPin, ChevronDown } from 'lucide-react';
import { CateringEvent } from '../../../shared/types.js';
import { useEvents } from '../../hooks/useEvents.js';
import { formatDateRu } from '../../utils/formatters.js';

interface EventSelectorProps {
  selectedEventId: string | null;
  onSelectEventId: (eventId: string | null) => void;
  isGeneralExpense?: boolean;
  onToggleGeneralExpense?: (isGeneral: boolean) => void;
}

export const EventSelector: React.FC<EventSelectorProps> = ({
  selectedEventId,
  onSelectEventId,
}) => {
  const { activeEvents, events } = useEvents();
  const eventsList: CateringEvent[] = activeEvents.length > 0 ? activeEvents : events;
  const selectedEvent = eventsList.find((e: CateringEvent) => e.id === selectedEventId);

  return (
    <div className="event-selector-container">
      <div className="field-block-label-row">
        <span className="field-block-label">Мероприятие:</span>
        <span className="field-block-hint">Выездной бар</span>
      </div>

      <div className="event-dropdown-wrapper">
        <select
          value={selectedEventId || 'none'}
          onChange={(e) => onSelectEventId(e.target.value === 'none' ? null : e.target.value)}
          className="settings-text-input event-select-input"
          aria-label="Выбор мероприятия"
        >
          <option value="none">Без привязки к ивенту (общие расходы бара)</option>
          {eventsList.map((event: CateringEvent) => (
            <option key={event.id} value={event.id}>
              {event.title} — {formatDateRu(event.eventDate)}
            </option>
          ))}
        </select>
        <ChevronDown size={16} className="event-select-chevron" aria-hidden="true" />
      </div>

      {/* Compact summary pill when event is linked */}
      {selectedEvent && (
        <div className="event-selected-pill animate-fade-in">
          <div className="event-selected-pill-info">
            <span className="event-selected-name">{selectedEvent.title}</span>
            <div className="event-selected-details">
              <span className="event-selected-meta">
                <Calendar size={12} />
                {formatDateRu(selectedEvent.eventDate)}
              </span>
              {selectedEvent.location && (
                <span className="event-selected-meta">
                  <MapPin size={12} />
                  {selectedEvent.location}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

