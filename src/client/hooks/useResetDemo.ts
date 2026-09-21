/**
 * Truespace — Барный кейтеринг и финансы
 * Reset Demo Data Hook (`src/client/hooks/useResetDemo.ts`)
 *
 * Provides single-action rollback to canonical demo data (5 accounts, 2 events, 21 transactions).
 */

import { useState, useCallback } from 'react';
import { useFinance } from '../context/FinanceContext.js';

export interface UseResetDemoReturn {
  resetDemo: () => Promise<boolean>;
  isResetting: boolean;
}

export function useResetDemo(): UseResetDemoReturn {
  const { resetDemoData } = useFinance();
  const [isResetting, setIsResetting] = useState<boolean>(false);

  const resetDemo = useCallback(async (): Promise<boolean> => {
    setIsResetting(true);
    try {
      return await resetDemoData();
    } finally {
      setIsResetting(false);
    }
  }, [resetDemoData]);

  return {
    resetDemo,
    isResetting,
  };
}
