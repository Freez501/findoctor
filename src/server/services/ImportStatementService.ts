/**
 * Truespace — Барный кейтеринг и финансы
 * Bank Statement & Telegram Text Import Service (`src/server/services/ImportStatementService.ts`)
 *
 * Implements:
 * - Smart parsing of freeform Telegram messages and multi-line expense notes
 * - Universal parsing of bank statement exports (Excel .xlsx, .csv, 1C client-bank text)
 * - Auto-categorization using catering dictionaries (alcohol, staff, ice, logistics, rent)
 * - Matching with active catering events (by title or client name)
 * - Triage marking: flags operations requiring user review (`needsReview: true`)
 */

import * as XLSX from 'xlsx';
import { IFinanceStore } from '../storage/interfaces.js';
import { getStorageInstance } from '../storage/factory.js';
import { ParsedStatementItem, TransactionType } from '../../shared/types.js';
import { CATEGORY_IDS } from '../../shared/constants.js';
import { round2 } from './FinanceService.js';

const RUSSIAN_MONTHS: Record<string, number> = {
  'января': 1, 'янв': 1, 'январь': 1,
  'февраля': 2, 'фев': 2, 'февраль': 2,
  'марта': 3, 'мар': 3, 'март': 3,
  'апреля': 4, 'апр': 4, 'апрель': 4,
  'мая': 5, 'май': 5,
  'июня': 6, 'июн': 6, 'июнь': 6,
  'июля': 7, 'июл': 7, 'июль': 7,
  'августа': 8, 'авг': 8, 'август': 8,
  'сентября': 9, 'сен': 9, 'сентябрь': 9,
  'октября': 10, 'окт': 10, 'октябрь': 10,
  'ноября': 11, 'ноя': 11, 'ноябрь': 11,
  'декабря': 12, 'дек': 12, 'декабрь': 12,
};

export interface ParseStatementOptions {
  targetAccountId: string;
  text?: string;
  fileBuffer?: Buffer;
  fileName?: string;
}

export class ImportStatementService {
  constructor(private store: IFinanceStore = getStorageInstance()) {}

