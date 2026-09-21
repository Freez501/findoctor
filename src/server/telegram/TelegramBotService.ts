/**
 * Truespace — Барный кейтеринг и финансы
 * Telegram Bot Service (`src/server/telegram/TelegramBotService.ts`)
 *
 * Implements:
 * - Status reporting for Telegram Bot & Web Simulator
 * - Safe mock mode fallback when BOT_TOKEN is absent (simulator-ready out of the box)
 * - Command execution directly into ledger with automatic [Telegram] audit trail
 * - Live update timestamp tracking
 */

import { BotStatus, ParsedCommand } from '../../shared/types.js';
import { FinanceService, CreateTransactionResult } from '../services/FinanceService.js';
import { ParserService } from '../services/ParserService.js';

export interface TelegramExecutionResult extends CreateTransactionResult {
  success: boolean;
  message: string;
}

export class TelegramBotService {
  private enabled: boolean = true;
  private mode: 'polling' | 'webhook' | 'mock' = 'mock';
  private botUsername: string = '@TruespaceBarBot';
  private configuredToken: boolean = false;
  private lastActiveAt: string = new Date().toISOString();

  constructor(
    private financeService: FinanceService,
    private parserService: ParserService
  ) {
    const token = process.env.BOT_TOKEN;
    if (token && token.trim() !== '') {
      this.configuredToken = true;
      this.mode = (process.env.BOT_MODE as any) || 'polling';
      this.botUsername = process.env.BOT_USERNAME || '@TruespaceBarBot';
      if (process.env.NODE_ENV !== 'test') {
        console.log(`[TelegramBotService] BOT_TOKEN configured. Mode: ${this.mode}`);
      }
    } else {
      this.configuredToken = false;
      this.mode = 'mock';
      this.botUsername = '@TruespaceBarBot';
      if (process.env.NODE_ENV !== 'test') {
        console.log('[TelegramBotService] BOT_TOKEN not provided. Initialized in mock / web simulator mode.');
      }
    }
  }

  /**
   * Returns current operational status of the bot.
   */
  public getStatus(): BotStatus {
    return {
      enabled: this.enabled,
      mode: this.mode,
      botUsername: this.botUsername,
      lastActiveAt: this.lastActiveAt,
      configuredToken: this.configuredToken,
      message: this.configuredToken
        ? 'Telegram бот активен'
        : 'Работа в режиме симулятора (без токена)',
    };
  }

  /**
   * Parses text command without committing changes.
   */
  public parseCommand(text: string): { parsed: ParsedCommand } {
    this.lastActiveAt = new Date().toISOString();
    const parsed = this.parserService.parse(text);
    return { parsed };
  }

  /**
   * Parses and executes a Telegram command directly into the ledger.
   */
  public async executeCommand(text: string): Promise<TelegramExecutionResult> {
    this.lastActiveAt = new Date().toISOString();
    const { parsed } = this.parseCommand(text);

    const dto = {
      type: parsed.type,
      amount: parsed.amount,
      sourceAccountId: parsed.type === 'expense' ? parsed.accountId : undefined,
      targetAccountId: parsed.type === 'income' ? parsed.accountId : undefined,
      categoryId: parsed.categoryId,
      eventId: parsed.eventId,
      description: `[Telegram] ${parsed.rawText}`,
      transactionDate: new Date().toISOString(),
    };

    const res = await this.financeService.createTransaction(dto);

    return {
      success: true,
      transaction: res.transaction,
      updatedAccounts: res.updatedAccounts,
      message: 'Операция успешно проведена через Telegram',
    };
  }
}
