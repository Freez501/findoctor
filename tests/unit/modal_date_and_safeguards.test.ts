/**
 * Truespace — QuickEntryModal Date Selection & TransactionEditModal Safeguards Unit Tests
 * `tests/unit/modal_date_and_safeguards.test.ts`
 */

import { describe, it, expect } from 'vitest';
import { Transaction } from '../../src/shared/types.js';
import { translateApiError } from '../../src/client/api/errors.js';

const pad2 = (n: number) => String(n).padStart(2, '0');

const getTodayDateStr = (refDate = new Date()) => {
  return `${refDate.getFullYear()}-${pad2(refDate.getMonth() + 1)}-${pad2(refDate.getDate())}`;
};

const getYesterdayDateStr = (refDate = new Date()) => {
  const d = new Date(refDate);
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const getIsoDateForSelectedDay = (dateStr: string, refDate = new Date()) => {
  if (!dateStr) return refDate.toISOString();
  const todayStr = getTodayDateStr(refDate);
  if (dateStr === todayStr) {
    return refDate.toISOString();
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  const targetDate = new Date(y, m - 1, d, refDate.getHours(), refDate.getMinutes(), refDate.getSeconds());
  return targetDate.toISOString();
};

describe('QuickEntryModal Date Selection Logic', () => {
  it('defaults to today date string YYYY-MM-DD', () => {
    const today = getTodayDateStr();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const now = new Date();
    expect(today).toBe(`${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`);
  });

  it('computes yesterday date string correctly even across month boundaries', () => {
    const firstOfMarch = new Date(2026, 2, 1, 10, 0, 0); // March 1st 2026
    const yesterday = getYesterdayDateStr(firstOfMarch);
    expect(yesterday).toBe('2026-02-28');
  });

  it('returns current time ISO when today is selected', () => {
    const fixedNow = new Date('2026-10-04T14:30:00.000Z');
    const todayStr = getTodayDateStr(fixedNow);
    const iso = getIsoDateForSelectedDay(todayStr, fixedNow);
    expect(iso).toBe(fixedNow.toISOString());
  });

  it('produces an accurate ISO string for yesterday or custom historical dates', () => {
    const fixedNow = new Date('2026-10-04T14:30:00.000Z');
    const customDate = '2026-09-15';
    const iso = getIsoDateForSelectedDay(customDate, fixedNow);
    const parsed = new Date(iso);
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(8); // September = 8
    expect(parsed.getDate()).toBe(15);
  });

  it('detects isDirty state in QuickEntryModal when amount, custom date, or description is set', () => {
    const todayStr = getTodayDateStr();
    const computeQuickEntryDirty = (amount: number, selectedDate: string, description: string) => {
      return amount > 0 || selectedDate !== todayStr || description.trim() !== '';
    };

    // Pristine: amount 0, today, empty description
    expect(computeQuickEntryDirty(0, todayStr, '')).toBe(false);

    // Dirty: amount entered
    expect(computeQuickEntryDirty(1500, todayStr, '')).toBe(true);

    // Dirty: date changed to yesterday
    expect(computeQuickEntryDirty(0, getYesterdayDateStr(), '')).toBe(true);

    // Dirty: memo entered
    expect(computeQuickEntryDirty(0, todayStr, '10 мешков льда')).toBe(true);
  });
});

describe('TransactionEditModal Safeguards & isDirty Logic', () => {
  const sampleTx: Transaction = {
    id: 'tx-test-1',
    type: 'expense',
    amount: 3500,
    fromAccountId: 'cash_1',
    toAccountId: null,
    categoryId: 'cat_ice',
    eventId: 'event_wedding',
    partnerId: null,
    description: 'Лёд для коктейлей',
    transactionDate: '2026-09-20T12:00:00.000Z',
    isDeleted: false,
  };

  const getInitialDateTimeStr = (txDate: string) => {
    const d = new Date(txDate);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  };

  const checkIsDirty = (
    tx: Transaction,
    current: {
      type: string;
      amount: number;
      fromAccountId: string;
      toAccountId: string;
      categoryId: string;
      eventId: string;
      partnerId: string;
      description: string;
      dateTimeStr: string;
      initialDateTimeStr: string;
    }
  ) => {
    return Boolean(
      current.type !== tx.type ||
      current.amount !== tx.amount ||
      current.fromAccountId !== (tx.fromAccountId || '') ||
      current.toAccountId !== (tx.toAccountId || '') ||
      current.categoryId !== (tx.categoryId || '') ||
      current.eventId !== (tx.eventId || 'general') ||
      current.partnerId !== (tx.partnerId || '') ||
      current.description !== (tx.description || '') ||
      current.dateTimeStr !== current.initialDateTimeStr
    );
  };

  it('is NOT dirty when modal is freshly opened without edits', () => {
    const initDate = getInitialDateTimeStr(sampleTx.transactionDate);
    const pristine = {
      type: sampleTx.type,
      amount: sampleTx.amount,
      fromAccountId: sampleTx.fromAccountId || '',
      toAccountId: sampleTx.toAccountId || '',
      categoryId: sampleTx.categoryId || '',
      eventId: sampleTx.eventId || 'general',
      partnerId: sampleTx.partnerId || '',
      description: sampleTx.description || '',
      dateTimeStr: initDate,
      initialDateTimeStr: initDate,
    };
    expect(checkIsDirty(sampleTx, pristine)).toBe(false);
  });

  it('detects isDirty when date/time is modified (prevents accidental close on click outside)', () => {
    const initDate = getInitialDateTimeStr(sampleTx.transactionDate);
    const dateModified = {
      type: sampleTx.type,
      amount: sampleTx.amount,
      fromAccountId: sampleTx.fromAccountId || '',
      toAccountId: sampleTx.toAccountId || '',
      categoryId: sampleTx.categoryId || '',
      eventId: sampleTx.eventId || 'general',
      partnerId: sampleTx.partnerId || '',
      description: sampleTx.description || '',
      dateTimeStr: '2026-09-22T15:30', // changed!
      initialDateTimeStr: initDate,
    };
    expect(checkIsDirty(sampleTx, dateModified)).toBe(true);
  });

  it('detects isDirty when amount, category, or event is modified', () => {
    const initDate = getInitialDateTimeStr(sampleTx.transactionDate);
    const base = {
      type: sampleTx.type,
      amount: sampleTx.amount,
      fromAccountId: sampleTx.fromAccountId || '',
      toAccountId: sampleTx.toAccountId || '',
      categoryId: sampleTx.categoryId || '',
      eventId: sampleTx.eventId || 'general',
      partnerId: sampleTx.partnerId || '',
      description: sampleTx.description || '',
      dateTimeStr: initDate,
      initialDateTimeStr: initDate,
    };

    expect(checkIsDirty(sampleTx, { ...base, amount: 4000 })).toBe(true);
    expect(checkIsDirty(sampleTx, { ...base, categoryId: 'cat_alcohol' })).toBe(true);
    expect(checkIsDirty(sampleTx, { ...base, eventId: 'event_corporate' })).toBe(true);
    expect(checkIsDirty(sampleTx, { ...base, description: 'Другой комментарий' })).toBe(true);
    expect(checkIsDirty(sampleTx, { ...base, fromAccountId: 'cash_2' })).toBe(true);
  });
});

describe('QuickEntryModal Account Validation & Error Highlighting', () => {
  const companyAccounts = [
    { id: 'acc_bar_1', name: 'Нал 1 (Касса на площадке)' },
    { id: 'acc_vault_2', name: 'Нал 2 (Сейф / Владелец)' },
    { id: 'acc_bank_3', name: 'Безнал 1 (Основной р/с)' },
  ];

  it('detects unselected or invalid account for income operations', () => {
    const validateIncome = (toAccountId: string | null, accounts: typeof companyAccounts) => {
      const isValid = Boolean(toAccountId && accounts.some((a) => a.id === toAccountId));
      if (!isValid) {
        return {
          valid: false,
          error: 'Пожалуйста, выберите счёт зачисления: укажите, куда поступили деньги.',
          highlight: 'toAccount',
        };
      }
      return { valid: true, error: null, highlight: null };
    };

    // Case 1: toAccountId is null
    expect(validateIncome(null, companyAccounts)).toEqual({
      valid: false,
      error: 'Пожалуйста, выберите счёт зачисления: укажите, куда поступили деньги.',
      highlight: 'toAccount',
    });

    // Case 2: toAccountId is zombie 'cash_2' not in company accounts
    expect(validateIncome('cash_2', companyAccounts)).toEqual({
      valid: false,
      error: 'Пожалуйста, выберите счёт зачисления: укажите, куда поступили деньги.',
      highlight: 'toAccount',
    });

    // Case 3: toAccountId is valid account
    expect(validateIncome('acc_bank_3', companyAccounts)).toEqual({
      valid: true,
      error: null,
      highlight: null,
    });
  });

  it('detects unselected or invalid account for expense operations', () => {
    const validateExpense = (fromAccountId: string | null, accounts: typeof companyAccounts) => {
      const isValid = Boolean(fromAccountId && accounts.some((a) => a.id === fromAccountId));
      if (!isValid) {
        return {
          valid: false,
          error: 'Пожалуйста, выберите счёт списания: укажите, откуда оплачено.',
          highlight: 'fromAccount',
        };
      }
      return { valid: true, error: null, highlight: null };
    };

    // Null account
    expect(validateExpense(null, companyAccounts)).toEqual({
      valid: false,
      error: 'Пожалуйста, выберите счёт списания: укажите, откуда оплачено.',
      highlight: 'fromAccount',
    });

    // Valid account
    expect(validateExpense('acc_bar_1', companyAccounts)).toEqual({
      valid: true,
      error: null,
      highlight: null,
    });
  });

  it('translates server missing account error to friendly Russian hint with action directive', () => {
    // Server says "Счёт cash_2 не найден"
    const translated = translateApiError(404, 'Счёт cash_2 не найден');
    expect(translated).toBe('Счёт не выбран или не найден. Пожалуйста, нажмите на один из доступных счетов в списке выше.');

    // Server says English "account not found"
    const translatedEn = translateApiError(404, 'account acc_xyz not found');
    expect(translatedEn).toBe('Счёт не выбран или не найден. Пожалуйста, нажмите на один из доступных счетов в списке выше.');

    // Generic 404 does not mention account
    const genericNotFound = translateApiError(404, 'Запрошенная операция не найдена');
    expect(genericNotFound).toBe('Запрошенная запись не найдена или уже была удалена.');
  });
});