  /**
   * Main entry point: parses statement input from text or binary file into normalized items.
   */
  public async parseStatement(options: ParseStatementOptions): Promise<ParsedStatementItem[]> {
    const events = await this.store.getEvents();
    const categories = await this.store.getCategories();

    let rawItems: Array<{
      dateStr: string;
      amount: number;
      type?: TransactionType;
      description: string;
      counterparty?: string;
    }> = [];

    if (options.fileBuffer && options.fileName) {
      const ext = options.fileName.toLowerCase().split('.').pop() || '';
      if (ext === 'xlsx' || ext === 'xls') {
        rawItems = this.parseExcelBuffer(options.fileBuffer);
      } else if (ext === 'csv' || ext === 'txt') {
        let textContent = options.fileBuffer.toString('utf-8');
        if (textContent.includes('\uFFFD') || textContent.includes('1CClientBankExchange')) {
          try {
            const decoded1251 = new TextDecoder('windows-1251').decode(options.fileBuffer);
            if (!decoded1251.includes('\uFFFD')) {
              textContent = decoded1251;
            }
          } catch {
            // Fallback to utf-8
          }
        }
        rawItems = this.parseCsvOr1CText(textContent);
      }
    } else if (options.text) {
      rawItems = this.parseFreeformText(options.text);
    }

    // Match each raw item with categories and events
    const parsedItems: ParsedStatementItem[] = rawItems.map((raw, idx) => {
      const type: TransactionType = raw.type || (raw.amount < 0 ? 'expense' : 'income');
      const absAmount = round2(Math.abs(raw.amount));
      const fullText = `${raw.description} ${raw.counterparty || ''}`.trim();
      const lower = fullText.toLowerCase();

      // 1. Resolve date to ISO 8601
      const normalizedDate = this.normalizeDate(raw.dateStr);

      // 2. Resolve Category & Review flag
      let matchedCategoryId: string | undefined = undefined;
      let matchedEventId: string | null = null;
      let needsReview = false;

      // Special rule: Transfers / Cash withdrawals / Dividends
      if (
        lower.includes('перевод себе') ||
        lower.includes('переводы себе') ||
        lower.includes('перевод собственных средств') ||
        lower.includes('снятие наличных') ||
        lower.includes('вывод средств') ||
        lower.includes('дивиденд')
      ) {
        matchedCategoryId = this.matchCategory(
          categories,
          [CATEGORY_IDS.DIVIDENDS, CATEGORY_IDS.PERSONAL_WITHDRAWAL, CATEGORY_IDS.TRANSFER_INTERNAL, 'dividends', 'personal_withdrawal', 'cat_dividends'],
          ['дивиденд', 'вывод', 'перевод']
        );
        needsReview = true; // User needs to confirm: dividend or transfer
      } else if (
        lower.includes('шамрай') ||
        lower.includes('лед') ||
        lower.includes('лёд')
      ) {
        matchedCategoryId = 'cat_ice';
      } else if (
        lower.includes('алког') ||
        lower.includes('вино') ||
        lower.includes('джин') ||
        lower.includes('виски') ||
        lower.includes('водк') ||
        lower.includes('пиво') ||
        lower.includes('сидр') ||
        lower.includes('просекк') ||
        lower.includes('шампан') ||
        lower.includes('ast') ||
        lower.includes('аст') ||
        lower.includes('vinicom') ||
        lower.includes('виником') ||
        lower.includes('браво-д') ||
        lower.includes('винлаб') ||
        lower.includes('simplewine') ||
        lower.includes('симпла')
      ) {
        matchedCategoryId = this.matchCategory(
          categories,
          [CATEGORY_IDS.ALCOHOL, 'cat_alcohol', 'alcohol'],
          ['алког', 'напитки']
        );
      } else if (
        lower.includes('метро') ||
        lower.includes('metro') ||
        lower.includes('перекрёсток') ||
        lower.includes('перекресток') ||
        lower.includes('вкусвилл') ||
        lower.includes('овощная лавка') ||
        lower.includes('мята') ||
        lower.includes('фрукт') ||
        lower.includes('лимон') ||
        lower.includes('лайм') ||
        lower.includes('сироп') ||
        lower.includes('монин') ||
        lower.includes('бакалея')
      ) {
        matchedCategoryId = this.matchCategory(
          categories,
          [CATEGORY_IDS.SUPPLIES, 'cat_supplies', 'supplies'],
          ['расходник', 'инвентар']
        );
      } else if (
        lower.includes('бармен') ||
        lower.includes('официант') ||
        lower.includes('персонал') ||
        lower.includes('гонорар') ||
        lower.includes('смена') ||
        lower.includes('зарплат') ||
        lower.includes('голубев') ||
        lower.includes('арбатская')
      ) {
        matchedCategoryId = this.matchCategory(
          categories,
          [CATEGORY_IDS.STAFF, 'cat_staff', 'staff'],
          ['персонал', 'гонорар']
        );
      } else if (
        lower.includes('авиасейлс') ||
        lower.includes('aviasales') ||
        lower.includes('аэрофлот') ||
        lower.includes('aeroflot') ||
        lower.includes('city travel') ||
        lower.includes('купибилет') ||
        lower.includes('такси') ||
        lower.includes('яндекс') ||
        lower.includes('ситимобил') ||
        lower.includes('каршеринг') ||
        lower.includes('парковк') ||
        lower.includes('skolkovo') ||
        lower.includes('бензин') ||
        lower.includes('азс') ||
        lower.includes('лукойл') ||
        lower.includes('доставк') ||
        lower.includes('груз') ||
        lower.includes('логистик')
      ) {
        matchedCategoryId = this.matchCategory(
          categories,
          [CATEGORY_IDS.TRANSPORT, CATEGORY_IDS.LOGISTICS, 'cat_logistics', 'transport', 'logistics'],
          ['транспорт', 'логистик']
        );
      } else if (
        lower.includes('фнс') ||
        lower.includes('казначейств') ||
        lower.includes('налог') ||
        lower.includes('енп') ||
        lower.includes('уфк')
      ) {
        matchedCategoryId = this.matchCategory(
          categories,
          [CATEGORY_IDS.TAXES, 'cat_taxes', 'taxes'],
          ['налог']
        );
      } else if (
        lower.includes('комиссия') ||
        lower.includes('услуги банка') ||
        lower.includes('т-банк') ||
        lower.includes('тбанк') ||
        lower.includes('тинькофф') ||
        lower.includes('сбербанк') ||
        lower.includes('оповещения об операциях') ||
        lower.includes('бухгалтери') ||
        lower.includes('контур') ||
        lower.includes('ру-центр') ||
        lower.includes('ru-center') ||
        lower.includes('рег.ру')
      ) {
        matchedCategoryId = this.matchCategory(
          categories,
          [CATEGORY_IDS.ACCOUNTING, CATEGORY_IDS.OVERHEAD, 'cat_overhead', 'accounting', 'overhead'],
          ['бухгалтер', 'банк', 'операцион']
        );
      } else if (
        lower.includes('аренд') ||
        lower.includes('склад') ||
        lower.includes('помещен')
      ) {
        matchedCategoryId = this.matchCategory(
          categories,
          [CATEGORY_IDS.OVERHEAD, 'cat_rent', 'cat_overhead', 'overhead'],
          ['аренд', 'операцион']
        );
      } else if (
        lower.includes('посуд') ||
        lower.includes('бокал') ||
        lower.includes('стекло') ||
        lower.includes('инвентар') ||
        lower.includes('оборудован') ||
        lower.includes('пономарев')
      ) {
        matchedCategoryId = this.matchCategory(
          categories,
          [CATEGORY_IDS.EQUIPMENT, CATEGORY_IDS.INVENTORY, 'cat_equipment', 'equipment'],
          ['оборудован', 'посуд', 'инвентар']
        );
      } else if (
        lower.includes('предоплат') ||
        lower.includes('аванс') ||
        lower.includes('договор') ||
        lower.includes('оплата по счету') ||
        lower.includes('хинт') ||
        lower.includes('джорни') ||
        lower.includes('дополнительные услуги')
      ) {
        matchedCategoryId = type === 'income'
          ? this.matchCategory(categories, [CATEGORY_IDS.CONTRACT_PREPAYMENT, 'cat_prepayment', 'contract_prepayment'], ['предоплат', 'аванс', 'договор'])
          : this.matchCategory(categories, [CATEGORY_IDS.SUPPLIES, 'cat_supplies', 'supplies'], ['расходник']);
      } else if (lower.includes('финал') || lower.includes('доплат') || lower.includes('остаток')) {
        matchedCategoryId = type === 'income'
          ? this.matchCategory(categories, [CATEGORY_IDS.CONTRACT_FINAL, 'cat_final_payment', 'contract_final'], ['финал', 'доплат'])
          : this.matchCategory(categories, [CATEGORY_IDS.SUPPLIES, 'cat_supplies', 'supplies'], ['расходник']);
      } else if (lower.includes('чай') || lower.includes('чаевые')) {
        matchedCategoryId = this.matchCategory(
          categories,
          [CATEGORY_IDS.TIPS, 'cat_tips', 'tips'],
          ['чаев']
        );
      }

      // Check for event matching in text
      for (const ev of events) {
        const evTitle = ev.title.toLowerCase();
        const evClient = (ev.clientName || '').toLowerCase();
        if (
          lower.includes(evTitle) ||
          (evClient && evClient.length > 3 && lower.includes(evClient))
        ) {
          matchedEventId = ev.id;
          break;
        }
      }

      // If category not confidently found, fallback to uncategorized
      if (!matchedCategoryId) {
        const uncategorizedCat = categories.find((c) => c.id === 'uncategorized');
        matchedCategoryId = uncategorizedCat ? 'uncategorized' : (categories[0]?.id || 'cat_supplies');
        needsReview = true;
      }

      // If it's a catering-specific expense or income but event wasn't found, flag for review
      if (!matchedEventId && type !== 'transfer') {
        // Operational operations without event require review
        needsReview = true;
      }

      return {
        id: `import-row-${idx + 1}-${Date.now()}`,
        date: normalizedDate,
        type,
        amount: absAmount,
        description: raw.description || (raw.counterparty ? `Платеж: ${raw.counterparty}` : 'Операция'),
        counterparty: raw.counterparty,
        categoryId: matchedCategoryId,
        eventId: matchedEventId,
        needsReview,
        selected: true,
      };
    });

    return parsedItems;
  }

