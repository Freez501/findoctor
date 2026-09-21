/**
 * Truespace — Барный кейтеринг и финансы
 * Transactions Hook (`src/client/hooks/useTransactions.ts`)
 *
 * Supports fast 5-second entry creation, transaction deletion, and filtered views.
 */

import { useState, useCallback, useMemo } from 'react';
import { Transaction, TransactionFilter } from '../../shared/types.js';
import { CreateTransactionDTO } from '../../shared/dto.js';
import { useFinance } from '../context/FinanceContext.js';

export interface UseTransactionsReturn {
  transactions: Transaction[];
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  filter: TransactionFilter;
  setFilter: (newFilter: Partial<TransactionFilter>) => void;
  resetFilter: () => void;
  createTransaction: (dto: CreateTransactionDTO) => Promise<{ success: boolean; transaction?: Transaction; error?: string }>;
  deleteTransaction: (id: string) => Promise<{ success: boolean; error?: string }>;
  refetch: () => Promise<void>;
}

export function useTransactions(): UseTransactionsReturn {
  const {
    transactions,
    isLoading,
    createTransaction: ctxCreateTransaction,
    deleteTransaction: ctxDeleteTransaction,
    refreshTransactions,
    addToast,
  } = useFinance();

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilterState] = useState<TransactionFilter>({});

  const setFilter = useCallback((newFilter: Partial<TransactionFilter>) => {
    setFilterState((prev) => ({ ...prev, ...newFilter }));
  }, []);

  const resetFilter = useCallback(() => {
    setFilterState({});
  }, []);

  // Filtered transactions computed client-side for rapid response
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (tx.isDeleted) return false;
      if (filter.type && tx.type !== filter.type) return false;
      if (filter.categoryId && tx.categoryId !== filter.categoryId) return false;
      if (filter.accountId) {
        if (tx.fromAccountId !== filter.accountId && tx.toAccountId !== filter.accountId) {
          return false;
        }
      }
      if (filter.eventId !== undefined) {
        if (filter.eventId === 'null' || filter.eventId === null) {
          if (tx.eventId !== null) return false;
        } else if (tx.eventId !== filter.eventId) {
          return false;
        }
      }
      return true;
    });
  }, [transactions, filter]);

  const createTransaction = useCallback(
    async (dto: CreateTransactionDTO) => {
      setIsSubmitting(true);
      setError(null);
      try {
        const result = await ctxCreateTransaction(dto);
        if (result.success) {
          const typeName =
            dto.type === 'expense' ? 'Расход' : dto.type === 'income' ? 'Доход' : 'Перевод';
          addToast(`${typeName} на ${dto.amount} ₽ успешно записан`, 'success');
        } else if (result.error) {
          setError(result.error);
        }
        return result;
      } finally {
        setIsSubmitting(false);
      }
    },
    [ctxCreateTransaction, addToast]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      setIsSubmitting(true);
      try {
        return await ctxDeleteTransaction(id);
      } finally {
        setIsSubmitting(false);
      }
    },
    [ctxDeleteTransaction]
  );

  return {
    transactions: filteredTransactions,
    isLoading,
    isSubmitting,
    error,
    filter,
    setFilter,
    resetFilter,
    createTransaction,
    deleteTransaction,
    refetch: refreshTransactions,
  };
}
