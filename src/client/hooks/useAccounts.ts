/**
 * Truespace — Барный кейтеринг и финансы
 * Accounts Data Hook (`src/client/hooks/useAccounts.ts`)
 *
 * Provides access to the 5 catering accounts, aggregated capital,
 * and account selectors.
 */

import { useMemo } from 'react';
import { Account } from '../../shared/types.js';
import { useFinance } from '../context/FinanceContext.js';
import { formatRubles } from '../utils/formatters.js';

export interface UseAccountsReturn {
  accounts: Account[];
  totalBalance: number;
  formattedTotalBalance: string;
  cashAccounts: Account[];
  bankAccounts: Account[];
  cardAccounts: Account[];
  getAccountById: (id: string) => Account | undefined;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAccounts(): UseAccountsReturn {
  const { accounts, totalBalance, isLoading, error, refreshAccounts } = useFinance();

  const cashAccounts = useMemo(() => accounts.filter((a) => a.type === 'cash'), [accounts]);
  const bankAccounts = useMemo(() => accounts.filter((a) => a.type === 'bank'), [accounts]);
  const cardAccounts = useMemo(() => accounts.filter((a) => a.type === 'card'), [accounts]);

  const getAccountById = useMemo(() => {
    const map = new Map(accounts.map((a) => [a.id, a]));
    return (id: string) => map.get(id);
  }, [accounts]);

  const formattedTotalBalance = useMemo(() => formatRubles(totalBalance), [totalBalance]);

  return {
    accounts,
    totalBalance,
    formattedTotalBalance,
    cashAccounts,
    bankAccounts,
    cardAccounts,
    getAccountById,
    isLoading,
    error,
    refetch: refreshAccounts,
  };
}