  /**
   * Helper to match category by preferred ID or Russian keyword fallback.
   */
  private matchCategory(
    categories: Array<{ id: string; name: string }>,
    preferredIds: string[],
    keywords: string[]
  ): string {
    for (const pid of preferredIds) {
      const found = categories.find((c) => c.id === pid);
      if (found) return found.id;
    }
    for (const kw of keywords) {
      const found = categories.find((c) => c.name.toLowerCase().includes(kw));
      if (found) return found.id;
    }
    return preferredIds[0];
  }

  /**
   * Parses freeform multi-line text (Telegram chat, SMS, bank export blocks like T-Bank).
   */
  public parseFreeformText(text: string): Array<{
    dateStr: string;
    amount: number;
    type?: TransactionType;
    description: string;
    counterparty?: string;
  }> {
    // Strip zero-width spaces, word joiners (\u2060), and BOM inserted by bank web interfaces
    const sanitizedText = text.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '');

    const lines = sanitizedText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const items: Array<{
      dateStr: string;
      amount: number;
      type?: TransactionType;
      description: string;
      counterparty?: string;
    }> = [];

    const defaultYear = 2026;
    let currentDateStr = new Date().toISOString().slice(0, 10);
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // 1. Check if line is a Date Header (e.g. "14 мая", "30 апреля", "12.09.2026")
      const dateHeader = this.tryParseDateHeader(line, defaultYear);
      if (dateHeader) {
        currentDateStr = dateHeader;
        i++;
        continue;
      }

