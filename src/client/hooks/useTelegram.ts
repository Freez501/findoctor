/**
 * Truespace — Барный кейтеринг и финансы
 * Telegram Command Simulator & Bot Status Hook (`src/client/hooks/useTelegram.ts`)
 *
 * Implements:
 * - Bot status monitoring (mode, handle, polling/mock)
 * - Debounced live parsing preview (POST /api/telegram/parse)
 * - One-click execution into main ledger (POST /api/telegram/execute)
 * - Preset scenario selection and error translation
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { BotStatus, ParsedCommand, Transaction } from '../../shared/types.js';
import { api } from '../api/apiClient.js';
import { useFinance } from '../context/FinanceContext.js';
import { formatRubles } from '../utils/formatters.js';

export interface UseTelegramReturn {
  botStatus: BotStatus | null;
  isStatusLoading: boolean;
  refetchStatus: () => Promise<void>;

  // Input & Parse state
  inputText: string;
  setInputText: (text: string) => void;
  parsedResult: ParsedCommand | null;
  isParsing: boolean;
  parseError: string | null;

  // Execution state
  isExecuting: boolean;
  executeError: string | null;
  lastSuccessMessage: string | null;
  lastExecutedTransaction: Transaction | null;

  // Actions
  execute: (overrideText?: string) => Promise<boolean>;
  selectExample: (commandText: string) => void;
  clear: () => void;
}

export function useTelegram(): UseTelegramReturn {
  const { botStatus, refreshBotStatus, executeTelegramCommand, addToast } = useFinance();

  const [isStatusLoading, setIsStatusLoading] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>('');
  const [parsedResult, setParsedResult] = useState<ParsedCommand | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executeError, setExecuteError] = useState<string | null>(null);
  const [lastSuccessMessage, setLastSuccessMessage] = useState<string | null>(null);
  const [lastExecutedTransaction, setLastExecutedTransaction] = useState<Transaction | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Status refetch
  const handleRefetchStatus = useCallback(async () => {
    setIsStatusLoading(true);
    try {
      await refreshBotStatus();
    } finally {
      setIsStatusLoading(false);
    }
  }, [refreshBotStatus]);

  // Debounced parsing preview
  useEffect(() => {
    const trimmed = inputText.trim();

    if (!trimmed) {
      setParsedResult(null);
      setParseError(null);
      setIsParsing(false);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      return;
    }

    // Cancel pending debounce and in-flight request
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setIsParsing(true);
    setParseError(null);

    debounceTimerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const res = await api.parseTelegramCommand(trimmed, { signal: controller.signal });
        setParsedResult(res.parsed);
        setParseError(null);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setParsedResult(null);
          // Only show error if the user has typed at least 3 characters
          if (trimmed.length >= 3) {
            setParseError(err.message || 'Не удалось распознать операцию');
          }
        }
      } finally {
        setIsParsing(false);
      }
    }, 250);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [inputText]);

  // Execute Command
  const execute = useCallback(
    async (overrideText?: string): Promise<boolean> => {
      const textToRun = (overrideText ?? inputText).trim();
      if (!textToRun) return false;

      setIsExecuting(true);
      setExecuteError(null);

      try {
        const result = await executeTelegramCommand(textToRun);
        if (result.success && result.transaction) {
          setLastExecutedTransaction(result.transaction);
          const typeName = result.transaction.type === 'income' ? 'Приход' : 'Расход';
          const successMsg = `${typeName} на ${formatRubles(result.transaction.amount)} успешно проведён через Telegram`;
          setLastSuccessMessage(successMsg);
          addToast(successMsg, 'success');

          // Reset inputs
          setInputText('');
          setParsedResult(null);
          setParseError(null);

          // Clear success message after 5 seconds
          setTimeout(() => {
            setLastSuccessMessage(null);
          }, 5000);

          return true;
        } else {
          setExecuteError(result.error || 'Ошибка при проведении операции');
          return false;
        }
      } catch (err: any) {
        setExecuteError(err.message || 'Ошибка сети');
        return false;
      } finally {
        setIsExecuting(false);
      }
    },
    [inputText, executeTelegramCommand, addToast]
  );

  const selectExample = useCallback((commandText: string) => {
    setInputText(commandText);
    setExecuteError(null);
    setLastSuccessMessage(null);
  }, []);

  const clear = useCallback(() => {
    setInputText('');
    setParsedResult(null);
    setParseError(null);
    setExecuteError(null);
    setLastSuccessMessage(null);
  }, []);

  return {
    botStatus,
    isStatusLoading,
    refetchStatus: handleRefetchStatus,
    inputText,
    setInputText,
    parsedResult,
    isParsing,
    parseError,
    isExecuting,
    executeError,
    lastSuccessMessage,
    lastExecutedTransaction,
    execute,
    selectExample,
    clear,
  };
}
