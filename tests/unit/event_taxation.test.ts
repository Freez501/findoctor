import { describe, it, expect } from 'vitest';
import { validateCreateEventDTO } from '../../src/shared/dto.js';
import { InMemoryStore } from '../../src/server/storage/InMemoryStore.js';
import { CateringEvent } from '../../src/shared/types.js';

describe('Event Taxation & Contracts Suite', () => {
  it('validates and preserves isTaxable: false, taxRate, and legalEntity in DTO', () => {
    const payload = {
      title: 'Частный день рождения',
      eventDate: '2026-11-15',
      status: 'planned' as const,
      isTaxable: false,
      taxRate: 10,
      legalEntity: 'ИП Смирнов',
    };

    const res = validateCreateEventDTO(payload);
    expect(res.valid).toBe(true);
    expect(res.data?.isTaxable).toBe(false);
    expect(res.data?.taxRate).toBe(10);
    expect(res.data?.legalEntity).toBe('ИП Смирнов');
  });

  it('stores and retrieves private (non-taxable) event in InMemoryStore', async () => {
    const store = new InMemoryStore();
    const event = await store.createEvent({
      title: 'Закрытый банкет',
      eventDate: '2026-11-20',
      contractAmount: 150000,
      isTaxable: false,
    });

    expect(event.id).toBeDefined();
    expect(event.isTaxable).toBe(false);

    const retrieved = await store.getEventById(event.id);
    expect(retrieved?.isTaxable).toBe(false);
  });

  it('correctly filters taxable vs non-taxable events', () => {
    const events: Partial<CateringEvent>[] = [
      { id: '1', title: 'Корпоратив 1', isTaxable: true },
      { id: '2', title: 'Свадьба по договору', isTaxable: undefined }, // default taxable
      { id: '3', title: 'Частная вечеринка', isTaxable: false },
    ];

    const taxable = events.filter((e) => e.isTaxable !== false);
    const nonTaxable = events.filter((e) => e.isTaxable === false);

    expect(taxable.map((e) => e.id)).toEqual(['1', '2']);
    expect(nonTaxable.map((e) => e.id)).toEqual(['3']);
  });
});