      // 2. Check if this is a Counterparty line followed immediately by an Amount line (T-Bank export block)
      if (i + 1 < lines.length) {
        const nextAmount = this.tryParseAmountLine(lines[i + 1]);
        if (nextAmount) {
          const counterparty = line;
          let details = '';
          if (
            i + 2 < lines.length &&
            !this.tryParseDateHeader(lines[i + 2], defaultYear) &&
            !this.tryParseAmountLine(lines[i + 2])
          ) {
            details = lines[i + 2];
            i += 3;
          } else {
            i += 2;
          }

          const fullDesc = details ? `${counterparty}: ${details}` : counterparty;
          items.push({
            dateStr: currentDateStr,
            amount: nextAmount.amount,
            type: nextAmount.type,
            description: fullDesc,
            counterparty,
          });
          continue;
        }
      }

      // 3. Check if line itself is a standalone Amount line
      const selfAmount = this.tryParseAmountLine(line);
      if (selfAmount) {
        let details = '';
        if (
          i + 1 < lines.length &&
          !this.tryParseDateHeader(lines[i + 1], defaultYear) &&
          !this.tryParseAmountLine(lines[i + 1])
        ) {
          details = lines[i + 1];
          i += 2;
        } else {
          i += 1;
        }

        items.push({
          dateStr: currentDateStr,
          amount: selfAmount.amount,
          type: selfAmount.type,
          description: details || 'Банковская операция',
          counterparty: '',
        });
        continue;
      }

      // 4. Fallback: single-line message (e.g. "12.09 3500 лед для Свадьбы", "+150000 аванс", "-2400 такси")
      const dateMatch = line.match(/\b(\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?|\d{4}-\d{2}-\d{2})\b/);
      let inlineDateStr = '';
      let remaining = line;

      if (dateMatch) {
        inlineDateStr = dateMatch[1];
        remaining = remaining.replace(dateMatch[0], ' ');
      }

      const amountMatch = remaining.match(/([+−–—-]?\s*\d+(?:[\s\u00A0_]\d{3})*(?:[.,]\d+)?)\s*(?:₽|руб|rur)?/i);
      if (amountMatch) {
        const rawAmountStr = amountMatch[1].replace(/[\s\u00A0]/g, '').replace(',', '.');
        const isMinus =
          rawAmountStr.startsWith('−') ||
          rawAmountStr.startsWith('-') ||
          rawAmountStr.startsWith('–') ||
          rawAmountStr.startsWith('—');
        const isPlus = rawAmountStr.startsWith('+');
        const cleanNum = rawAmountStr.replace(/^[+−–—-\s]+/, '');
        const num = parseFloat(cleanNum);

        if (!isNaN(num) && num > 0) {
          const type: TransactionType | undefined = isMinus ? 'expense' : isPlus ? 'income' : undefined;
          const memo = remaining.replace(amountMatch[0], ' ').replace(/\s+/g, ' ').trim();

          items.push({
            dateStr: inlineDateStr || currentDateStr,
            amount: num,
            type,
            description: memo || 'Операция из сообщения',
          });
        }
      }

