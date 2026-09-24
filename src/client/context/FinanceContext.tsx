/**
 * Truespace — Барный кейтеринг и финансы
 * Finance Central State & Synchronization Provider (`src/client/context/FinanceContext.tsx`)
 *
 * Coordinates real-time state synchronization across all UI components:
 * - 5 account balances and total capital
 * - Categories and catering events
 * - Transactions history with optimistic balance updates
 * - Telegram Bot execution & status
 * - Global toast notification bus
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Account,
  BotStatus,
  Category,
  CateringEvent,
  Partner,
  Transaction,
} from '../../shared/types.js';
import { CreateTransactionDTO, CreateEventDTO, UpdateTransactionDTO } from '../../shared/dto.js';
import { api } from '../api/apiClient.js';
import { roundRubles } from '../utils/formatters.js';
import { useAuth } from './AuthContext.js';

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  timestamp: number;
  undoAction?: () => void;
}

export interface FinanceContextType {
  accounts: Account[];
  totalBalance: number;
  categories: Category[];
  partners: Partner[];
  events: CateringEvent[];
  transactions: Transaction[];
  botStatus: BotStatus | null;
  isLoading: boolean;
  isInitialLoaded: boolean;
  error: string | null;

  // Actions
  refreshAll: () => Promise<void>;
  refreshAccounts: () => Promise<void>;
  refreshCategories: () => Promise<void>;
  refreshPartners: () => Promise<void>;
  refreshEvents: () => Promise<void>;
  refreshTransactions: () => Promise<void>;
  refreshBotStatus: () => Promise<void>;
  createTransaction: (dto: CreateTransactionDTO) => Promise<{ success: boolean; transaction?: Transaction; error?: string }>;
  updateTransaction: (id: string, updates: UpdateTransactionDTO) => Promise<{ success: boolean; transaction?: Transaction; error?: string }>;
  batchImportTransactions: (items: CreateTransactionDTO[]) => Promise<{ success: boolean; count?: number; error?: string }>;
  deleteTransaction: (id: string) => Promise<{ success: boolean; error?: string }>;
  deleteBatchTransactions: (ids: string[]) => Promise<{ success: boolean; count?: number; error?: string }>;
  updateBatchTransactions: (ids: string[], updates: { accountId?: string; fromAccountId?: string | null; toAccountId?: string | null; categoryId?: string; eventId?: string | null }) => Promise<{ success: boolean; count?: number; error?: string }>;
  createEvent: (dto: CreateEventDTO) => Promise<{ success: boolean; event?: CateringEvent; error?: string }>;
  updateEvent: (id: string, updates: Partial<CateringEvent>) => Promise<{ success: boolean; event?: CateringEvent; error?: string }>;
  deleteEvent: (id: string) => Promise<{ success: boolean; error?: string }>;
  executeTelegramCommand: (text: string) => Promise<{ success: boolean; transaction?: Transaction; error?: string }>;
  resetDemoData: () => Promise<boolean>;
  resetAccountBalances: () => Promise<boolean>;
  clearFinanceState: () => void;

  // Toasts
  toasts: ToastItem[];
  addToast: (message: string, type?: 'success' | 'error' | 'info', undoAction?: () => void) => void;
  removeToast: (id: string) => void;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

// Standard deterministic sorting order for the 5 catering accounts
const ACCOUNT_ORDER: Record<string, number> = {
  cash_1: 1,
  cash_2: 2,
  bank_1: 3,
  bank_2: 4,
  card_sbp: 5,
};

function sortAccounts(accounts: Account[]): Account[] {
  return [...accounts].sort((a, b) => {
    const orderA = ACCOUNT_ORDER[a.id] || 99;
    const orderB = ACCOUNT_ORDER[b.id] || 99;
    return orderA - orderB;
  });
}

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentCompany, isAuthenticated } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [events, setEvents] = useState<CateringEvent[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isInitialLoaded, setIsInitialLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Calculate aggregated capital safely
  const totalBalance = useMemo(() => {
    const sum = accounts.reduce((acc, account) => acc + (account.currentBalance || 0), 0);
    return roundRubles(sum);
  }, [accounts]);

  // Toast notifications manager
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((
    message: string,
    type: 'success' | 'error' | 'info' = 'info',
    undoAction?: () => void
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newToast: ToastItem = {
      id,
      message,
      type,
      timestamp: Date.now(),
      undoAction,
    };
    setToasts((prev) => [...prev.slice(-3), newToast]); // Keep maximum 4 toasts

    // Auto-dismiss after 4.5 seconds
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  }, [removeToast]);

  // Data fetching functions
  const refreshAccounts = useCallback(async () => {
    try {
      const res = await api.getAccounts();
      setAccounts(sortAccounts(res.accounts));
    } catch (err: any) {
      console.error('Failed to load accounts:', err);
    }
  }, []);

  const refreshCategories = useCallback(async () => {
    try {
      const res = await api.getCategories();
      setCategories(res.categories);
    } catch (err: any) {
      console.error('Failed to load categories:', err);
    }
  }, []);

  const refreshPartners = useCallback(async () => {
    try {
      const res = await api.getPartners();
      setPartners(res.partners);
    } catch (err: any) {
      console.error('Failed to load partners:', err);
    }
  }, []);

  const refreshEvents = useCallback(async () => {
    try {
      const res = await api.getEvents();
      setEvents(res.events);
    } catch (err: any) {
      console.error('Failed to load events:', err);
    }
  }, []);

  const refreshTransactions = useCallback(async () => {
    try {
      const res = await api.getTransactions({ includeDeleted: false });
      setTransactions(res.transactions);
    } catch (err: any) {
      console.error('Failed to load transactions:', err);
    }
  }, []);

  const refreshBotStatus = useCallback(async () => {
    try {
      const res = await api.getTelegramStatus();
      setBotStatus(res);
    } catch (err: any) {
      console.error('Failed to load Telegram bot status:', err);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [accRes, catRes, evRes, txRes, botRes, partRes] = await Promise.allSettled([
        api.getAccounts(),
        api.getCategories(),
        api.getEvents(),
        api.getTransactions({ includeDeleted: false }),
        api.getTelegramStatus(),
        api.getPartners(),
      ]);

      if (accRes.status === 'fulfilled') {
        setAccounts(sortAccounts(accRes.value.accounts));
      }
      if (catRes.status === 'fulfilled') {
        setCategories(catRes.value.categories);
      }
      if (evRes.status === 'fulfilled') {
        setEvents(evRes.value.events);
      }
      if (txRes.status === 'fulfilled') {
        setTransactions(txRes.value.transactions);
      }
      if (botRes.status === 'fulfilled') {
        setBotStatus(botRes.value);
      }
      if (partRes.status === 'fulfilled') {
        setPartners(partRes.value.partners);
      }

      setIsInitialLoaded(true);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки данных системы');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearFinanceState = useCallback(() => {
    setTransactions([]);
    setAccounts([]);
    setEvents([]);
    setCategories([]);
    setPartners([]);
    setBotStatus(null);
  }, []);

  // Reload data when active company changes or on mount; wipe state cleanly on logout
  useEffect(() => {
    if (!isAuthenticated) {
      clearFinanceState();
      return;
    }
    if (currentCompany?.id) {
      api.setActiveCompanyId(currentCompany.id);
    }
    refreshAll();
  }, [isAuthenticated, currentCompany?.id, refreshAll, clearFinanceState]);

  // Periodic bot status polling (every 30s)
  useEffect(() => {
    const timer = setInterval(() => {
      refreshBotStatus();
    }, 30000);
    return () => clearInterval(timer);
  }, [refreshBotStatus]);

  // Helper to merge updatedAccounts into current accounts state
  const mergeUpdatedAccounts = useCallback((updated: Account[]) => {
    setAccounts((current) => {
      const updatedMap = new Map(updated.map((a) => [a.id, a]));
      const merged = current.map((acc) => updatedMap.get(acc.id) || acc);
      return sortAccounts(merged);
    });
  }, []);

  // 1. Create Transaction with Optimistic Balance Updates
  const createTransaction = useCallback(
    async (dto: CreateTransactionDTO): Promise<{ success: boolean; transaction?: Transaction; error?: string }> => {
      // Local validation
      if (!dto.amount || dto.amount <= 0) {
        return { success: false, error: 'Сумма операции должна быть больше 0 ₽.' };
      }
      if (dto.type === 'transfer' && dto.fromAccountId === dto.toAccountId) {
        return { success: false, error: 'Счёт списания и счёт зачисления не могут совпадать.' };
      }
      if (dto.type === 'expense' && !dto.fromAccountId) {
        return { success: false, error: 'Выберите счёт списания.' };
      }
      if (dto.type === 'income' && !dto.toAccountId) {
        return { success: false, error: 'Выберите счёт зачисления.' };
      }

      // Snapshot prior state for rollback
      const prevAccounts = [...accounts];
      const prevTransactions = [...transactions];

      // Optimistic balance calculation
      const tempId = `temp-tx-${Date.now()}`;
      const tempTx: Transaction = {
        id: tempId,
        type: dto.type,
        amount: dto.amount,
        fromAccountId: dto.fromAccountId || null,
        toAccountId: dto.toAccountId || null,
        categoryId: dto.categoryId,
        eventId: dto.eventId || null,
        description: dto.description || '',
        transactionDate: dto.transactionDate || new Date().toISOString(),
        isDeleted: false,
        createdAt: new Date().toISOString(),
      };

      setAccounts((current) => {
        return current.map((acc) => {
          let newBalance = acc.currentBalance;
          if (dto.type === 'expense' && acc.id === dto.fromAccountId) {
            newBalance = roundRubles(newBalance - dto.amount);
          } else if (dto.type === 'income' && acc.id === dto.toAccountId) {
            newBalance = roundRubles(newBalance + dto.amount);
          } else if (dto.type === 'transfer') {
            if (acc.id === dto.fromAccountId) {
              newBalance = roundRubles(newBalance - dto.amount);
            } else if (acc.id === dto.toAccountId) {
              newBalance = roundRubles(newBalance + dto.amount);
            }
          }
          return newBalance !== acc.currentBalance ? { ...acc, currentBalance: newBalance } : acc;
        });
      });

      setTransactions((current) => [tempTx, ...current]);

      try {
        const res = await api.createTransaction(dto);
        if (res.success && res.transaction) {
          // Replace temp transaction with server-persisted transaction
          setTransactions((current) =>
            current.map((tx) => (tx.id === tempId ? res.transaction : tx))
          );
          // Apply exact authoritative balances returned by server
          if (res.updatedAccounts && res.updatedAccounts.length > 0) {
            mergeUpdatedAccounts(res.updatedAccounts);
          }
          return { success: true, transaction: res.transaction };
        } else {
          // Rollback
          setAccounts(prevAccounts);
          setTransactions(prevTransactions);
          return { success: false, error: 'Сервер отклонил операцию.' };
        }
      } catch (err: any) {
        // Rollback on network/validation error
        setAccounts(prevAccounts);
        setTransactions(prevTransactions);
        const errMsg = err.message || 'Не удалось сохранить операцию. Баланс возвращён в исходное состояние.';
        return { success: false, error: errMsg };
      }
    },
    [accounts, transactions, mergeUpdatedAccounts]
  );

  // 2. Delete / Reverse Transaction
  const deleteTransaction = useCallback(
    async (id: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await api.deleteTransaction(id);
        if (res.success) {
          // Remove from active transactions
          setTransactions((current) => current.filter((tx) => tx.id !== id));
          if (res.updatedAccounts && res.updatedAccounts.length > 0) {
            mergeUpdatedAccounts(res.updatedAccounts);
          }
          addToast('Операция успешно отменена, баланс пересчитан', 'success');
          return { success: true };
        }
        return { success: false, error: res.message || 'Не удалось отменить операцию' };
      } catch (err: any) {
        const msg = err.message || 'Ошибка отмены операции';
        addToast(msg, 'error');
        return { success: false, error: msg };
      }
    },
    [mergeUpdatedAccounts, addToast]
  );

  // 3. Update Existing Transaction
  const updateTransaction = useCallback(
    async (
      id: string,
      updates: UpdateTransactionDTO
    ): Promise<{ success: boolean; transaction?: Transaction; error?: string }> => {
      try {
        const res = await api.updateTransaction(id, updates);
        if (res.success && res.transaction) {
          setTransactions((current) =>
            current.map((tx) => (tx.id === id ? res.transaction : tx))
          );
          if (res.updatedAccounts && res.updatedAccounts.length > 0) {
            mergeUpdatedAccounts(res.updatedAccounts);
          }
          addToast('Операция успешно обновлена', 'success');
          return { success: true, transaction: res.transaction };
        }
        return { success: false, error: 'Ошибка обновления операции' };
      } catch (err: any) {
        const msg = err.message || 'Не удалось обновить операцию';
        addToast(msg, 'error');
        return { success: false, error: msg };
      }
    },
    [mergeUpdatedAccounts, addToast]
  );

  // 4. Batch Import Transactions
  const batchImportTransactions = useCallback(
    async (
      items: CreateTransactionDTO[]
    ): Promise<{ success: boolean; count?: number; error?: string }> => {
      try {
        const res = await api.createBatchTransactions(items);
        if (res.success && res.transactions) {
          setTransactions((current) => [...res.transactions, ...current]);
          if (res.updatedAccounts && res.updatedAccounts.length > 0) {
            mergeUpdatedAccounts(res.updatedAccounts);
          }
          addToast(`Успешно импортировано операций: ${res.count}`, 'success');
          return { success: true, count: res.count };
        }
        return { success: false, error: 'Ошибка пакетного импорта' };
      } catch (err: any) {
        const msg = err.message || 'Не удалось импортировать операции';
        addToast(msg, 'error');
        return { success: false, error: msg };
      }
    },
    [mergeUpdatedAccounts, addToast]
  );

  // 5. Batch Delete Transactions
  const deleteBatchTransactions = useCallback(
    async (ids: string[]): Promise<{ success: boolean; count?: number; error?: string }> => {
      try {
        const res = await api.deleteBatchTransactions(ids);
        if (res.success) {
          const idSet = new Set(res.deletedIds || ids);
          setTransactions((current) => current.filter((tx) => !idSet.has(tx.id)));
          if (res.updatedAccounts && res.updatedAccounts.length > 0) {
            mergeUpdatedAccounts(res.updatedAccounts);
          }
          addToast(`Успешно удалено операций: ${res.deletedCount}`, 'success');
          return { success: true, count: res.deletedCount };
        }
        return { success: false, error: res.message || 'Ошибка массового удаления' };
      } catch (err: any) {
        const msg = err.message || 'Не удалось удалить выбранные операции';
        addToast(msg, 'error');
        return { success: false, error: msg };
      }
    },
    [mergeUpdatedAccounts, addToast]
  );

  // 6. Batch Update Transactions (e.g. Move to another account)
  const updateBatchTransactions = useCallback(
    async (
      ids: string[],
      updates: {
        accountId?: string;
        fromAccountId?: string | null;
        toAccountId?: string | null;
        categoryId?: string;
        eventId?: string | null;
      }
    ): Promise<{ success: boolean; count?: number; error?: string }> => {
      try {
        const res = await api.updateBatchTransactions(ids, updates);
        if (res.success) {
          const txRes = await api.getTransactions({ includeDeleted: false });
          setTransactions(txRes.transactions);
          if (res.updatedAccounts && res.updatedAccounts.length > 0) {
            mergeUpdatedAccounts(res.updatedAccounts);
          }
          addToast(`Счёт успешно изменён для ${res.updatedCount} операций`, 'success');
          return { success: true, count: res.updatedCount };
        }
        return { success: false, error: res.message || 'Ошибка обновления счёта' };
      } catch (err: any) {
        const msg = err.message || 'Не удалось перенести операции на другой счёт';
        addToast(msg, 'error');
        return { success: false, error: msg };
      }
    },
    [mergeUpdatedAccounts, addToast]
  );

  // 5. Execute Telegram Command
  const executeTelegramCommand = useCallback(
    async (text: string): Promise<{ success: boolean; transaction?: Transaction; error?: string }> => {
      try {
        const res = await api.executeTelegramCommand(text);
        if (res.success && res.transaction) {
          setTransactions((current) => [res.transaction, ...current]);
          if (res.updatedAccounts && res.updatedAccounts.length > 0) {
            mergeUpdatedAccounts(res.updatedAccounts);
          }
          refreshBotStatus();
          return { success: true, transaction: res.transaction };
        }
        return { success: false, error: res.message || 'Команда не выполнена' };
      } catch (err: any) {
        return { success: false, error: err.message || 'Ошибка выполнения команды' };
      }
    },
    [mergeUpdatedAccounts, refreshBotStatus]
  );

  // 4. Events management
  const createEvent = useCallback(
    async (dto: CreateEventDTO): Promise<{ success: boolean; event?: CateringEvent; error?: string }> => {
      try {
        const res = await api.createEvent(dto);
        if (res.event) {
          setEvents((cur) => [res.event, ...cur]);
          addToast(`Мероприятие «${res.event.title}» успешно создано`, 'success');
          return { success: true, event: res.event };
        }
        return { success: false, error: 'Не удалось создать мероприятие' };
      } catch (err: any) {
        const msg = err.message || 'Ошибка создания мероприятия';
        addToast(msg, 'error');
        return { success: false, error: msg };
      }
    },
    [addToast]
  );

  const updateEvent = useCallback(
    async (id: string, updates: Partial<CateringEvent>): Promise<{ success: boolean; event?: CateringEvent; error?: string }> => {
      try {
        const res = await api.updateEvent(id, updates);
        if (res.event) {
          setEvents((cur) => cur.map((e) => (e.id === id ? res.event : e)));
          addToast(`Мероприятие «${res.event.title}» обновлено`, 'success');
          return { success: true, event: res.event };
        }
        return { success: false, error: 'Не удалось обновить мероприятие' };
      } catch (err: any) {
        const msg = err.message || 'Ошибка обновления мероприятия';
        addToast(msg, 'error');
        return { success: false, error: msg };
      }
    },
    [addToast]
  );

  const deleteEvent = useCallback(
    async (id: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await api.deleteEvent(id);
        if (res.success) {
          setEvents((cur) => cur.filter((e) => e.id !== id));
          addToast('Мероприятие удалено', 'info');
          return { success: true };
        }
        return { success: false, error: 'Не удалось удалить мероприятие' };
      } catch (err: any) {
        const msg = err.message || 'Ошибка удаления мероприятия';
        addToast(msg, 'error');
        return { success: false, error: msg };
      }
    },
    [addToast]
  );

  // 5. Reset Demo Data
  const resetDemoData = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const res = await api.resetDemoData();
      if (res.success) {
        await refreshAll();
        addToast('Демо-данные успешно сброшены к начальному состоянию (5 счетов, 1 166 300 ₽)', 'success');
        return true;
      }
      return false;
    } catch (err: any) {
      addToast(err.message || 'Не удалось сбросить демо-данные', 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [refreshAll, addToast]);

  // 6. Reset All Account Balances to 0 ₽
  const resetAccountBalances = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const res = await api.resetAccountBalances();
      if (res.success && res.accounts) {
        setAccounts(sortAccounts(res.accounts));
        addToast('Остатки всех счетов успешно обнулены до 0 ₽', 'success');
        return true;
      }
      return false;
    } catch (err: any) {
      addToast(err.message || 'Не удалось обнулить остатки счетов', 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  const value = useMemo(
    () => ({
      accounts,
      totalBalance,
      categories,
      partners,
      events,
      transactions,
      botStatus,
      isLoading,
      isInitialLoaded,
      error,
      refreshAll,
      refreshAccounts,
      refreshCategories,
      refreshPartners,
      refreshEvents,
      refreshTransactions,
      refreshBotStatus,
      createTransaction,
      updateTransaction,
      batchImportTransactions,
      deleteTransaction,
      deleteBatchTransactions,
      updateBatchTransactions,
      createEvent,
      updateEvent,
      deleteEvent,
      executeTelegramCommand,
      resetDemoData,
      resetAccountBalances,
      clearFinanceState,
      toasts,
      addToast,
      removeToast,
    }),
    [
      accounts,
      totalBalance,
      categories,
      partners,
      events,
      transactions,
      botStatus,
      isLoading,
      isInitialLoaded,
      error,
      refreshAll,
      refreshAccounts,
      refreshCategories,
      refreshPartners,
      refreshEvents,
      refreshTransactions,
      refreshBotStatus,
      createTransaction,
      updateTransaction,
      batchImportTransactions,
      deleteTransaction,
      deleteBatchTransactions,
      updateBatchTransactions,
      createEvent,
      updateEvent,
      deleteEvent,
      executeTelegramCommand,
      resetDemoData,
      resetAccountBalances,
      clearFinanceState,
      toasts,
      addToast,
      removeToast,
    ]
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
};

export function useFinance(): FinanceContextType {
  const ctx = useContext(FinanceContext);
  if (!ctx) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return ctx;
}
