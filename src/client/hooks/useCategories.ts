/**
 * Truespace — Барный кейтеринг и финансы
 * Categories Hook (`src/client/hooks/useCategories.ts`)
 *
 * Provides category lists, metadata helpers, and the 6 primary quick chips
 * for 5-second mobile entry.
 */

import { useMemo } from 'react';
import { Category } from '../../shared/types.js';
import { QUICK_CATEGORY_CHIPS } from '../../shared/constants.js';
import { useFinance } from '../context/FinanceContext.js';

export interface UseCategoriesReturn {
  categories: Category[];
  quickChips: typeof QUICK_CATEGORY_CHIPS;
  expenseCategories: Category[];
  incomeCategories: Category[];
  categoryMap: Map<string, Category>;
  getCategoryById: (id: string) => Category | undefined;
  getCategoryName: (id: string) => string;
  isLoading: boolean;
}

export function useCategories(): UseCategoriesReturn {
  const { categories, isLoading } = useFinance();

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'expense' || c.type === 'both'),
    [categories]
  );

  const incomeCategories = useMemo(
    () => categories.filter((c) => c.type === 'income' || c.type === 'both'),
    [categories]
  );

  const categoryMap = useMemo(() => {
    return new Map<string, Category>(categories.map((c) => [c.id, c]));
  }, [categories]);

  const getCategoryById = useMemo(() => {
    return (id: string) => categoryMap.get(id);
  }, [categoryMap]);

  const getCategoryName = useMemo(() => {
    return (id: string) => {
      const cat = categoryMap.get(id);
      return cat ? cat.name : id;
    };
  }, [categoryMap]);

  return {
    categories,
    quickChips: QUICK_CATEGORY_CHIPS,
    expenseCategories,
    incomeCategories,
    categoryMap,
    getCategoryById,
    getCategoryName,
    isLoading,
  };
}
