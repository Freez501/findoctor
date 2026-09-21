/**
 * Truespace — Барный кейтеринг и финансы
 * Events Hook (`src/client/hooks/useEvents.ts`)
 *
 * Provides catering events, active/planned filters, and event title helpers.
 */

import { useMemo } from 'react';
import { CateringEvent } from '../../shared/types.js';
import { useFinance } from '../context/FinanceContext.js';

export interface UseEventsReturn {
  events: CateringEvent[];
  activeEvents: CateringEvent[];
  getEventById: (id: string | null | undefined) => CateringEvent | undefined;
  getEventTitle: (id: string | null | undefined) => string;
  isLoading: boolean;
}

export function useEvents(): UseEventsReturn {
  const { events, isLoading } = useFinance();

  const activeEvents = useMemo(
    () => events.filter((e) => e.status === 'active' || e.status === 'planned'),
    [events]
  );

  const eventMap = useMemo(() => {
    return new Map<string, CateringEvent>(events.map((e) => [e.id, e]));
  }, [events]);

  const getEventById = useMemo(() => {
    return (id: string | null | undefined) => (id ? eventMap.get(id) : undefined);
  }, [eventMap]);

  const getEventTitle = useMemo(() => {
    return (id: string | null | undefined) => {
      if (!id) return 'Общие расходы бара';
      const ev = eventMap.get(id);
      return ev ? ev.title : id;
    };
  }, [eventMap]);

  return {
    events,
    activeEvents,
    getEventById,
    getEventTitle,
    isLoading,
  };
}
