/**
 * Truespace — Барный кейтеринг и финансы
 * Fast Command & Natural Language Parser Service (`src/server/services/ParserService.ts`)
 *
 * Implements:
 * - Natural language parsing of catering operations ("3500 лед Корпоратив Т-Банк", "-1500 такси нал1", etc.)
 * - Extraction of amount (with space/comma/negative sign support)
 * - Automatic detection of transaction type (expense vs income)
 * - Detection of catering categories and events
 * - Resolution of financial account (with default fallback to 'cash_1' "Нал 1")
 * - High confidence scoring (>= 0.8)
 */

import { ParsedCommand } from '../../shared/types.js';
import { round2 } from './FinanceService.js';

export interface ParseOptions {
  defaultAccountId?: string;
  defaultEventId?: string | null;
}

export class ParserService {
  /**
   * Parses freeform natural language text into a structured financial command.
   * Throws an Error with a clear message if text is empty or lacks a numeric amount.
   */
  public parse(rawText: string, options?: ParseOptions): ParsedCommand {
    if (!rawText || typeof rawText !== 'string') {
      throw new Error('Пустая команда');
    }

    const trimmed = rawText.trim();
    if (trimmed === '') {
      throw new Error('Пустая команда');
    }

    // 1. Extract amount: numbers with optional spaces/underscores, comma/period decimals, optional negative sign
    const amountMatch = trimmed.match(/-?\d+(?:[\s_]\d{3})*(?:[.,]\d+)?/);
    if (!amountMatch) {
      throw new Error('В команде не указана сумма');
    }

    const rawNumStr = amountMatch[0].replace(/[\s_]/g, '').replace(',', '.');
    const parsedNum = parseFloat(rawNumStr);
    if (isNaN(parsedNum)) {
      throw new Error('В команде не указана сумма');
    }

    const amount = round2(Math.abs(parsedNum));
    if (amount <= 0) {
      throw new Error('Сумма должна быть больше нуля');
    }

    const isExplicitNegative = parsedNum < 0 || trimmed.startsWith('-');
    const lower = trimmed.toLowerCase();

    // 2. Determine transaction type (expense vs income)
    let type: 'income' | 'expense' = 'expense';
    if (
      !isExplicitNegative &&
      (lower.includes('предоплата') ||
        lower.includes('доплата') ||
        lower.includes('аванс') ||
        lower.includes('приход') ||
        lower.includes('доход') ||
        lower.includes('чаевые') ||
        lower.includes('чай') ||
        lower.includes('получено') ||
        lower.includes('+'))
    ) {
      type = 'income';
    }

    // 3. Determine category
    let categoryId = type === 'income' ? 'cat_prepayment' : 'cat_supplies';
    let categoryName = type === 'income' ? 'Предоплата по договору' : 'Хозтовары бара';

    if (
      lower.includes('лед') ||
      lower.includes('лёд') ||
      lower.includes('мята') ||
      lower.includes('фрукт') ||
      lower.includes('лимон') ||
      lower.includes('лайм') ||
      lower.includes('ягод') ||
      lower.includes('сироп') ||
      lower.includes('сок')
    ) {
      categoryId = 'cat_ice';
      categoryName = 'Лёд и расходники';
    } else if (
      lower.includes('алког') ||
      lower.includes('алко') ||
      lower.includes('джин') ||
      lower.includes('виски') ||
      lower.includes('водк') ||
      lower.includes('ром') ||
      lower.includes('текил') ||
      lower.includes('вин') ||
      lower.includes('просекк') ||
      lower.includes('шампанск') ||
      lower.includes('пив') ||
      lower.includes('тоник') ||
      lower.includes('ликер') ||
      lower.includes('бухло')
    ) {
      categoryId = 'cat_alcohol';
      categoryName = 'Алкоголь';
    } else if (
      lower.includes('бармен') ||
      lower.includes('персонал') ||
      lower.includes('смен') ||
      lower.includes('гонорар') ||
      lower.includes('зарплат') ||
      lower.includes('ставка') ||
      lower.includes('грузчик') ||
      lower.includes('барбэк')
    ) {
      categoryId = 'cat_staff';
      categoryName = 'Персонал (бармены/официанты)';
    } else if (
      lower.includes('такси') ||
      lower.includes('логистик') ||
      lower.includes('посуд') ||
      lower.includes('бокал') ||
      lower.includes('доставк') ||
      lower.includes('газель') ||
      lower.includes('каршеринг') ||
      lower.includes('бензин')
    ) {
      categoryId = 'cat_logistics';
      categoryName = 'Логистика и аренда посуды';
    } else if (lower.includes('предоплат') || lower.includes('аванс') || lower.includes('договор')) {
      categoryId = 'cat_prepayment';
      categoryName = 'Предоплата по договору';
    } else if (lower.includes('доплат') || lower.includes('финал') || lower.includes('остаток')) {
      categoryId = 'cat_final_payment';
      categoryName = 'Доплата / Финальный расчет';
    } else if (lower.includes('чаев') || lower.includes('чай')) {
      categoryId = 'cat_tips';
      categoryName = 'Чаевые команды';
    } else if (lower.includes('продаж') || lower.includes('шот') || lower.includes('коктейл')) {
      categoryId = 'cat_bar_sales';
      categoryName = 'Продажи на стойке';
    }

    // 4. Determine event
    let eventId: string | null = options?.defaultEventId ?? null;
    let eventTitle: string | null = null;

    if (
      lower.includes('свадьб') ||
      lower.includes('анн') ||
      lower.includes('дмитри') ||
      lower.includes('артём') ||
      lower.includes('артем') ||
      lower.includes('wedding')
    ) {
      eventId = 'event_wedding';
      eventTitle = 'Свадьба Анны и Дмитрия';
    } else if (
      lower.includes('корпорат') ||
      lower.includes('т-банк') ||
      lower.includes('techcorp') ||
      lower.includes('нексатек') ||
      lower.includes('nexa') ||
      lower.includes('corporate')
    ) {
      eventId = 'event_corporate';
      eventTitle = 'Корпоратив IT-компании TechCorp';
    }

    // 5. Determine account (priority: explicit accounts, defaulting to cash_1)
    let accountId = options?.defaultAccountId || 'cash_1';
    let accountName = 'Нал 1 (Касса на площадке)';

    if (lower.includes('нал 2') || lower.includes('нал2') || lower.includes('сейф') || lower.includes('владелец')) {
      accountId = 'cash_2';
      accountName = 'Нал 2 (Сейф / Владелец)';
    } else if (lower.includes('безнал 1') || lower.includes('безнал1') || lower.includes('р/с') || lower.includes('рс') || lower.includes('счет') || lower.includes('счёт')) {
      accountId = 'bank_1';
      accountName = 'Безнал 1 (Основной р/с)';
    } else if (lower.includes('безнал 2') || lower.includes('безнал2') || lower.includes('эквайринг') || lower.includes('терминал')) {
      accountId = 'bank_2';
      accountName = 'Безнал 2 (Резервный р/с / Эквайринг)';
    } else if (
      lower.includes('перевод') ||
      lower.includes('сбп') ||
      lower.includes('карт') ||
      lower.includes('тинькофф') ||
      lower.includes('тинькоф') ||
      lower.includes('т-банк') ||
      lower.includes('тбанк') ||
      lower.includes('сбер')
    ) {
      accountId = 'card_sbp';
      accountName = 'Переводы (Личная карта)';
    } else if (lower.includes('нал 1') || lower.includes('нал1') || lower.includes('касс') || lower.includes('площадк') || lower.includes('бар')) {
      accountId = 'cash_1';
      accountName = 'Нал 1 (Касса на площадке)';
    }

    // 6. Confidence calculation
    let confidence = 0.85;
    if (amount > 0) confidence += 0.05;
    if (eventId !== null) confidence += 0.03;
    if (categoryId !== 'cat_supplies' && categoryId !== 'cat_prepayment') confidence += 0.02;
    confidence = Math.min(round2(confidence), 0.98);

    return {
      amount,
      type,
      categoryId,
      categoryName,
      eventId,
      eventTitle,
      accountId,
      accountName,
      description: trimmed,
      rawText: trimmed,
      confidence,
      isGeneralExpense: eventId === null,
    };
  }
}
