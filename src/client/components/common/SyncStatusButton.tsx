/**
 * Truespace — Барный кейтеринг и финансы
 * Cloud Sync Button Component (`src/client/components/common/SyncStatusButton.tsx`)
 *
 * Professional one-click synchronization between local JSON storage and Supabase Cloud.
 * Displays sync status, last-synced timestamp, and spinning cloud indicator.
 */

import React, { useState, useEffect } from 'react';
import { Cloud, Check, Loader2 } from 'lucide-react';
import { api } from '../../api/apiClient.js';
import { useFinance } from '../../context/FinanceContext.js';

interface SyncStatusButtonProps {
  variant?: 'compact' | 'full';
  className?: string;
}

export const SyncStatusButton: React.FC<SyncStatusButtonProps> = ({
  variant = 'compact',
  className = '',
}) => {
  const { refreshAll, addToast } = useFinance();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(() => {
    const saved = localStorage.getItem('truespace_last_cloud_sync');
    return saved ? new Date(saved) : null;
  });
  const [statusText, setStatusText] = useState<string>('Синхронизировать');

  const updateStatusDisplay = () => {
    if (!lastSynced) {
      setStatusText('Синхронизировать');
      return;
    }
    const diffSec = Math.floor((Date.now() - lastSynced.getTime()) / 1000);
    if (diffSec < 60) {
      setStatusText('Синхронизировано только что');
    } else if (diffSec < 3600) {
      const mins = Math.floor(diffSec / 60);
      setStatusText(`Синхр. ${mins} мин назад`);
    } else {
      setStatusText('Синхронизировано');
    }
  };

  useEffect(() => {
    updateStatusDisplay();
    const interval = setInterval(updateStatusDisplay, 30000);
    return () => clearInterval(interval);
  }, [lastSynced]);

  const handleSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSyncing) return;

    setIsSyncing(true);
    try {
      const res = await api.syncSupabase();
      const now = new Date();
      setLastSynced(now);
      localStorage.setItem('truespace_last_cloud_sync', now.toISOString());
      await refreshAll();

      const counts = res.syncedCounts;
      const countMsg = counts
        ? ` (${counts.accounts || 0} счетов, ${counts.events || 0} мероприятий, ${counts.transactions || 0} операций)`
        : '';
      addToast(`Облачная база успешно синхронизирована${countMsg}`, 'success');
    } catch (err: any) {
      console.error('[SyncStatusButton] Sync failed:', err);
      addToast(err.message || 'Ошибка синхронизации с облаком', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const isCompact = variant === 'compact';

  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={isSyncing}
      className={`btn-cloud-sync ${className}`}
      title="Синхронизировать локальную базу с Supabase Cloud в один клик"
      aria-label="Синхронизация с Supabase Cloud"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: isCompact ? '6px 10px' : '8px 14px',
        fontSize: isCompact ? '0.78rem' : '0.85rem',
        fontWeight: 500,
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
        color: isSyncing ? 'var(--muted-foreground)' : '#3b82f6',
        border: '1px solid rgba(59, 130, 246, 0.22)',
        borderRadius: '8px',
        cursor: isSyncing ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      {isSyncing ? (
        <Loader2 size={14} className="animate-spin text-blue-500" />
      ) : lastSynced ? (
        <Check size={14} className="text-emerald-500" />
      ) : (
        <Cloud size={14} className="text-blue-500" />
      )}
      <span>{isSyncing ? 'Синхронизация...' : statusText}</span>
    </button>
  );
};