      i++;
    }

    return items;
  }

  /**
   * Parses Excel binary buffer (.xlsx / .xls).
   */
  public parseExcelBuffer(buffer: Buffer): Array<{
    dateStr: string;
    amount: number;
    type?: TransactionType;
    description: string;
    counterparty?: string;
  }> {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return [];

    const sheet = workbook.Sheets[firstSheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    return this.parseTabularRows(rows);
  }

  /**
   * Parses CSV or 1C Client-Bank text.
   */
  public parseCsvOr1CText(text: string): Array<{
    dateStr: string;
    amount: number;
    type?: TransactionType;
    description: string;
    counterparty?: string;
  }> {
    // Check if it's 1C Client-Bank text format (1CClientBankExchange)
    if (text.includes('1CClientBankExchange') || text.includes('СекцияДокумент=Платежное поручение')) {
      return this.parse1CClientBank(text);
    }

    // Otherwise parse standard delimited CSV / TSV
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const delimiter = text.includes(';') ? ';' : text.includes('\t') ? '\t' : ',';
    const rows = lines.map((l) => l.split(delimiter).map((c) => c.replace(/^["']|["']$/g, '').trim()));

    return this.parseTabularRows(rows);
  }

  /**
   * Parses standard 1C Client-Bank export format.
   */
  private parse1CClientBank(text: string): Array<{
    dateStr: string;
    amount: number;
    type?: TransactionType;
    description: string;
    counterparty?: string;
  }> {
    const items: Array<{
      dateStr: string;
      amount: number;
      type?: TransactionType;
      description: string;
      counterparty?: string;
    }> = [];

    const sections = text.split('СекцияДокумент=');
    for (let i = 1; i < sections.length; i++) {
      const section = sections[i];
      const dateMatch = section.match(/Дата(?:Списано|Поступило|Документа)?=([^\r\n]+)/i);
      const amountMatch = section.match(/Сумма=([^\r\n]+)/i);
      const purposeMatch = section.match(/НазначениеПлатежа=([^\r\n]+)/i);
      const payerMatch = section.match(/Плательщик1?=([^\r\n]+)/i);
      const receiverMatch = section.match(/Получатель1?=([^\r\n]+)/i);

      if (amountMatch) {
        const amt = parseFloat(amountMatch[1].replace(/\s+/g, '').replace(',', '.'));
        if (!isNaN(amt) && amt > 0) {
          const isIncome = section.includes('ДатаПоступило=');
          items.push({
            dateStr: dateMatch ? dateMatch[1].trim() : new Date().toISOString().slice(0, 10),
            amount: isIncome ? amt : -amt,
            type: isIncome ? 'income' : 'expense',
            description: purposeMatch ? purposeMatch[1].trim() : 'Банковский платёж',
            counterparty: isIncome ? (payerMatch ? payerMatch[1].trim() : '') : (receiverMatch ? receiverMatch[1].trim() : ''),
          });
        }
      }
    }

    return items;
  }

  /**
   * Universal tabular rows parser with fuzzy header detection.
   */
  private parseTabularRows(rows: any[][]): Array<{
    dateStr: string;
    amount: number;
    type?: TransactionType;
    description: string;
    counterparty?: string;
  }> {
    if (rows.length < 2) return [];

    // Find header row
    let headerIdx = -1;
    let colDate = -1;
    let colAmount = -1;
    let colDebit = -1;
    let colCredit = -1;
    let colPurpose = -1;
    let colCounterparty = -1;

    for (let r = 0; r < Math.min(10, rows.length); r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;

      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '').toLowerCase().trim();
        if (val.includes('дата') || val === 'date') colDate = c;
        if (val === 'сумма' || val === 'amount' || val.includes('сумма операции')) colAmount = c;
        if (val.includes('дебет') || val.includes('списание') || val.includes('расход')) colDebit = c;
        if (val.includes('кредит') || val.includes('поступление') || val.includes('доход')) colCredit = c;
        if (val.includes('назначен') || val.includes('описани') || val.includes('комментар') || val === 'memo') colPurpose = c;
        if (val.includes('контрагент') || val.includes('получатель') || val.includes('плательщик')) colCounterparty = c;
      }

      if (colDate !== -1 && (colAmount !== -1 || (colDebit !== -1 && colCredit !== -1))) {
        headerIdx = r;
        break;
      }
    }

    // If no explicit header found, fallback to standard column assumptions: [Date, Amount, Purpose, Counterparty]
    if (headerIdx === -1) {
      headerIdx = 0;
      colDate = 0;
      colAmount = 1;
      colPurpose = 2;
    }

    const items: Array<{
      dateStr: string;
      amount: number;
      type?: TransactionType;
      description: string;
      counterparty?: string;
    }> = [];

    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || !Array.isArray(row) || row.length === 0) continue;

      const rawDate = row[colDate];
      if (!rawDate) continue;

      let amt = 0;
      let type: TransactionType | undefined = undefined;

      if (colAmount !== -1 && row[colAmount] !== undefined) {
        const parsed = this.parseNumeric(row[colAmount]);
        if (parsed !== null) {
          amt = parsed;
        }
      } else if (colDebit !== -1 && colCredit !== -1) {
        const debit = this.parseNumeric(row[colDebit]);
        const credit = this.parseNumeric(row[colCredit]);
        if (credit && credit > 0) {
          amt = credit;
          type = 'income';
        } else if (debit && debit > 0) {
          amt = -debit;
          type = 'expense';
        }
      }

      if (amt === 0) continue;

      const desc = colPurpose !== -1 && row[colPurpose] ? String(row[colPurpose]).trim() : '';
      const counterparty = colCounterparty !== -1 && row[colCounterparty] ? String(row[colCounterparty]).trim() : '';

      items.push({
        dateStr: String(rawDate).trim(),
        amount: amt,
        type,
        description: desc || counterparty || 'Банковская операция',
        counterparty,
      });
    }

    return items;
  }

  private tryParseDateHeader(line: string, defaultYear = 2026): string | null {
    const clean = line.trim().toLowerCase().replace(/[,•]/g, ' ');
    // Match "14 мая", "14 мая 2026", "1 мая"
    const m = clean.match(/^(\d{1,2})\s+([а-яё]+)(?:\s+(\d{4}))?$/);
    if (m) {
      const day = parseInt(m[1], 10);
      const monthWord = m[2];
      const month = RUSSIAN_MONTHS[monthWord];
      if (month && day >= 1 && day <= 31) {
        const year = m[3] ? parseInt(m[3], 10) : defaultYear;
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }

    // Match "14.05", "14.05.2026", "14/05/2026"
    const mNum = clean.match(/^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?$/);
    if (mNum) {
      const day = parseInt(mNum[1], 10);
      const month = parseInt(mNum[2], 10);
      let year = mNum[3] ? parseInt(mNum[3], 10) : defaultYear;
      if (year < 100) year += 2000;
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }

    // Match "2026-05-14"
    const mIso = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (mIso) {
      return `${mIso[1]}-${mIso[2]}-${mIso[3]}`;
    }

    return null;
  }

  private tryParseAmountLine(line: string): { amount: number; type: TransactionType } | null {
    const clean = line.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').trim();
    // Matches "+19 210 ₽", "−5 390,7 ₽", "-29 ₽", "500 ₽", "19210-00", "+ 150000"
    const m = clean.match(/^([+−–—-]?)\s*([\d\s\u00A0]+(?:[.,]\d{1,2})?)\s*(?:₽|руб\.?|р\.?|rur|rub)?$/i);
    if (m) {
      const signChar = m[1];
      const numStr = m[2].replace(/[\s\u00A0]/g, '').replace(',', '.');
      const val = parseFloat(numStr);
      if (!isNaN(val) && val > 0) {
        const isMinus = signChar === '−' || signChar === '-' || signChar === '–' || signChar === '—';
        const type: TransactionType = isMinus ? 'expense' : 'income';
        return { amount: val, type };
      }
    }
    return null;
  }

  private parseNumeric(val: any): number | null {
    if (val === undefined || val === null || val === '') return null;
    if (typeof val === 'number') return val;
    const str = String(val).replace(/\s+/g, '').replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  }

  private normalizeDate(raw: string): string {
    if (!raw) return new Date().toISOString();

    const trimmed = raw.trim();

    // Check date header format e.g. "14 мая"
    const parsedHeader = this.tryParseDateHeader(trimmed);
    if (parsedHeader) {
      return `${parsedHeader}T12:00:00.000Z`;
    }

    // Excel serial number date
    if (/^\d{5}$/.test(trimmed)) {
      const serial = parseInt(trimmed, 10);
      const utcDays = Math.floor(serial - 25569);
      const date = new Date(utcDays * 86400 * 1000);
      return date.toISOString();
    }

    // Format: DD.MM or DD.MM.YYYY
    const ddmmyyyy = trimmed.match(/^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/);
    if (ddmmyyyy) {
      const day = ddmmyyyy[1].padStart(2, '0');
      const month = ddmmyyyy[2].padStart(2, '0');
      let year = ddmmyyyy[3];
      if (!year) {
        year = String(new Date().getFullYear());
      } else if (year.length === 2) {
        year = `20${year}`;
      }
      return `${year}-${month}-${day}T12:00:00.000Z`;
    }

    // Format: YYYY-MM-DD
    const yyyymmdd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (yyyymmdd) {
      return `${yyyymmdd[1]}-${yyyymmdd[2]}-${yyyymmdd[3]}T12:00:00.000Z`;
    }

    const parsed = Date.parse(trimmed);
    return !isNaN(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
  }
}
